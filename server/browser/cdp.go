package browser

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	gorilla "github.com/gorilla/websocket"
)

// cdpMessage CDP 协议消息
type cdpMessage struct {
	ID     int             `json:"id,omitempty"`
	Method string          `json:"method,omitempty"`
	Params json.RawMessage `json:"params,omitempty"`
	Result json.RawMessage `json:"result,omitempty"`
	Error  *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// cdpConn 单个 CDP WebSocket 连接
type cdpConn struct {
	ws      *gorilla.Conn
	writeMu sync.Mutex
	idMu    sync.Mutex
	nextID  int
}

func dialCDP(wsURL string, timeout time.Duration) (*cdpConn, error) {
	dialer := gorilla.Dialer{HandshakeTimeout: timeout}
	ws, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		return nil, err
	}
	ws.SetReadLimit(100 * 1024 * 1024)
	return &cdpConn{ws: ws}, nil
}

func (c *cdpConn) Close() error {
	return c.ws.Close()
}

// nextRequestID 返回下一个请求 ID
func (c *cdpConn) nextRequestID() int {
	c.idMu.Lock()
	defer c.idMu.Unlock()
	c.nextID++
	return c.nextID
}

// Call 发送 CDP 命令并等待对应响应（跳过事件）
func (c *cdpConn) Call(method string, params, out interface{}, timeout time.Duration) error {
	id := c.nextRequestID()
	msg := cdpMessage{ID: id, Method: method}
	if params != nil {
		b, err := json.Marshal(params)
		if err != nil {
			return err
		}
		msg.Params = b
	}

	c.writeMu.Lock()
	err := c.ws.WriteJSON(msg)
	c.writeMu.Unlock()
	if err != nil {
		return err
	}

	_ = c.ws.SetReadDeadline(time.Now().Add(timeout))
	for {
		var resp cdpMessage
		if err := c.ws.ReadJSON(&resp); err != nil {
			return err
		}
		if resp.ID != id {
			continue
		}
		if resp.Error != nil {
			return fmt.Errorf("cdp %s: %s", method, resp.Error.Message)
		}
		if out != nil && len(resp.Result) > 0 {
			return json.Unmarshal(resp.Result, out)
		}
		return nil
	}
}

// SetReadDeadline 设置读超时
func (c *cdpConn) SetReadDeadline(t time.Time) error {
	return c.ws.SetReadDeadline(t)
}
