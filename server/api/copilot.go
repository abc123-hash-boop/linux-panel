package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os/exec"
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
		lastModel = "gpt-4o"
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
	var data Session
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request"})
		return
	}
	_, err := database.DB.Exec(
		"UPDATE copilot_sessions SET name=?, model=?, api_base=?, recall_sessions=? WHERE id=?",
		data.Name, data.Model, data.APIBase, data.RecallSessions, id)
	if err != nil {
		c.JSON(500, gin.H{"error": "update failed"})
		return
	}
	c.JSON(200, gin.H{"message": "updated"})
}

func CopilotDeleteSession(c *gin.Context) {
	id := c.Param("id")
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
		model = "gpt-4o"
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

	// 构建 system prompt
	sysContent := "你是一个专业的 Linux 服务器管理助手。请简洁、准确地回答用户的问题。使用中文回答。"
	sysContent += "\n\n你可以通过调用 bash 工具执行 Linux 命令来获取系统信息。"
	sysContent += "\n\n重要规则："
	sysContent += "\n1. 仅在必要时调用工具（如查询系统状态、执行命令）"
	sysContent += "\n2. 每个问题最多调用 1 次工具"
	sysContent += "\n3. 不要反复尝试不同的命令"
	sysContent += "\n4. 如果用户的问题不需要查询系统，直接回答即可"
	if recallContext != "" {
		sysContent += "\n\n以下是对话历史中的相关上下文，请结合参考：\n" + recallContext
	}

	// 组装完整 messages
	fullMsgs := []gin.H{{"role": "system", "content": sysContent}}
	for _, m := range req.Messages {
		fullMsgs = append(fullMsgs, m)
	}

	client := &http.Client{Timeout: 120 * time.Second}

	// 循环调用直到获得纯文本回复（处理 tool calling）
	maxTurns := 5
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

		if len(result.Choices) == 0 {
			c.JSON(200, gin.H{"reply": "（无回复）"})
			return
		}

		choice := result.Choices[0]

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
					// 执行 shell 命令
					cmd := exec.Command("bash", "-c", tc.Function.Arguments)
					out, err := cmd.CombinedOutput()
					if err != nil {
						output = fmt.Sprintf("命令执行失败: %v\n输出: %s", err, string(out))
					} else {
						output = string(out)
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

		// 保存对话到数据库
		tx, _ := database.DB.Begin()
		tx.Exec("INSERT INTO copilot_messages(session_id, role, content) VALUES(?, ?, ?)", req.SessionID, "user", req.Messages[len(req.Messages)-1]["content"])
		tx.Exec("INSERT INTO copilot_messages(session_id, role, content) VALUES(?, ?, ?)", req.SessionID, "assistant", reply)
		tx.Exec("UPDATE copilot_sessions SET model=? WHERE id=?", model, req.SessionID)
		tx.Commit()

		c.JSON(200, gin.H{"reply": reply, "model": model})
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

