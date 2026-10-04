package browser

import (
	"bufio"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
)

// SessionManager 管理所有 Browser Session
type SessionManager struct {
	mu       sync.RWMutex
	sessions map[string]*Session
	nextID   atomic.Int64
}

var DefaultManager = &SessionManager{
	sessions: make(map[string]*Session),
}

// BrowserInputMsg 输入消息结构（由前端 WebSocket 发送）
type BrowserInputMsg struct {
	Type  string  `json:"type"`
	URL   string  `json:"url,omitempty"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Key   string  `json:"key,omitempty"`
	Code  string  `json:"code,omitempty"`
	Delta int     `json:"delta,omitempty"`
}

// Info 对外暴露的 Session 信息
type Info struct {
	ID         string `json:"id"`
	Status     string `json:"status"`
	URL        string `json:"url"`
	CDPURL     string `json:"cdp_url"`
	CDPWSURL   string `json:"cdp_ws_url"`
	StreamURL  string `json:"stream_url"`
	ChromePID  int    `json:"chrome_pid"`
	ViewW      int    `json:"view_w"`
	ViewH      int    `json:"view_h"`
}

// CreateSession 启动一个新的 Headless Chrome 实例
func (m *SessionManager) CreateSession() (*Session, error) {
	id := uuid.New().String()
	idx := m.nextID.Add(1)
	profileDir := filepath.Join("/tmp", "linux-panel-browser", fmt.Sprintf("%s-%d", id, idx))

	if err := os.MkdirAll(profileDir, 0755); err != nil {
		return nil, fmt.Errorf("create profile dir: %w", err)
	}

	s := NewSession(id, profileDir)
	m.mu.Lock()
	m.sessions[id] = s
	m.mu.Unlock()

	if err := s.Start(); err != nil {
		m.mu.Lock()
		delete(m.sessions, id)
		m.mu.Unlock()
		return nil, err
	}

	return s, nil
}

// GetSession 获取 Session
func (m *SessionManager) GetSession(id string) (*Session, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.sessions[id]
	return s, ok
}

// ListSessions 返回所有 Session 信息
func (m *SessionManager) ListSessions() []Info {
	m.mu.RLock()
	defer m.mu.RUnlock()
	infos := make([]Info, 0, len(m.sessions))
	for _, s := range m.sessions {
		infos = append(infos, s.Info())
	}
	return infos
}

// DeleteSession 停止并清理 Session
func (m *SessionManager) DeleteSession(id string) error {
	m.mu.Lock()
	s, ok := m.sessions[id]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("session not found: %s", id)
	}
	delete(m.sessions, id)
	m.mu.Unlock()
	return s.Stop()
}

// CleanupOldSessions 清理上次运行残留的 Chrome 进程和 profile 目录
// 在 Panel 启动时调用，避免 SIGKILL 等异常退出留下孤儿进程
func (m *SessionManager) CleanupOldSessions() {
	root := filepath.Join("/tmp", "linux-panel-browser")

	// 先杀掉 user-data-dir 指向我们 profile 根目录的 Chrome 进程
	killOrphanChrome(root)

	entries, err := os.ReadDir(root)
	if err != nil {
		return
	}
	for _, entry := range entries {
		if entry.IsDir() {
			_ = os.RemoveAll(filepath.Join(root, entry.Name()))
		}
	}
}

// killOrphanChrome 杀死 user-data-dir 位于 root 下的残留 Chrome 进程
func killOrphanChrome(root string) {
	procs, err := os.ReadDir("/proc")
	if err != nil {
		return
	}
	needle := "--user-data-dir=" + root
	for _, p := range procs {
		if !p.IsDir() {
			continue
		}
		pid, err := strconv.Atoi(p.Name())
		if err != nil {
			continue
		}
		cmdline, err := os.ReadFile(filepath.Join("/proc", p.Name(), "cmdline"))
		if err != nil {
			continue
		}
		// cmdline 以 NUL 分隔
		args := strings.ReplaceAll(string(cmdline), "\x00", " ")
		if strings.Contains(args, needle) {
			if proc, err := os.FindProcess(pid); err == nil {
				_ = proc.Kill()
			}
		}
	}
}

// Shutdown 关闭所有 Session（Panel 退出时调用）
func (m *SessionManager) Shutdown() {
	m.mu.Lock()
	sessions := make([]*Session, 0, len(m.sessions))
	for id, s := range m.sessions {
		sessions = append(sessions, s)
		delete(m.sessions, id)
	}
	m.mu.Unlock()

	var wg sync.WaitGroup
	for _, s := range sessions {
		wg.Add(1)
		go func(sess *Session) {
			defer wg.Done()
			_ = sess.Stop()
		}(s)
	}
	wg.Wait()
}

// ============================================================
// Session
// ============================================================

// Session 代表一个独立的 Headless Chrome 实例
type Session struct {
	ID         string
	CreatedAt  time.Time
	ProfileDir string
	Port       int
	wsURL      string // 完整的 DevTools 浏览器级 ws URL
	CurrentURL string
	ViewW      int
	ViewH      int

	cmd    *exec.Cmd
	cancel context.CancelFunc
	closed bool
	mu     sync.Mutex
}

// Info 返回公开信息
func (s *Session) Info() Info {
	s.mu.Lock()
	defer s.mu.Unlock()
	status := "stopped"
	if s.cmd != nil && s.cmd.ProcessState == nil {
		status = "running"
	}
	return Info{
		ID:        s.ID,
		Status:    status,
		URL:       s.CurrentURL,
		CDPURL:    fmt.Sprintf("http://127.0.0.1:%d", s.Port),
		CDPWSURL:  s.wsURL,
		StreamURL: "",
		ChromePID: pidOf(s.cmd),
		ViewW:     s.ViewW,
		ViewH:     s.ViewH,
	}
}

func pidOf(cmd *exec.Cmd) int {
	if cmd == nil || cmd.Process == nil {
		return 0
	}
	return cmd.Process.Pid
}

// NewSession 构造函数
func NewSession(id, profileDir string) *Session {
	return &Session{
		ID:         id,
		CreatedAt:  time.Now(),
		ProfileDir: profileDir,
	}
}

// Start 启动 Headless Chrome（browser-lab 风格：手动进程 + stderr 解析 ws URL）
func (s *Session) Start() error {
	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel

	chromePath, err := findBrowserExecutable()
	if err != nil {
		cancel()
		return fmt.Errorf("find browser: %w", err)
	}

	args := []string{
		"--headless=new",
		"--no-sandbox",
		"--disable-gpu",
		"--disable-dev-shm-usage",
		"--disable-extensions",
		"--disable-popup-blocking",
		"--mute-audio",
		"--no-first-run",
		"--disable-setuid-sandbox",
		"--remote-debugging-port=0",
		"--remote-allow-origins=*",
		fmt.Sprintf("--user-data-dir=%s", s.ProfileDir),
		"--window-size=1920,1080",
		"about:blank",
	}

	cmd := exec.CommandContext(ctx, chromePath, args...)
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return fmt.Errorf("stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		cancel()
		return fmt.Errorf("start chrome: %w", err)
	}
	s.cmd = cmd

	wsURL, err := parseDevToolsURL(stderr, 15*time.Second)
	if err != nil {
		_ = cmd.Process.Kill()
		cancel()
		_ = os.RemoveAll(s.ProfileDir)
		return fmt.Errorf("parse devtools url: %w", err)
	}
	s.wsURL = wsURL

	// 解析端口
	parsed, err := parsePortFromURL(wsURL)
	if err != nil {
		_ = cmd.Process.Kill()
		cancel()
		_ = os.RemoveAll(s.ProfileDir)
		return fmt.Errorf("parse port: %w", err)
	}
	s.Port = parsed

	s.mu.Lock()
	s.CurrentURL = "about:blank"
	s.ViewW = 1920
	s.ViewH = 1080
	s.mu.Unlock()

	return nil
}

// Stop 停止 Chrome 并清理资源
func (s *Session) Stop() error {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil
	}
	s.closed = true
	cancel := s.cancel
	cmd := s.cmd
	s.mu.Unlock()

	if cancel != nil {
		cancel()
	}
	if cmd != nil && cmd.Process != nil {
		done := make(chan struct{})
		go func() { cmd.Wait(); close(done) }()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			_ = cmd.Process.Kill()
			<-done
		}
	}
	_ = os.RemoveAll(s.ProfileDir)
	return nil
}

// IsClosed 判断 session 是否已关闭
func (s *Session) IsClosed() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.closed
}

// pageWSURL 查询第一个 page 目标的 CDP ws URL
func (s *Session) pageWSURL() (string, error) {
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(fmt.Sprintf("http://127.0.0.1:%d/json", s.Port))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var targets []struct {
		Type                 string `json:"type"`
		WebSocketDebuggerURL string `json:"webSocketDebuggerUrl"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&targets); err != nil {
		return "", err
	}
	for _, t := range targets {
		if t.Type == "page" && t.WebSocketDebuggerURL != "" {
			return t.WebSocketDebuggerURL, nil
		}
	}
	return "", fmt.Errorf("no page target")
}

// Navigate 导航到指定 URL
func (s *Session) Navigate(targetURL string) error {
	wsURL, err := s.pageWSURL()
	if err != nil {
		return err
	}
	conn, err := dialCDP(wsURL, 5*time.Second)
	if err != nil {
		return err
	}
	defer conn.Close()

	var res struct{}
	if err := conn.Call("Page.navigate", map[string]interface{}{"url": targetURL}, &res, 10*time.Second); err != nil {
		return err
	}
	s.mu.Lock()
	s.CurrentURL = targetURL
	s.mu.Unlock()
	return nil
}

// Screenshot 返回当前页面 JPEG 截图
func (s *Session) Screenshot() ([]byte, error) {
	wsURL, err := s.pageWSURL()
	if err != nil {
		return nil, err
	}
	conn, err := dialCDP(wsURL, 5*time.Second)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	var res struct {
		Data string `json:"data"`
	}
	if err := conn.Call("Page.captureScreenshot", map[string]interface{}{
		"format":  "jpeg",
		"quality": 80,
	}, &res, 10*time.Second); err != nil {
		return nil, err
	}
	return base64.StdEncoding.DecodeString(res.Data)
}

// InputEvent 处理输入事件
func (s *Session) InputEvent(msg BrowserInputMsg) error {
	wsURL, err := s.pageWSURL()
	if err != nil {
		return err
	}
	conn, err := dialCDP(wsURL, 5*time.Second)
	if err != nil {
		return err
	}
	defer conn.Close()

	switch msg.Type {
	case "mousedown":
		return conn.Call("Input.dispatchMouseEvent", map[string]interface{}{
			"type":       "mousePressed",
			"x":          msg.X,
			"y":          msg.Y,
			"button":     "left",
			"clickCount": 1,
		}, nil, 2*time.Second)
	case "mouseup":
		return conn.Call("Input.dispatchMouseEvent", map[string]interface{}{
			"type":       "mouseReleased",
			"x":          msg.X,
			"y":          msg.Y,
			"button":     "left",
			"clickCount": 1,
		}, nil, 2*time.Second)
	case "mousemove":
		return conn.Call("Input.dispatchMouseEvent", map[string]interface{}{
			"type": "mouseMoved",
			"x":    msg.X,
			"y":    msg.Y,
		}, nil, 2*time.Second)
	case "wheel":
		return conn.Call("Input.dispatchMouseEvent", map[string]interface{}{
			"type":   "mouseWheel",
			"x":      msg.X,
			"y":      msg.Y,
			"deltaX": 0,
			"deltaY": float64(msg.Delta),
		}, nil, 2*time.Second)
	case "keydown":
		params := buildKeyParams("rawKeyDown", msg.Key, msg.Code)
		if err := conn.Call("Input.dispatchKeyEvent", params, nil, 2*time.Second); err != nil {
			return err
		}
		if len(msg.Key) == 1 {
			params["type"] = "char"
			params["text"] = msg.Key
			params["unmodifiedText"] = msg.Key
			return conn.Call("Input.dispatchKeyEvent", params, nil, 2*time.Second)
		}
		return nil
	case "keyup":
		return conn.Call("Input.dispatchKeyEvent", buildKeyParams("keyUp", msg.Key, msg.Code), nil, 2*time.Second)
	}
	return nil
}

func buildKeyParams(keyType, key, code string) map[string]interface{} {
	params := map[string]interface{}{
		"type": keyType,
		"key":  key,
	}
	if code != "" {
		params["code"] = code
	}
	if len(key) == 1 {
		params["text"] = key
		params["unmodifiedText"] = key
		params["windowsVirtualKeyCode"] = uint8(key[0])
		params["nativeVirtualKeyCode"] = uint8(key[0])
	} else {
		params["windowsVirtualKeyCode"] = keyToVKCode(key)
		params["nativeVirtualKeyCode"] = keyToVKCode(key)
	}
	return params
}

func keyToVKCode(key string) int {
	switch key {
	case "Escape":
		return 0x1B
	case "Enter":
		return 0x0D
	case "Tab":
		return 0x09
	case "Backspace":
		return 0x08
	case "Delete":
		return 0x2E
	case "Insert":
		return 0x2D
	case "ArrowDown":
		return 0x28
	case "ArrowUp":
		return 0x26
	case "ArrowLeft":
		return 0x25
	case "ArrowRight":
		return 0x27
	case "Home":
		return 0x24
	case "End":
		return 0x23
	case "PageUp":
		return 0x21
	case "PageDown":
		return 0x22
	case "CapsLock":
		return 0x14
	case "ScrollLock":
		return 0x91
	case "NumLock":
		return 0x90
	case "PrintScreen":
		return 0x2C
	case "Pause":
		return 0x13
	case "F1":
		return 0x70
	case "F2":
		return 0x71
	case "F3":
		return 0x72
	case "F4":
		return 0x73
	case "F5":
		return 0x74
	case "F6":
		return 0x75
	case "F7":
		return 0x76
	case "F8":
		return 0x77
	case "F9":
		return 0x78
	case "F10":
		return 0x79
	case "F11":
		return 0x7A
	case "F12":
		return 0x7B
	case "Control":
		return 0x11
	case "Alt":
		return 0x12
	case "Shift":
		return 0x10
	case "Meta":
		return 0x5B
	}
	return 0
}

// Viewport 通过 Runtime.evaluate 获取视口尺寸
func (s *Session) Viewport() (int, int, error) {
	wsURL, err := s.pageWSURL()
	if err != nil {
		return 0, 0, err
	}
	conn, err := dialCDP(wsURL, 5*time.Second)
	if err != nil {
		return 0, 0, err
	}
	defer conn.Close()
	var res struct {
		Result struct {
			Value struct {
				W int `json:"w"`
				H int `json:"h"`
			} `json:"result"`
		} `json:"result"`
	}
	expr := `({w: window.innerWidth, h: window.innerHeight})`
	if err := conn.Call("Runtime.evaluate", map[string]interface{}{
		"expression": expr,
		"returnByValue": true,
	}, &res, 5*time.Second); err != nil {
		return 0, 0, err
	}
	return res.Result.Value.W, res.Result.Value.H, nil
}

// ============================================================
// 工具函数（参照 browser-lab/session/session.go）
// ============================================================

func findBrowserExecutable() (string, error) {
	for _, name := range []string{"google-chrome", "chromium", "chromium-browser", "chrome"} {
		if p, err := exec.LookPath(name); err == nil {
			return p, nil
		}
	}
	return "", fmt.Errorf("no supported browser executable found")
}

func parseDevToolsURL(r io.Reader, timeout time.Duration) (string, error) {
	scanner := bufio.NewScanner(r)
	re := regexp.MustCompile(`DevTools listening on (ws://.+)\n?`)
	ch := make(chan string, 1)

	go func() {
		for scanner.Scan() {
			line := scanner.Text()
			matches := re.FindStringSubmatch(line)
			if len(matches) > 1 {
				ch <- matches[1]
				return
			}
		}
		close(ch)
	}()

	select {
	case url, ok := <-ch:
		if !ok {
			return "", fmt.Errorf("scanner closed without finding url")
		}
		return url, nil
	case <-time.After(timeout):
		return "", fmt.Errorf("timeout waiting for devtools url")
	}
}

func parsePortFromURL(wsURL string) (int, error) {
	// ws://127.0.0.1:33693/devtools/browser/uuid
	re := regexp.MustCompile(`ws://[^:]+:(\d+)/`)
	matches := re.FindStringSubmatch(wsURL)
	if len(matches) > 1 {
		port, err := strconv.Atoi(matches[1])
		return port, err
	}
	return 0, fmt.Errorf("cannot parse port from wsURL: %s", wsURL)
}
