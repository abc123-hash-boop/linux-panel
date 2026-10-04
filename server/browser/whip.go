package browser

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/pion/webrtc/v3"
)

// whipResource 一个活跃的 WHIP 资源
type whipResource struct {
	ID             string
	PeerConnection *webrtc.PeerConnection
	DataChannel    *webrtc.DataChannel
	SessionID      string
	mu             sync.Mutex
}

var whipResources = make(map[string]*whipResource)
var whipMu sync.RWMutex

// whipRoutes 注册 WHIP 相关路由
func whipRoutes(group *gin.RouterGroup, manager *SessionManager) {
	group.POST("/sessions/:id/whip", whipHandler(manager))
	group.DELETE("/sessions/:id/whip/:resourceId", whipResourceHandler())
}

// whipHandler 接收 SDP offer，创建 PeerConnection，返回 SDP answer
func whipHandler(m *SessionManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		sessionID := c.Param("id")
		sess, ok := m.GetSession(sessionID)
		if !ok {
			c.JSON(404, gin.H{"error": "session not found"})
			return
		}

		body, err := c.GetRawData()
		if err != nil {
			c.JSON(400, gin.H{"error": "failed to read body"})
			return
		}

		offer := webrtc.SessionDescription{Type: webrtc.SDPTypeOffer, SDP: string(body)}

		config := webrtc.Configuration{
			ICEServers: []webrtc.ICEServer{
				{URLs: []string{"stun:stun.l.google.com:19302"}},
				{URLs: []string{"stun:stun.cloudflare.com:3478"}},
			},
		}

		pc, err := webrtc.NewPeerConnection(config)
		if err != nil {
			log.Printf("[WHIP] NewPeerConnection error: %v", err)
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		resourceID := uuid.New().String()
		resource := &whipResource{ID: resourceID, PeerConnection: pc, SessionID: sessionID}

		pc.OnDataChannel(func(d *webrtc.DataChannel) {
			log.Printf("[WHIP] DataChannel '%s' opened for resource %s", d.Label(), resourceID)
			if d.Label() != "screencast" {
				d.Close()
				return
			}
			resource.mu.Lock()
			resource.DataChannel = d
			resource.mu.Unlock()
			d.OnOpen(func() {
				go streamScreencastToDataChannel(sess, d)
			})
		})

		pc.OnConnectionStateChange(func(state webrtc.PeerConnectionState) {
			log.Printf("[WHIP] Connection state: %s (resource=%s)", state, resourceID)
			if state == webrtc.PeerConnectionStateFailed || state == webrtc.PeerConnectionStateClosed {
				whipMu.Lock()
				delete(whipResources, resourceID)
				whipMu.Unlock()
				resource.mu.Lock()
				if resource.PeerConnection != nil {
					resource.PeerConnection.Close()
					resource.PeerConnection = nil
				}
				resource.mu.Unlock()
			}
		})

		if err := pc.SetRemoteDescription(offer); err != nil {
			log.Printf("[WHIP] SetRemoteDescription error: %v", err)
			c.JSON(400, gin.H{"error": err.Error()})
			return
		}

		answer, err := pc.CreateAnswer(nil)
		if err != nil {
			log.Printf("[WHIP] CreateAnswer error: %v", err)
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		if err := pc.SetLocalDescription(answer); err != nil {
			log.Printf("[WHIP] SetLocalDescription error: %v", err)
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		// 等待 ICE 收集完成（最多 10 秒）
		select {
		case <-webrtc.GatheringCompletePromise(pc):
		case <-time.After(10 * time.Second):
			log.Printf("[WHIP] ICE gathering timed out for resource %s", resourceID)
		}

		whipMu.Lock()
		whipResources[resourceID] = resource
		whipMu.Unlock()

		c.Header("Content-Type", "application/sdp")
		c.Header("Location", fmt.Sprintf("/browser/sessions/%s/whip/%s", sessionID, resourceID))
		c.Writer.WriteHeader(http.StatusCreated)
		c.Writer.Write([]byte(pc.LocalDescription().SDP))
	}
}

// whipResourceHandler 处理 PATCH（trickle ICE）和 DELETE
func whipResourceHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		resourceID := c.Param("resourceId")
		whipMu.RLock()
		resource, ok := whipResources[resourceID]
		whipMu.RUnlock()
		if !ok {
			c.JSON(404, gin.H{"error": "resource not found"})
			return
		}
		switch c.Request.Method {
		case http.MethodPatch:
			c.Status(http.StatusNoContent)
		case http.MethodDelete:
			resource.mu.Lock()
			if resource.PeerConnection != nil {
				resource.PeerConnection.Close()
				resource.PeerConnection = nil
			}
			resource.mu.Unlock()
			whipMu.Lock()
			delete(whipResources, resourceID)
			whipMu.Unlock()
			c.JSON(200, gin.H{"message": "deleted"})
		default:
			c.JSON(405, gin.H{"error": "method not allowed"})
		}
	}
}

// streamScreencastToDataChannel 通过 CDP Page.startScreencast 推帧到 WebRTC data channel
func streamScreencastToDataChannel(sess *Session, dc *webrtc.DataChannel) {
	frameCount := 0
	var idCounter int64 = 100
	const chunkSize = 16384

	for {
		// 寻找 page target，失败则短暂等待重试
		wsURL, err := sess.pageWSURL()
		if err != nil || wsURL == "" {
			log.Printf("[WHIP] No page target, retrying... (closed=%v)", sess.IsClosed())
			if sess.IsClosed() {
				return
			}
			time.Sleep(500 * time.Millisecond)
			continue
		}
		conn, err := dialCDP(wsURL, 5*time.Second)
		if err != nil {
			log.Printf("[WHIP] CDP dial error: %v", err)
			if sess.IsClosed() {
				return
			}
			time.Sleep(500 * time.Millisecond)
			continue
		}

		// Enable Page domain
		conn.Call("Page.enable", nil, nil, 2*time.Second)
		// Bring to front
		conn.Call("Page.bringToFront", nil, nil, 2*time.Second)

		// 启动 screencast
		startMsg := map[string]interface{}{
			"format":        "jpeg",
			"quality":       80,
			"maxWidth":      1280,
			"maxHeight":     720,
			"everyNthFrame": 1,
		}
		if err := conn.Call("Page.startScreencast", startMsg, nil, 5*time.Second); err != nil {
			log.Printf("[WHIP] startScreencast error: %v", err)
			_ = conn.Close()
			continue
		}

		// 读取帧事件——每次外循环迭代都刷新 deadline
		done := false
		for !done {
			// 确保 deadline 在每次迭代开始时新鲜
			_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			var msg cdpMessage
			if err := conn.ws.ReadJSON(&msg); err != nil {
				log.Printf("[WHIP] read error: %v", err)
				done = true
				break
			}
			// 任何消息到达都延长 deadline
			_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			if msg.Method == "" {
				continue // response to our calls
			}
			if msg.Method == "Page.frameStartedLoading" {
				// 导航发生后，Chrome 需要时间渲染，延长 deadline 等待首帧
				_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			}
			if msg.Method == "Page.screencastFrame" {
				frameCount++
				if frameCount%30 == 1 || frameCount == 1 {
					log.Printf("[WHIP] frame #%d", frameCount)
				}
				var params struct {
					Data      string `json:"data"`
					SessionID int    `json:"sessionId"`
				}
				if err := json.Unmarshal(msg.Params, &params); err != nil {
					continue
				}
				data, err := base64.StdEncoding.DecodeString(params.Data)
				if err != nil {
					log.Printf("[WHIP] decode error: %v", err)
					continue
				}

				// 发元数据
				meta, _ := json.Marshal(map[string]interface{}{
					"type": "frame-start",
					"size": len(data),
				})
				if sendErr := dc.SendText(string(meta)); sendErr != nil {
					log.Printf("[WHIP] send meta error: %v", sendErr)
					done = true
					break
				}
				// 分块发二进制
				for i := 0; i < len(data) && !done; i += chunkSize {
					end := i + chunkSize
					if end > len(data) {
						end = len(data)
					}
					if sendErr := dc.Send(data[i:end]); sendErr != nil {
						log.Printf("[WHIP] send chunk error: %v", sendErr)
						done = true
						break
					}
				}
				// ack
				idCounter++
				ackParams, _ := json.Marshal(map[string]interface{}{
					"sessionId": params.SessionID,
				})
				if sendErr := conn.ws.WriteJSON(cdpMessage{ID: int(idCounter), Method: "Page.screencastFrameAck", Params: ackParams}); sendErr != nil {
					log.Printf("[WHIP] ack error: %v", sendErr)
					done = true
				}
			} else if msg.Method != "" {
				// 忽略其他 CDP 事件（导航等）
			}
		}
		_ = conn.Close()
		if done || sess.IsClosed() {
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
	log.Printf("[WHIP] screencast stream ended, total frames=%d", frameCount)
}
