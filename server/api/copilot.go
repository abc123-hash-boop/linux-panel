package api

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"net/http"
	"os/exec"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"panel/database"
)

// CopilotSettingsKey 存储在 settings 表中的 key
const (
	CopilotHistoryKey = "copilot_history"
)

// ============================================================
// Session
// ============================================================

type Session struct {
	ID             int64    `json:"id"`
	Name           string   `json:"name"`
	Model          string   `json:"model"`
	APIKey         string   `json:"api_key"`
	APIBase        string   `json:"api_base"`
	RecallSessions string   `json:"recall_sessions"`
}

func CopilotListSessions(c *gin.Context) {
	rows, err := database.DB.Query("SELECT id, name, model, api_key, api_base, COALESCE(recall_sessions,'') FROM copilot_sessions ORDER BY id")
	if err != nil {
		c.JSON(500, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var s Session
		rows.Scan(&s.ID, &s.Name, &s.Model, &s.APIKey, &s.APIBase, &s.RecallSessions)
		sessions = append(sessions, s)
	}
	c.JSON(200, sessions)
}

func CopilotCreateSession(c *gin.Context) {
	var data struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name required"})
		return
	}
	name := strings.TrimSpace(data.Name)
	if name == "" {
		var cnt int
		database.DB.QueryRow("SELECT COUNT(*) FROM copilot_sessions").Scan(&cnt)
		name = fmt.Sprintf("对话 %d", cnt+1)
	}
	// 继承最后一个会话的配置，如果没有则从 Provider 获取默认值
	var lastBase, lastModel string
	database.DB.QueryRow("SELECT api_base, model FROM copilot_sessions ORDER BY id DESC LIMIT 1").Scan(&lastBase, &lastModel)
	if lastBase == "" {
		// 从第一个 Provider 获取默认 api_base
		var defaultBase string
		database.DB.QueryRow("SELECT api_base FROM copilot_providers LIMIT 1").Scan(&defaultBase)
		if defaultBase != "" {
			lastBase = defaultBase
		} else {
			lastBase = "https://api.openai.com/v1"
		}
	}
	if lastModel == "" {
		// 不默认设置为 gpt-4o，留空让用户自己选择
		lastModel = ""
	}
	id, err := database.DB.Exec("INSERT INTO copilot_sessions(name, model, api_key, api_base, recall_sessions) VALUES(?,?,?,?,?)",
		name, lastModel, "", lastBase, "{}")
	if err != nil {
		c.JSON(500, gin.H{"error": "insert failed"})
		return
	}
	res, _ := id.LastInsertId()
	c.JSON(200, gin.H{"id": res, "name": name, "model": lastModel, "api_base": lastBase, "recall_sessions": "{}"})
}

func CopilotUpdateSession(c *gin.Context) {
	id := c.Param("id")
	var data struct {
		Name           *string `json:"name"`
		Model          *string `json:"model"`
		APIBase        *string `json:"api_base"`
		RecallSessions *string `json:"recall_sessions"`
	}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request"})
		return
	}

	// 只更新非 nil 字段
	sets := []string{}
	args := []interface{}{}
	if data.Name != nil {
		sets = append(sets, "name=?")
		args = append(args, *data.Name)
	}
	if data.Model != nil {
		sets = append(sets, "model=?")
		args = append(args, *data.Model)
	}
	if data.APIBase != nil {
		sets = append(sets, "api_base=?")
		args = append(args, *data.APIBase)
	}
	if data.RecallSessions != nil {
		sets = append(sets, "recall_sessions=?")
		args = append(args, *data.RecallSessions)
	}

	if len(sets) == 0 {
		c.JSON(400, gin.H{"error": "no fields to update"})
		return
	}
	args = append(args, id)
	query := fmt.Sprintf("UPDATE copilot_sessions SET %s WHERE id=?", strings.Join(sets, ", "))
	_, err := database.DB.Exec(query, args...)
	if err != nil {
		c.JSON(500, gin.H{"error": "update failed"})
		return
	}
	c.JSON(200, gin.H{"message": "updated"})
}

func CopilotDeleteSession(c *gin.Context) {
	id := c.Param("id")
	// 先删除该会话的所有消息
	database.DB.Exec("DELETE FROM copilot_messages WHERE session_id=?", id)
	// 再删除会话
	database.DB.Exec("DELETE FROM copilot_sessions WHERE id=?", id)
	c.JSON(200, gin.H{"message": "deleted"})
}

// ============================================================
// Provider + Models (合并)
// ============================================================

type Provider struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	Icon     string `json:"icon"`
	APIBase  string `json:"api_base"`
	APIKey   string `json:"api_key"`
	Models   []ModelItem `json:"models"`
}

type ModelItem struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

func CopilotListProviders(c *gin.Context) {
	rows, err := database.DB.Query("SELECT id, name, icon, api_base, COALESCE(api_key,'') FROM copilot_providers ORDER BY id")
	if err != nil {
		c.JSON(500, gin.H{"error": "db error"})
		return
	}
	defer rows.Close()

	var providers []Provider
	for rows.Next() {
		var p Provider
		rows.Scan(&p.ID, &p.Name, &p.Icon, &p.APIBase, &p.APIKey)
		// 加载该 provider 的 models
		mrows, _ := database.DB.Query("SELECT id, name FROM copilot_models WHERE provider_id=?", p.ID)
		for mrows.Next() {
			var mi ModelItem
			mrows.Scan(&mi.ID, &mi.Name)
			p.Models = append(p.Models, mi)
		}
		mrows.Close()
		providers = append(providers, p)
	}
	c.JSON(200, providers)
}

func CopilotCreateProvider(c *gin.Context) {
	var data struct {
		Name   string `json:"name" binding:"required"`
		Icon   string `json:"icon"`
		APIBase string `json:"api_base" binding:"required"`
		Models []string `json:"models"`
	}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request"})
		return
	}
	res, err := database.DB.Exec("INSERT INTO copilot_providers(name, icon, api_base, api_key) VALUES(?,?,?,?)",
		data.Name, data.Icon, data.APIBase, "")
	if err != nil {
		c.JSON(500, gin.H{"error": "insert failed"})
		return
	}
	provID, _ := res.LastInsertId()
	for _, mname := range data.Models {
		if mname != "" {
			database.DB.Exec("INSERT INTO copilot_models(provider_id, name) VALUES(?,?)", provID, mname)
		}
	}
	c.JSON(200, gin.H{"id": provID, "name": data.Name})
}

func CopilotUpdateProvider(c *gin.Context) {
	id := c.Param("id")
	var data struct {
		Name    string   `json:"name"`
		Icon    string   `json:"icon"`
		APIBase string   `json:"api_base"`
		APIKey  string   `json:"api_key"`
		Models  []string `json:"models"`
	}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request"})
		return
	}
	database.DB.Exec("UPDATE copilot_providers SET name=?, icon=?, api_base=?, api_key=? WHERE id=?",
		data.Name, data.Icon, data.APIBase, data.APIKey, id)
	// 替换 models
	database.DB.Exec("DELETE FROM copilot_models WHERE provider_id=?", id)
	for _, mname := range data.Models {
		if mname != "" {
			database.DB.Exec("INSERT INTO copilot_models(provider_id, name) VALUES(?,?)", id, mname)
		}
	}
	c.JSON(200, gin.H{"message": "updated"})
}

func CopilotDeleteProvider(c *gin.Context) {
	id := c.Param("id")
	database.DB.Exec("DELETE FROM copilot_providers WHERE id=?", id)
	c.JSON(200, gin.H{"message": "deleted"})
}

// ============================================================
// 获取模型列表（后端代理，避免 CORS）
// ============================================================

func CopilotFetchModels(c *gin.Context) {
	var req struct {
		APIBase string `json:"api_base" binding:"required"`
		APIKey  string `json:"api_key"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request"})
		return
	}

	base := strings.TrimRight(req.APIBase, "/")
	modelURL := base + "/v1/models"

	client := &http.Client{}
	httpReq, _ := http.NewRequest("GET", modelURL, nil)
	if req.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+req.APIKey)
	}

	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(502, gin.H{"error": fmt.Sprintf("请求失败: %s", err.Error())})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		c.JSON(resp.StatusCode, gin.H{"error": string(body)})
		return
	}

	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	json.Unmarshal(body, &result)

	ids := make([]string, len(result.Data))
	for i, item := range result.Data {
		ids[i] = item.ID
	}
	c.JSON(200, ids)
}

// ============================================================
// 历史记录（按 session_id 隔离）
// ============================================================

func CopilotGetHistory(c *gin.Context) {
	sessionID := c.Query("session_id")
	if sessionID == "" {
		c.JSON(400, gin.H{"error": "session_id required"})
		return
	}
	rows, err := database.DB.Query("SELECT role, content FROM copilot_messages WHERE session_id=? ORDER BY id", sessionID)
	if err != nil {
		c.JSON(500, gin.H{"error": "db error"})
		return
	}
	defer rows.Close()
	var history []gin.H
	for rows.Next() {
		var role, content string
		rows.Scan(&role, &content)
		history = append(history, gin.H{"role": role, "content": content})
	}
	c.JSON(200, history)
}

func CopilotSaveHistory(c *gin.Context) {
	sessionID := c.Param("id")
	if sessionID == "" {
		c.JSON(400, gin.H{"error": "session_id required"})
		return
	}
	var newMsgs []gin.H
	if err := c.ShouldBindJSON(&newMsgs); err != nil || len(newMsgs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request"})
		return
	}
	tx, _ := database.DB.Begin()
	for _, m := range newMsgs {
		role, _ := m["role"].(string)
		content, _ := m["content"].(string)
		tx.Exec("INSERT INTO copilot_messages(session_id, role, content) VALUES(?,?,?)", sessionID, role, content)
	}
	tx.Commit()
	c.JSON(200, gin.H{"message": "saved"})
}

// ============================================================
// 发送消息（后端代理，防止 API Key 泄露）
// ============================================================

type CopilotChatRequest struct {
	SessionID    int64    `json:"session_id"`
	ProviderID   int64    `json:"provider_id"`
	Model        string   `json:"model"`
	Messages     []gin.H  `json:"messages"`
	MaxTokens    int      `json:"max_tokens"`
	// Transient：为 true 时不将本次请求/回复写入 copilot_messages
	// （用于前端自动命名会话等辅助调用，避免污染对话历史）
	Transient bool `json:"transient"`
	Tools        []gin.H  `json:"tools"`
	ToolChoice   string   `json:"tool_choice"`
}

func CopilotChat(c *gin.Context) {
	var req CopilotChatRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Messages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request"})
		return
	}
	if req.MaxTokens == 0 {
		req.MaxTokens = 2048
	}

	// 从会话读取配置
	var sessAPIBase, sessModel, recallSessionsStr string
	err := database.DB.QueryRow("SELECT COALESCE(api_base,''), COALESCE(model,''), COALESCE(recall_sessions,'') FROM copilot_sessions WHERE id=?", req.SessionID).Scan(&sessAPIBase, &sessModel, &recallSessionsStr)
	if err != nil {
		c.JSON(404, gin.H{"error": "session not found"})
		return
	}
	apiBase := sessAPIBase
	model := sessModel

	// 如果会话没有 api_base，从 Provider 表获取
	if apiBase == "" {
		database.DB.QueryRow("SELECT api_base FROM copilot_providers LIMIT 1").Scan(&apiBase)
	}
	if model == "" {
		// 使用请求体中携带的 model（前端会传当前选中的模型）
		if req.Model != "" {
			model = req.Model
		} else {
			c.JSON(400, gin.H{"error": "model not configured"})
			return
		}
	}

	// api_key 从 Provider 读取（全局）
	apiKey := ""
	if apiBase != "" {
		var provID int64
		database.DB.QueryRow("SELECT id FROM copilot_providers WHERE api_base=?", apiBase).Scan(&provID)
		if provID > 0 {
			database.DB.QueryRow("SELECT api_key FROM copilot_providers WHERE id=?", provID).Scan(&apiKey)
		}
	}
	if apiKey == "" || apiBase == "" || model == "" {
		c.JSON(400, gin.H{"error": "missing config"})
		return
	}

	// 构建 recall 上下文
	recallContext := ""
	if recallSessionsStr != "" && recallSessionsStr != "[]" {
		var recalledIDs []int64
		json.Unmarshal([]byte(recallSessionsStr), &recalledIDs)
		for _, sid := range recalledIDs {
			rows, _ := database.DB.Query("SELECT role, content FROM copilot_messages WHERE session_id=? ORDER BY id DESC LIMIT 10", sid)
			var msgs []gin.H
			for rows.Next() {
				var role, content string
				rows.Scan(&role, &content)
				msgs = append(msgs, gin.H{"role": role, "content": content})
			}
			rows.Close()
			for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
				msgs[i], msgs[j] = msgs[j], msgs[i]
			}
			for _, m := range msgs {
				label := "助手"
				if m["role"] == "user" {
					label = "用户"
				}
				recallContext += fmt.Sprintf("[其他会话] %s: %s\n", label, m["content"])
			}
		}
	}

	// 构建 system prompt（统一模式：优先使用脚本批量操作，减少请求次数）
	sysContent := "You are a professional Linux server management assistant. Answer concisely and accurately."
	sysContent += "\n\nYou can use the bash tool to execute Linux commands to get system information."
	sysContent += "\n\nYou also have BROWSER TOOLS to control a headless Chrome. Use these when the user asks about websites or needs to interact with web content:"
	sysContent += "\n\n**Preferred: Use `browser_script` for multi-step operations (one request = entire workflow):**"
	sysContent += "\n```"
	sysContent += "\nbrowser_script('open(\"https://example.com\")\\nclick(\"@1\")\\ndom()')"
	sysContent += "\n```"
	sysContent += "\nSupported script commands:"
	sysContent += "\n- open(url) — navigate to URL"
	sysContent += "\n- click(id) — click element by @ ID (e.g. @1, @2), or 'x,y' coordinates"
	sysContent += "\n- type(text, id) — type text into element, or type into focused field"
	sysContent += "\n- screenshot() — return base64 JPEG of current page"
	sysContent += "\n- dom() — return full HTML DOM (use after navigate/click to see page state)"
	sysContent += "\n- text() — return visible text content"
	sysContent += "\n- wait(ms) — wait N milliseconds"
	sysContent += "\n- back() — go back in history"
	sysContent += "\n- reload() — reload current page"
	sysContent += "\n\n**Fallback individual tools (use only when script is not suitable):**"
	sysContent += "\n- browser_navigate / browser_click / browser_type / browser_text / browser_dom / browser_screenshot"
	sysContent += "\n\nWorkflow: open a URL → dom() to see page structure → click/@ID elements → dom() to verify result."
	sysContent += "\n\nRules:"
	sysContent += "\n1. Only call tools when necessary (e.g., check system status, execute commands)"
	sysContent += "\n2. Do not repeatedly try different commands"
	sysContent += "\n3. If the user's question doesn't require querying the system, answer directly"
	sysContent += "\n4. Reply in the same language as the user"
	sysContent += "\n5. When the user asks for a screenshot or to see a page, you MUST call browser_screenshot (or browser_script with screenshot()) to capture it. NEVER save screenshots to files via bash. The tool returns a base64 image that is displayed to the user automatically — after calling it, just confirm in one sentence, do not describe the image file path"
	sysContent += "\n6. When the user says '再发一遍' / '发一次' / 'show it again', re-execute the previous browser screenshot tool call, not the auto-generated session title"
	sysContent += "\n7. If no browser page has been opened yet, first call browser_navigate to open https://www.google.com (or the URL the user gave), then call browser_screenshot. Do NOT ask the user for a URL when they simply want to see the current screen"
	sysContent += "\nWhen you want to use a tool, call it using the tool calling mechanism provided. Do NOT output any XML or code blocks describing the tool call — just call the tool."
	if recallContext != "" {
		sysContent += "\n\n以下是对话历史中的相关上下文，请结合参考：\n" + recallContext
	}

	// 组装完整 messages
	fullMsgs := []gin.H{{"role": "system", "content": sysContent}}
	for _, m := range req.Messages {
		fullMsgs = append(fullMsgs, m)
	}

	client := &http.Client{Timeout: 120 * time.Second}

	// 收集工具调用中捕获的截图（base64 data URL），随响应直接返回前端渲染，
	// 避免把巨大的 base64 喂给 LLM 转述
	var capturedImages []string

	// 兜底：模型把工具调用写进 content 文本而非 tool_calls 字段，
	// 解析内嵌的 <function_call> 块，还原为标准 tool_calls 走同一套执行逻辑
	toolCallRe := regexp.MustCompile(`(?s)<function_call>\s*<function=(\w+)>\s*(?:<parameter=\w+>(.*?)</parameter>\s*)*</function_call>`)

	// 循环调用直到获得纯文本回复（处理 tool calling）
	maxTurns := 20
	for turn := 0; turn < maxTurns; turn++ {
		reqBody := gin.H{
			"model":      model,
			"messages":   fullMsgs,
			"max_tokens": req.MaxTokens,
		}
		if len(req.Tools) > 0 {
			reqBody["tools"] = req.Tools
		}
		if req.ToolChoice != "" {
			reqBody["tool_choice"] = req.ToolChoice
		}
		body, err := json.Marshal(reqBody)
		if err != nil {
			c.JSON(500, gin.H{"error": "marshal failed"})
			return
		}
		fmt.Printf("[DEBUG] Request body: %s\n", string(body))
		reqURL := strings.TrimRight(apiBase, "/") + "/chat/completions"
		httpReq, _ := http.NewRequest("POST", reqURL, strings.NewReader(string(body)))
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+apiKey)

		resp, err := client.Do(httpReq)
		if err != nil {
			c.JSON(502, gin.H{"error": fmt.Sprintf("请求失败: %s", err.Error())})
			return
		}
		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		if resp.StatusCode != 200 {
			c.JSON(resp.StatusCode, gin.H{"error": string(respBody)})
			return
		}

		var result struct {
			Choices []struct {
				Message struct {
					Role      string `json:"role"`
					Content   string `json:"content"`
					ToolCalls []struct {
						ID       string `json:"id"`
						Type     string `json:"type"`
						Function struct {
							Name      string `json:"name"`
							Arguments string `json:"arguments"`
						} `json:"function"`
					} `json:"tool_calls"`
				} `json:"message"`
			} `json:"choices"`
		}
		json.Unmarshal(respBody, &result)

		fmt.Printf("[DEBUG] LLM response: %s\n", string(respBody))

		if len(result.Choices) == 0 {
			c.JSON(200, gin.H{"reply": "（无回复）"})
			return
		}

		choice := result.Choices[0]

		// 兜底：模型把工具调用写进 content 文本（而非 tool_calls 字段）时，解析出来
		if len(choice.Message.ToolCalls) == 0 && choice.Message.Content != "" {
			matches := toolCallRe.FindAllStringSubmatch(choice.Message.Content, -1)
			for _, m := range matches {
				// 正则带 2 个捕获组（工具名、参数），不足时跳过，避免越界 panic
				if len(m) < 3 {
					continue
				}
				name := strings.TrimSpace(m[1])
				// 未写 function=name 行时，尝试从参数行提取 "name":... 兜底
				if name == "" {
					var objMap map[string]interface{}
					if json.Unmarshal([]byte(m[2]), &objMap) == nil {
						if n, ok := objMap["name"].(string); ok {
							name = n
						}
					}
				}
				if name == "" {
					continue // 无法识别工具名，不执行
				}
				callID := "inline_" + fmt.Sprintf("%d", time.Now().UnixNano())
				choice.Message.ToolCalls = append(choice.Message.ToolCalls, struct {
					ID       string `json:"id"`
					Type     string `json:"type"`
					Function struct {
						Name      string `json:"name"`
						Arguments string `json:"arguments"`
					} `json:"function"`
				}{ID: callID, Type: "function", Function: struct {
					Name      string `json:"name"`
					Arguments string `json:"arguments"`
				}{Name: name, Arguments: strings.TrimSpace(m[2])}})
			}
			// 去掉 content 里已解析的标记，避免复读
			cleaned := toolCallRe.ReplaceAllString(choice.Message.Content, "")
			choice.Message.Content = strings.TrimSpace(cleaned)
		}

		// 如果有 tool_calls，执行工具并继续调用
		if len(choice.Message.ToolCalls) > 0 {
			fullMsgs = append(fullMsgs, gin.H{
				"role":       "assistant",
				"content":    choice.Message.Content,
				"tool_calls": choice.Message.ToolCalls,
			})
			for _, tc := range choice.Message.ToolCalls {
				output := ""
				if tc.Function.Name == "bash" {
					var args struct {
						Command string `json:"command"`
					}
					json.Unmarshal([]byte(tc.Function.Arguments), &args)
					cmd := exec.Command("bash", "-c", args.Command)
					out, err := cmd.CombinedOutput()
					if err != nil {
						output = fmt.Sprintf("执行失败: %v\n%s", err, string(out))
					} else {
						output = string(out)
					}
				} else if tc.Function.Name == "read" {
					// 读取文件
					var args struct {
						Path string `json:"path"`
					}
					json.Unmarshal([]byte(tc.Function.Arguments), &args)
					content, err := os.ReadFile(args.Path)
					if err != nil {
						output = fmt.Sprintf("读取失败: %v", err)
					} else {
						output = string(content)
					}
				} else if tc.Function.Name == "write" {
					// 写入文件
					var args struct {
						Path    string `json:"path"`
						Content string `json:"content"`
					}
					json.Unmarshal([]byte(tc.Function.Arguments), &args)
					err := os.WriteFile(args.Path, []byte(args.Content), 0644)
					if err != nil {
						output = fmt.Sprintf("写入失败: %v", err)
					} else {
						output = "写入成功"
					}
				} else if tc.Function.Name == "browser_screenshot" || tc.Function.Name == "browser_navigate" ||
					tc.Function.Name == "browser_click" || tc.Function.Name == "browser_type" || tc.Function.Name == "browser_text" ||
					tc.Function.Name == "browser_dom" || tc.Function.Name == "browser_script" {
					// 查找活跃浏览器 session（通过 API 查询）
					// browser 路由已启用 Cookie 认证，内部自调用需转发调用者的 session Cookie
					var sessionID string
					cookieHeader := func(req *http.Request) {
						if sc, err := c.Cookie("session"); err == nil {
							req.AddCookie(&http.Cookie{Name: "session", Value: sc})
						}
					}
					listReq, err := http.NewRequest("GET", "http://localhost:8080/browser/sessions", nil)
					if err == nil {
						cookieHeader(listReq)
						listResp, err := http.DefaultClient.Do(listReq)
						if err == nil {
							var sessions []struct {
								ID     string `json:"id"`
								Status string `json:"status"`
							}
							json.NewDecoder(listResp.Body).Decode(&sessions)
							listResp.Body.Close()
							for _, s := range sessions {
								if s.Status == "running" {
									sessionID = s.ID
									break
								}
							}
						}
					}
					if sessionID == "" {
						// 没有活跃 session，创建一个新的
						createReq, _ := http.NewRequest("POST", "http://localhost:8080/browser/sessions", nil)
						cookieHeader(createReq)
						createResp, err := http.DefaultClient.Do(createReq)
						if err != nil {
							output = fmt.Sprintf("创建浏览器 session 失败: %v", err)
						} else {
							var newSession struct{ ID string `json:"id"` }
							json.NewDecoder(createResp.Body).Decode(&newSession)
							createResp.Body.Close()
							sessionID = newSession.ID
						}
					}
					if sessionID == "" {
						output = "没有可用的浏览器 session"
					} else {
						baseURL := fmt.Sprintf("http://localhost:8080/browser/sessions/%s/tools", sessionID)
						var reqBody io.Reader
						switch tc.Function.Name {
						case "browser_screenshot":
							reqBody = nil
						case "browser_navigate":
							var a struct{ URL string `json:"url"` }
							json.Unmarshal([]byte(tc.Function.Arguments), &a)
							b, _ := json.Marshal(a)
							reqBody = bytes.NewReader(b)
						case "browser_click":
							var a struct {
								X float64 `json:"x"`
								Y float64 `json:"y"`
							}
							json.Unmarshal([]byte(tc.Function.Arguments), &a)
							b, _ := json.Marshal(a)
							reqBody = bytes.NewReader(b)
						case "browser_type":
							var a struct{ Text string `json:"text"` }
							json.Unmarshal([]byte(tc.Function.Arguments), &a)
							b, _ := json.Marshal(a)
							reqBody = bytes.NewReader(b)
						case "browser_text":
							reqBody = nil
						case "browser_dom":
							reqBody = nil
						case "browser_script":
							var a struct{ Script string `json:"script"` }
							json.Unmarshal([]byte(tc.Function.Arguments), &a)
							b, _ := json.Marshal(a)
							reqBody = bytes.NewReader(b)
						}
						method := "GET"
						if reqBody != nil {
							method = "POST"
						}
						// 工具名到实际 endpoint 的映射（browser 工具路由不带 browser_ 前缀）
						var endpoint string
						switch tc.Function.Name {
						case "browser_screenshot":
							endpoint = "screenshot"
						case "browser_navigate":
							endpoint = "navigate"
						case "browser_click":
							endpoint = "click"
						case "browser_type":
							endpoint = "type"
						case "browser_text":
							endpoint = "text"
						case "browser_dom":
							endpoint = "dom"
						case "browser_script":
							endpoint = "script"
						}
						url := baseURL + "/" + endpoint
						req, _ := http.NewRequest(method, url, reqBody)
						req.Header.Set("Content-Type", "application/json")
						cookieHeader(req)
						httpClient := &http.Client{Timeout: 15 * time.Second}
						resp2, err := httpClient.Do(req)
						if err != nil {
							output = fmt.Sprintf("浏览器工具调用失败: %v", err)
						} else {
							var result map[string]interface{}
							json.NewDecoder(resp2.Body).Decode(&result)
							resp2.Body.Close()
							if errVal, hasErr := result["error"]; hasErr {
								output = fmt.Sprintf("浏览器工具调用失败: %v", errVal)
							} else if tc.Function.Name == "browser_screenshot" {
								img, _ := result["image"].(string)
								u, _ := result["url"].(string)
								if img == "" {
									output = "截图失败：未获取到图片数据"
								} else {
									capturedImages = append(capturedImages, img)
									// 不喂给 LLM 的 base64（太大），只告知已截图并展示给用户
									output = fmt.Sprintf("页面截图已获取 (当前: %s)，图片已自动展示给用户，你只需一句话确认即可", u)
								}
							} else if tc.Function.Name == "browser_text" {
								t, _ := result["text"].(string)
								output = fmt.Sprintf("页面文本:\n%s", t)
							} else if tc.Function.Name == "browser_dom" {
								d, _ := result["dom"].(string)
								output = fmt.Sprintf("页面 DOM:\n%s", d)
							} else if tc.Function.Name == "browser_script" {
								// 脚本结果是一个步骤数组
								if steps, ok := result["results"].([]interface{}); ok {
									var lines []string
									for _, st := range steps {
										m := st.(map[string]interface{})
										stepNum := int(m["step"].(float64))
										cmd := m["cmd"]
										if err, hasErr := m["error"]; hasErr {
											lines = append(lines, fmt.Sprintf("  [步骤%d] %v → 错误: %v", stepNum, cmd, err))
										} else {
											msg := fmt.Sprintf("  [步骤%d] %v → ok", stepNum, cmd)
											if url, hasURL := m["url"]; hasURL {
												msg += fmt.Sprintf(" (url=%v)", url)
											}
											if dom, hasDOM := m["dom"]; hasDOM {
												d := dom.(string)
												if len(d) > 200 {
													d = d[:200] + "...(truncated)"
												}
												msg += fmt.Sprintf("\n        DOM: %s", d)
											}
											if txt, hasTxt := m["text"]; hasTxt {
												t := txt.(string)
												if len(t) > 200 {
													t = t[:200] + "...(truncated)"
												}
												msg += fmt.Sprintf("\n        Text: %s", t)
											}
											if img, hasImg := m["image"]; hasImg {
												if s, ok := img.(string); ok && s != "" {
													capturedImages = append(capturedImages, s)
												}
												msg += " (图片已自动展示给用户)"
											}
											lines = append(lines, msg)
										}
									}
									output = "浏览器脚本执行结果:\n" + strings.Join(lines, "\n")
								} else {
									output = fmt.Sprintf("%v", result)
								}
							} else {
								output = fmt.Sprintf("%v", result)
							}
						}
					}
				} else {
					output = fmt.Sprintf("未知工具: %s", tc.Function.Name)
				}
				fullMsgs = append(fullMsgs, gin.H{
					"role":         "tool",
					"tool_call_id": tc.ID,
					"content":      output,
				})
			}
			continue
		}

		// 纯文本回复，清理特殊标记
		reply := choice.Message.Content
		reply = strings.ReplaceAll(reply, "<|assistant|>", "")
		reply = strings.ReplaceAll(reply, "<|tool_call|>", "")
		reply = strings.ReplaceAll(reply, "<|tool_calls|>", "")
		reply = strings.ReplaceAll(reply, "<|end|>", "")
		reply = strings.TrimSpace(reply)

		// 保存对话到数据库（transient 请求如自动命名不入库，避免污染历史）
		if !req.Transient {
			tx, _ := database.DB.Begin()
			tx.Exec("INSERT INTO copilot_messages(session_id, role, content) VALUES(?, ?, ?)", req.SessionID, "user", req.Messages[len(req.Messages)-1]["content"])
			tx.Exec("INSERT INTO copilot_messages(session_id, role, content) VALUES(?, ?, ?)", req.SessionID, "assistant", reply)
			tx.Commit()
		}
		tx, _ := database.DB.Begin()
		tx.Exec("UPDATE copilot_sessions SET model=? WHERE id=?", model, req.SessionID)
		tx.Commit()

		// 返回截图列表随响应（前端直接渲染，LLM 不需要转述图片）
		if len(capturedImages) > 0 {
			c.JSON(200, gin.H{"reply": reply, "model": model, "images": capturedImages})
		} else {
			c.JSON(200, gin.H{"reply": reply, "model": model})
		}
		return
	}

	// 超过最大轮次
	c.JSON(200, gin.H{"reply": "（AI 调用工具次数过多，已中止）", "model": model})
}

func CopilotGetRecentMessages(c *gin.Context) {
	sessionID := c.Param("id")
	limit := c.DefaultQuery("limit", "20")
	rows, err := database.DB.Query("SELECT role, content FROM copilot_messages WHERE session_id!=? ORDER BY id DESC LIMIT "+limit, sessionID)
	if err != nil {
		c.JSON(500, gin.H{"error": "db error"})
		return
	}
	defer rows.Close()
	var msgs []gin.H
	for rows.Next() {
		var role, content string
		rows.Scan(&role, &content)
		msgs = append(msgs, gin.H{"role": role, "content": content})
	}
	for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
		msgs[i], msgs[j] = msgs[j], msgs[i]
	}
	c.JSON(200, msgs)
}

