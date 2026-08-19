package websocket

import (
	"encoding/json"
	"net/http"
	"os"
	"os/exec"
	"sync"
	"syscall"

	"github.com/creack/pty"
	"github.com/gin-gonic/gin"
	gorilla "github.com/gorilla/websocket"
)

var terminalUpgrader = gorilla.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// ============================================================
// WebSocket -> Terminal message
// ============================================================

type TerminalMessage struct {
	Type string `json:"type"`

	Data string `json:"data"`

	Cols uint16 `json:"cols"`
	Rows uint16 `json:"rows"`
}

// ============================================================
// Terminal
//
// 每次调用 Terminal：
//
// WebSocket
//     ↓
// PTY
//     ↓
// /bin/bash -l
//
// WebSocket 关闭：
//     ↓
// PTY 关闭
//     ↓
// bash session 销毁
//
// 下一次重新打开 Terminal：
//     ↓
// 全新的 bash session
// ============================================================

func Terminal(c *gin.Context) {

	// ========================================================
	// WebSocket Upgrade
	// ========================================================

	ws, err := terminalUpgrader.Upgrade(
		c.Writer,
		c.Request,
		nil,
	)

	if err != nil {
		return
	}

	defer ws.Close()

	// ========================================================
	// 创建新的 bash
	// ========================================================

	cmd := exec.Command(
		"/bin/bash",
		"-l",
	)

	// 保留当前环境变量
	cmd.Env = os.Environ()

	// 创建独立 session
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setsid: true,
	}

	// ========================================================
	// 创建 PTY
	// ========================================================

	ptmx, err := pty.Start(cmd)

	if err != nil {

		_ = ws.WriteMessage(
			gorilla.TextMessage,
			[]byte(
				"\r\nFailed to start terminal: "+
					err.Error()+
					"\r\n",
			),
		)

		return
	}

	// 最终一定关闭 PTY
	defer ptmx.Close()

	// ========================================================
	// WebSocket 写锁
	// ========================================================

	var wsWriteMu sync.Mutex

	writeWS := func(
		messageType int,
		data []byte,
	) error {

		wsWriteMu.Lock()
		defer wsWriteMu.Unlock()

		return ws.WriteMessage(
			messageType,
			data,
		)
	}

	// ========================================================
	// PTY -> WebSocket
	// ========================================================

	ptyDone := make(chan struct{})

	go func() {

		defer close(ptyDone)

		buf := make([]byte, 8192)

		for {

			n, err := ptmx.Read(buf)

			if n > 0 {

				if err := writeWS(
					gorilla.BinaryMessage,
					buf[:n],
				); err != nil {

					return
				}
			}

			if err != nil {
				return
			}
		}

	}()

	// ========================================================
	// WebSocket -> PTY
	// ========================================================

	readDone := make(chan struct{})

	go func() {

		defer close(readDone)

		for {

			messageType, message, err :=
				ws.ReadMessage()

			if err != nil {
				return
			}

			if messageType != gorilla.TextMessage &&
				messageType != gorilla.BinaryMessage {

				continue
			}

			// ==================================================
			// 解析消息
			// ==================================================

			var msg TerminalMessage

			if err := json.Unmarshal(
				message,
				&msg,
			); err != nil {

				/*
				 * 兼容旧客户端：
				 *
				 * 如果不是 JSON，
				 * 就直接当成终端输入。
				 */

				if len(message) > 0 {

					_, _ = ptmx.Write(
						message,
					)

				}

				continue
			}

			// ==================================================
			// INPUT
			// ==================================================

			if msg.Type == "input" {

				if msg.Data == "" {
					continue
				}

				/*
				 * 注意：
				 *
				 * 这里直接写入 PTY。
				 *
				 * 所以：
				 *
				 * Ctrl+C
				 * Ctrl+D
				 * Ctrl+Z
				 * ESC
				 * F1-F12
				 * Backspace
				 * Enter
				 *
				 * 都会正常进入 Linux PTY。
				 */

				_, err = ptmx.Write(
					[]byte(msg.Data),
				)

				if err != nil {
					return
				}

				continue
			}

			// ==================================================
			// RESIZE
			// ==================================================

			if msg.Type == "resize" {

				if msg.Cols == 0 ||
					msg.Rows == 0 {

					continue
				}

				/*
				 * 只改变 PTY 大小。
				 *
				 * 不发送给 bash。
				 */

				err := pty.Setsize(
					ptmx,
					&pty.Winsize{
						Cols: msg.Cols,
						Rows: msg.Rows,
					},
				)

				if err != nil {
					continue
				}

				continue
			}
		}

	}()

	// ========================================================
	// 等待
	//
	// 两种情况：
	//
	// 1. bash 退出
	// 2. WebSocket 断开
	// ========================================================

	select {

	case <-ptyDone:

		// bash / PTY 已退出

	case <-readDone:

		// 浏览器关闭 WebSocket
	}

	// ========================================================
	// 销毁整个 bash session
	// ========================================================

	if cmd.Process != nil {

		/*
		 * 因为 Setsid=true，
		 *
		 * bash PID
		 * =
		 * session leader
		 * =
		 * process group leader
		 *
		 * 所以使用负 PID：
		 *
		 * -PID
		 *
		 * 可以向整个 process group 发送信号。
		 */

		pgid := -cmd.Process.Pid

		// 先发送 SIGHUP
		_ = syscall.Kill(
			pgid,
			syscall.SIGHUP,
		)

		// 再确保 bash 结束
		_ = cmd.Process.Kill()
	}

	// ========================================================
	// 关闭 PTY
	// ========================================================

	_ = ptmx.Close()
}
