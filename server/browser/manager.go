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
	dataDir  string // 持久化数据目录（相对 server 根目录）
	// 共享 user-data-dir：所有 session 共用同一份浏览器配置、Cookie、LocalStorage
	sharedDataDir     string
	sharedProfileBase string
}

var DefaultManager = &SessionManager{
	sessions:      make(map[string]*Session),
	dataDir:       "./browser/persist", // 持久化数据目录（相对 server 根目录）
	sharedDataDir: "/tmp/linux-panel-browser/shared-user-data",
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

// SessionState 会话状态（持久化）
type SessionState struct {
	ID        string    `json:"id"`
	URL       string    `json:"url"`
	ViewW     int       `json:"view_w"`
	ViewH     int       `json:"view_h"`
	CreatedAt time.Time `json:"created_at"`
}

// Tab 会话内的一个 tab（page target）
type Tab struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	URL      string `json:"url"`
	TargetID string `json:"target_id"`
	// 是否为主 tab（主 tab 是当前激活的 tab，所有导航/截图操作默认作用于主 tab）
	IsActive bool `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

// TabInfo 返回 tab 的公开信息
func (t *Tab) TabInfo() Tab {
	return *t
}

// loadSessionState 加载会话状态
func loadSessionState(dataDir, id string) (*SessionState, error) {
	f := filepath.Join(dataDir, id+".json")
	data, err := os.ReadFile(f)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var state SessionState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}
	return &state, nil
}

// saveSessionState 保存会话状态
func saveSessionState(dataDir, id string, state *SessionState) error {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return fmt.Errorf("mkdir data dir: %w", err)
	}
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dataDir, id+".json"), data, 0644)
}

// CreateSession 启动一个新的 Headless Chrome 实例
// 所有 session 共享同一份 user-data-dir（同一份 Cookie/LocalStorage/历史）
// 每个 session 在共享 profile 下使用独立的 --profile-directory 子目录（避免多进程冲突）
// profile 目录命名：shared-user-data/Profile1 / Profile2 / ...
func (m *SessionManager) CreateSession() (*Session, error) {
	id := uuid.New().String()
	profileIdx := m.nextID.Add(1)
	sharedProfileDir := filepath.Join(m.sharedDataDir, fmt.Sprintf("Profile%d", profileIdx))

	if err := os.MkdirAll(sharedProfileDir, 0755); err != nil {
		return nil, fmt.Errorf("create shared profile dir: %w", err)
	}

	s := NewSession(id, sharedProfileDir)
	m.mu.Lock()
	m.sessions[id] = s
	m.mu.Unlock()

	if err := s.Start(); err != nil {
		m.mu.Lock()
		delete(m.sessions, id)
		m.mu.Unlock()
		return nil, err
	}

	// 加载并恢复会话状态
	if state, err := loadSessionState(m.dataDir, id); err == nil && state != nil {
		s.restoreState(state)
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

// CleanupOldSessions 清理上次运行残留的 Chrome 进程和共享 profile 目录
func (m *SessionManager) CleanupOldSessions() {
	killOrphanChrome(m.sharedDataDir)
	if err := os.RemoveAll(m.sharedDataDir); err != nil {
		fmt.Printf("[Browser] cleanup shared data err: %v\n", err)
	}
}

// killOrphanChrome 杀死 user-data-dir 位于 sharedDataDir 下的残留 Chrome 进程
func killOrphanChrome(sharedDataDir string) {
	procs, err := os.ReadDir("/proc")
	if err != nil {
		return
	}
	needle := "--user-data-dir=" + sharedDataDir
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
		args := strings.ReplaceAll(string(cmdline), "\x00", " ")
		if strings.Contains(args, needle) {
			if proc, err := os.FindProcess(pid); err == nil {
				_ = proc.Kill()
			}
		}
	}
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

// Session 代表一个独立的 Headless Chrome 实例（内含多个 tab）
type Session struct {
	ID         string
	CreatedAt  time.Time
	ProfileDir string
	Port       int
	wsURL      string // 完整的 DevTools 浏览器级 ws URL
	CurrentURL string
	ViewW      int
	ViewH      int

	tabs    map[string]*Tab       // 所有 tab，key 为 targetId
	cmd     *exec.Cmd
	cancel  context.CancelFunc
	closed  bool
	mu      sync.RWMutex
	cached  cacheEntry // 5 秒内的 DOM/text 缓存，避免重复连接 Chrome
}

// cacheEntry 缓存条目
type cacheEntry struct {
	html      string // browser_dom 结果
	text      string // browser_text 结果
	pageURL   string
	expiresAt time.Time
}

func (c *cacheEntry) isExpired() bool {
	return time.Now().After(c.expiresAt)
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
	s := &Session{
		ID:         id,
		CreatedAt:  time.Now(),
		ProfileDir: profileDir,
		tabs:       make(map[string]*Tab),
	}
	// 初始化主 tab（after:blank）
	s.mu.Lock()
	mainTab := &Tab{
		ID:       id + "-main",
		Title:    "空白页",
		URL:      "about:blank",
		IsActive: true,
		CreatedAt: time.Now(),
	}
	s.tabs[mainTab.ID] = mainTab
	s.mu.Unlock()
	return s
}

// restoreState 恢复会话状态（持久化的 URL、viewport）
func (s *Session) restoreState(state *SessionState) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.CurrentURL = state.URL
	s.ViewW = state.ViewW
	s.ViewH = state.ViewH
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
		return fmt.Errorf("parse devtools url: %w", err)
	}
	s.wsURL = wsURL

	// 解析端口
	parsed, err := parsePortFromURL(wsURL)
	if err != nil {
		_ = cmd.Process.Kill()
		cancel()
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

// Stop 停止 Chrome（保留 profile 目录实现持久化）
func (s *Session) Stop() error {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil
	}
	s.closed = true
	cancel := s.cancel
	cmd := s.cmd
	url := s.CurrentURL
	viewW := s.ViewW
	viewH := s.ViewH
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

	// 保存会话状态（持久化）
	state := &SessionState{
		ID:        s.ID,
		URL:       url,
		ViewW:     viewW,
		ViewH:     viewH,
		CreatedAt: s.CreatedAt,
	}
	if err := saveSessionState(DefaultManager.dataDir, s.ID, state); err != nil {
		fmt.Printf("[Browser] save state err: %v\n", err)
	}

	// 保留 profile 目录：不再删除，Cookie/LocalStorage/历史均被持久化
	// _ = os.RemoveAll(s.ProfileDir)
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

// pageTargets 列出所有 page target（用于多 tab 管理）
func (s *Session) pageTargets() ([]struct {
	TargetID string `json:"targetId"`
	Type     string `json:"type"`
	Title    string `json:"title"`
	URL      string `json:"url"`
}, error) {
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(fmt.Sprintf("http://127.0.0.1:%d/json/list", s.Port))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	var targets []struct {
		TargetID string `json:"targetId"`
		Type     string `json:"type"`
		Title    string `json:"title"`
		URL      string `json:"url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&targets); err != nil {
		return nil, err
	}
	var result []struct {
		TargetID string `json:"targetId"`
		Type     string `json:"type"`
		Title    string `json:"title"`
		URL      string `json:"url"`
	}
	for _, t := range targets {
		if t.Type == "page" {
			result = append(result, t)
		}
	}
	return result, nil
}

// cdpWSForTab 获取指定 tab 的 CDP ws URL
func (s *Session) cdpWSForTab(tab *Tab) (string, error) {
	if tab == nil {
		return "", fmt.Errorf("no active tab")
	}
	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get(fmt.Sprintf("http://127.0.0.1:%d/json", s.Port))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var targets []struct {
		TargetID             string `json:"targetId"`
		WebSocketDebuggerURL string `json:"webSocketDebuggerUrl"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&targets); err != nil {
		return "", err
	}
	for _, t := range targets {
		if t.TargetID == tab.TargetID {
			return t.WebSocketDebuggerURL, nil
		}
	}
	for _, t := range targets {
		if t.WebSocketDebuggerURL != "" {
			return t.WebSocketDebuggerURL, nil
		}
	}
	return "", fmt.Errorf("no cdp ws url for tab %s", tab.ID)
}

// CreateTab 在当前 session 创建一个新 tab
func (s *Session) CreateTab(url string) (*Tab, error) {
	s.mu.Lock()
	closed := s.closed
	s.mu.Unlock()
	if closed {
		return nil, fmt.Errorf("session is closed")
	}

	// 通过浏览器级 CDP 创建新 page
	httpClient := &http.Client{Timeout: 15 * time.Second}
	createURL := fmt.Sprintf("http://127.0.0.1:%d/json/new?%s", s.Port, "url="+url)
	req, err := http.NewRequest("GET", createURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	location := resp.Header.Get("Location")
	wsURL := ""
	if location != "" {
		// 返回格式：ws://127.0.0.1:xxxxx/devtools/page/xxxxx
		_, rest, ok := strings.Cut(location, "devtools/page/")
		if ok {
			wsURL = rest
		}
	}
	if wsURL == "" {
		return nil, fmt.Errorf("failed to create tab: no target id in location: %s", location)
	}
	targetID := wsURL

	s.mu.Lock()
	defer s.mu.Unlock()

	// 更新已有 tab 的活跃状态
	for _, tab := range s.tabs {
		tab.IsActive = false
	}

	tab := &Tab{
		ID:       targetID,
		Title:    "空白页",
		URL:      url,
		TargetID: targetID,
		IsActive: true,
		CreatedAt: time.Now(),
	}
	s.tabs[targetID] = tab
	s.CurrentURL = url

	return tab, nil
}

// SwitchTab 切换到指定 tab
func (s *Session) SwitchTab(targetID string) error {
	s.mu.Lock()
	tab, ok := s.tabs[targetID]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("tab not found: %s", targetID)
	}
	// 更新已有 tab 的活跃状态
	for _, t := range s.tabs {
		t.IsActive = false
	}
	tab.IsActive = true
	s.CurrentURL = tab.URL
	s.mu.Unlock()

	// 激活该 tab
	httpClient := &http.Client{Timeout: 15 * time.Second}
	activateURL := fmt.Sprintf("http://127.0.0.1:%d/json/activate/%s", s.Port, targetID)
	req, err := http.NewRequest("GET", activateURL, nil)
	if err != nil {
		return err
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	_ = resp.Body.Close()
	return nil
}

// CloseTab 关闭指定 tab
func (s *Session) CloseTab(targetID string) error {
	s.mu.Lock()
	tab, ok := s.tabs[targetID]
	if !ok {
		s.mu.Unlock()
		return fmt.Errorf("tab not found: %s", targetID)
	}
	// 如果是主 tab，不能直接删，保留主 tab
	delete(s.tabs, targetID)
	// 重新激活一个 tab
	for _, t := range s.tabs {
		if t != tab {
			t.IsActive = true
			s.CurrentURL = t.URL
			break
		}
	}
	s.mu.Unlock()

	// 通过 CDP 关闭目标
	httpClient := &http.Client{Timeout: 15 * time.Second}
	closeURL := fmt.Sprintf("http://127.0.0.1:%d/json/close/%s", s.Port, targetID)
	req, err := http.NewRequest("GET", closeURL, nil)
	if err != nil {
		return err
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	_ = resp.Body.Close()
	return nil
}

// ListTabs 列出当前 session 的所有 tab
func (s *Session) ListTabs() []*Tab {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*Tab, 0, len(s.tabs))
	for _, tab := range s.tabs {
		// 刷新每个 tab 的标题和 URL
		result = append(result, tab)
	}
	return result
}

// MainTab 获取当前活跃 tab（主 tab）
func (s *Session) MainTab() *Tab {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, tab := range s.tabs {
		if tab.IsActive {
			return tab
		}
	}
	return nil
}

// getDOM 获取页面 DOM（5 秒内返回缓存，避免重复连接 Chrome）
func (s *Session) getDOM() (string, error) {
	tab := s.MainTab()
	if tab == nil {
		return "", fmt.Errorf("no active tab")
	}
	wsURL, err := s.cdpWSForTab(tab)
	if err != nil {
		return "", err
	}
	conn, err := dialCDP(wsURL, 5*time.Second)
	if err != nil {
		return "", err
	}
	defer conn.Close()
	var res struct {
		Result struct {
			Value string `json:"value"`
		} `json:"result"`
	}
	if err := conn.Call("Runtime.evaluate", map[string]interface{}{
		"expression":  "document.documentElement.outerHTML",
		"returnByValue": true,
	}, &res, 8*time.Second); err != nil {
		return "", err
	}
	html := res.Result.Value
	const maxLen = 8000
	if len(html) > maxLen {
		html = html[:maxLen] + "\n... (truncated)"
	}
	s.mu.Lock()
	s.cached = cacheEntry{
		html:      html,
		pageURL:   s.CurrentURL,
		expiresAt: time.Now().Add(5 * time.Second),
	}
	s.mu.Unlock()
	return html, nil
}

// getText 获取页面可见文本（5 秒内返回缓存）
func (s *Session) getText() (string, error) {
	tab := s.MainTab()
	if tab == nil {
		return "", fmt.Errorf("no active tab")
	}
	wsURL, err := s.cdpWSForTab(tab)
	if err != nil {
		return "", err
	}
	conn, err := dialCDP(wsURL, 5*time.Second)
	if err != nil {
		return "", err
	}
	defer conn.Close()
	var res struct {
		Result struct {
			Value string `json:"value"`
		} `json:"result"`
	}
	if err := conn.Call("Runtime.evaluate", map[string]interface{}{
		"expression":  "document.body.innerText",
		"returnByValue": true,
	}, &res, 8*time.Second); err != nil {
		return "", err
	}
	s.mu.Lock()
	s.cached = cacheEntry{
		text:      res.Result.Value,
		pageURL:   s.CurrentURL,
		expiresAt: time.Now().Add(5 * time.Second),
	}
	s.mu.Unlock()
	return res.Result.Value, nil
}

// Navigate 导航到指定 URL（作用于当前活跃 tab）
func (s *Session) Navigate(targetURL string) error {
	tab := s.MainTab()
	if tab == nil {
		return fmt.Errorf("no active tab")
	}
	wsURL, err := s.cdpWSForTab(tab)
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
	if tab != nil {
		tab.URL = targetURL
	}
	s.mu.Unlock()
	// 导航后注入元素 ID，方便 AI 通过 @a/@b 等点击
	time.Sleep(500 * time.Millisecond)
	_ = s.injectElementIds()
	// 清除 DOM 缓存（页面已变化）
	s.mu.Lock()
	s.cached = cacheEntry{}
	s.mu.Unlock()
	return nil
}

// injectElementIds 为页面上所有可交互元素分配唯一 ID（@a, @b, @c...）
func (s *Session) injectElementIds() error {
	tab := s.MainTab()
	if tab == nil {
		return fmt.Errorf("no active tab")
	}
	wsURL, err := s.cdpWSForTab(tab)
	if err != nil {
		return err
	}
	conn, err := dialCDP(wsURL, 5*time.Second)
	if err != nil {
		return err
	}
	defer conn.Close()
	var res struct {
		Result struct {
			Value string `json:"value"`
		} `json:"result"`
	}
	expr := `
		(function(){
			var i = 0;
			var tags = 'button,a,input,select,textarea,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[type="submit"],[type="button"],[type="reset"],details,summary';
			document.querySelectorAll(tags).forEach(function(el){
				if(el.id && el.id.startsWith('@')) return;
				el.id = '@' + (i++);
			});
			return i + ' elements tagged';
		})()
	`
	if err := conn.Call("Runtime.evaluate", map[string]interface{}{
		"expression": expr,
		"returnByValue": true,
	}, &res, 5*time.Second); err != nil {
		return err
	}
	return nil
}

// Screenshot 返回当前页面（主 tab）JPEG 截图
func (s *Session) Screenshot() ([]byte, error) {
	tab := s.MainTab()
	if tab == nil {
		return nil, fmt.Errorf("no active tab")
	}
	wsURL, err := s.cdpWSForTab(tab)
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

// InputEvent 处理输入事件（作用于当前活跃 tab）
func (s *Session) InputEvent(msg BrowserInputMsg) error {
	tab := s.MainTab()
	if tab == nil {
		return fmt.Errorf("no active tab")
	}
	wsURL, err := s.cdpWSForTab(tab)
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
