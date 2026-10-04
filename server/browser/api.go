package browser

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	gorilla "github.com/gorilla/websocket"
)

// RegisterRoutes 注册浏览器路由
func RegisterRoutes(r *gin.Engine, manager *SessionManager) {
	browser := r.Group("/browser")
	{
		browser.GET("/sessions", listSessionsHandler(manager))
		browser.POST("/sessions", createSessionHandler(manager))
		browser.DELETE("/sessions/:id", closeSessionHandler(manager))
		browser.GET("/sessions/:id", getSessionHandler(manager))
		browser.POST("/sessions/:id/navigate", navigateHandler(manager))
		browser.GET("/sessions/:id/snapshot", snapshotHandler(manager))
		browser.GET("/sessions/:id/info", cdpInfoHandler(manager))
		browser.GET("/sessions/:id/cdp", cdpProxyWSHandler(manager))
		browser.GET("/sessions/:id/ws", inputWSHandler(manager))
		whipRoutes(browser, manager)
	}
}

func listSessionsHandler(m *SessionManager) gin.HandlerFunc {
	return func(c *gin.Context) { c.JSON(200, m.ListSessions()) }
}

func createSessionHandler(m *SessionManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		s, err := m.CreateSession()
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		c.JSON(201, s.Info())
	}
}

func getSessionHandler(m *SessionManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		s, ok := m.GetSession(c.Param("id"))
		if !ok {
			c.JSON(404, gin.H{"error": "session not found"})
			return
		}
		c.JSON(200, s.Info())
	}
}

func closeSessionHandler(m *SessionManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		if err := m.DeleteSession(c.Param("id")); err != nil {
			c.JSON(404, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, gin.H{"message": "closed"})
	}
}

func navigateHandler(m *SessionManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		s, ok := m.GetSession(c.Param("id"))
		if !ok {
			c.JSON(404, gin.H{"error": "session not found"})
			return
		}
		var req struct {
			URL string `json:"url" binding:"required"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(400, gin.H{"error": "url required"})
			return
		}
		if err := s.Navigate(req.URL); err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		c.JSON(200, s.Info())
	}
}

func snapshotHandler(m *SessionManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		s, ok := m.GetSession(c.Param("id"))
		if !ok {
			c.JSON(404, gin.H{"error": "session not found"})
			return
		}
		buf, err := s.Screenshot()
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		c.Data(200, "image/jpeg", buf)
	}
}

func cdpInfoHandler(m *SessionManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		s, ok := m.GetSession(c.Param("id"))
		if !ok {
			c.JSON(404, gin.H{"error": "session not found"})
			return
		}
		info := s.Info()
		host := c.Request.Host
		c.JSON(200, gin.H{
			"id":            info.ID,
			"status":        info.Status,
			"url":           info.URL,
			"cdp_http_url":  info.CDPURL,
			"cdp_ws_url":    info.CDPWSURL,
			"input_ws_url":  fmt.Sprintf("ws://%s/browser/sessions/%s/ws", host, c.Param("id")),
			"whip_url":      fmt.Sprintf("http://%s/browser/sessions/%s/whip", host, c.Param("id")),
			"snapshot_url":  fmt.Sprintf("http://%s/browser/sessions/%s/snapshot", host, c.Param("id")),
			"chrome_pid":    info.ChromePID,
			"view_w":        info.ViewW,
			"view_h":        info.ViewH,
		})
	}
}

// cdpProxyWSHandler 将外部 CDP 客户端桥接到 Chrome（使用完整 ws URL）
func cdpProxyWSHandler(m *SessionManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		s, ok := m.GetSession(c.Param("id"))
		if !ok {
			c.JSON(404, gin.H{"error": "session not found"})
			return
		}
		if s.wsURL == "" {
			c.JSON(500, gin.H{"error": "chrome not ready"})
			return
		}

		upgrader := gorilla.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
		clientWS, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}
		defer clientWS.Close()

		chromeWS, _, dialErr := gorilla.DefaultDialer.Dial(s.wsURL, nil)
		if dialErr != nil {
			fmt.Printf("[Browser] CDP dial err: %v\n", dialErr)
			_ = clientWS.WriteMessage(gorilla.CloseMessage, gorilla.FormatCloseMessage(gorilla.ClosePolicyViolation, ""))
			return
		}
		defer chromeWS.Close()

		pipe(clientWS, chromeWS)
	}
}

// inputWSHandler 交互式 WebSocket：鼠标/键盘控制
func inputWSHandler(m *SessionManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		s, ok := m.GetSession(c.Param("id"))
		if !ok {
			c.JSON(404, gin.H{"error": "session not found"})
			return
		}
		upgrader := gorilla.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
		ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			return
		}
		defer ws.Close()

		for {
			msgType, message, err := ws.ReadMessage()
			if err != nil {
				return
			}
			if msgType != gorilla.TextMessage {
				continue
			}
			var msg BrowserInputMsg
			if err := json.Unmarshal(message, &msg); err != nil {
				continue
			}
			if msg.Type == "navigate" {
				go s.Navigate(msg.URL)
				continue
			}
			_ = s.InputEvent(msg)
		}
	}
}

// pipe 在两个 Conn 之间双向转发，阻塞直到任一方向出错
func pipe(a, b *gorilla.Conn) {
	errCh := make(chan error, 2)
	go func() {
		for {
			t, m, err := a.ReadMessage()
			if err != nil {
				errCh <- err
				return
			}
			if werr := b.WriteMessage(t, m); werr != nil {
				errCh <- werr
				return
			}
		}
	}()
	go func() {
		for {
			t, m, err := b.ReadMessage()
			if err != nil {
				errCh <- err
				return
			}
			if werr := a.WriteMessage(t, m); werr != nil {
				errCh <- werr
				return
			}
		}
	}()
	<-errCh
}

// contextWithCancel 为 Request context 创建可取消副本
func contextWithCancel(parent context.Context) (context.Context, context.CancelFunc) {
	// 使用标准库 context.WithCancel，parent 来自 gin context
	return nil, nil // simplified: use gin's request context directly
}
