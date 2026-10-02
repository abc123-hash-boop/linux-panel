package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
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
	RecallSessions string   `json:"recall_sessions"` // JSON array of session IDs
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
	// 继承最后一个会话的配置
	var lastKey, lastBase, lastModel string
	database.DB.QueryRow("SELECT api_key, api_base, model FROM copilot_sessions ORDER BY id DESC LIMIT 1").Scan(&lastKey, &lastBase, &lastModel)
	if lastKey == "" {
		lastKey = ""
	}
	if lastBase == "" {
		lastBase = "https://api.openai.com/v1"
	}
	if lastModel == "" {
		lastModel = "gpt-4o"
	}
	id, _ := database.DB.Exec("INSERT INTO copilot_sessions(name, model, api_key, api_base, recall_sessions) VALUES(?,?,?,?,?)",
		name, lastModel, lastKey, lastBase, "{}")
	res, _ := id.LastInsertId()
	c.JSON(200, gin.H{"id": res, "name": name, "model": lastModel, "api_key": lastKey, "api_base": lastBase, "recall_sessions": "{}"})
}

func CopilotUpdateSession(c *gin.Context) {
	id := c.Param("id")
	var data Session
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request"})
		return
	}
	_, err := database.DB.Exec(
		"UPDATE copilot_sessions SET name=?, model=?, api_key=?, api_base=?, recall_sessions=? WHERE id=?",
		data.Name, data.Model, data.APIKey, data.APIBase, data.RecallSessions, id)
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
	rows, err := database.DB.Query("SELECT id, name, icon, api_base FROM copilot_providers ORDER BY id")
	if err != nil {
		c.JSON(500, gin.H{"error": "db error"})
		return
	}
	defer rows.Close()

	var providers []Provider
	for rows.Next() {
		var p Provider
		rows.Scan(&p.ID, &p.Name, &p.Icon, &p.APIBase)
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
	res, err := database.DB.Exec("INSERT INTO copilot_providers(name, icon, api_base) VALUES(?,?,?)",
		data.Name, data.Icon, data.APIBase)
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
		Models  []string `json:"models"`
	}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request"})
		return
	}
	database.DB.Exec("UPDATE copilot_providers SET name=?, icon=?, api_base=? WHERE id=?",
		data.Name, data.Icon, data.APIBase, id)
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
	SessionID int64   `json:"session_id"`
	APIBase   string  `json:"api_base"`
	APIKey    string  `json:"api_key"`
	Model     string  `json:"model"`
	Messages  []gin.H `json:"messages"`
	MaxTokens int     `json:"max_tokens"`
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
	var sessAPIKey, sessAPIBase, sessModel, recallSessionsStr string
	err := database.DB.QueryRow("SELECT api_key, api_base, model, COALESCE(recall_sessions,'') FROM copilot_sessions WHERE id=?", req.SessionID).Scan(&sessAPIKey, &sessAPIBase, &sessModel, &recallSessionsStr)
	if err != nil {
		c.JSON(404, gin.H{"error": "session not found"})
		return
	}
	apiKey := req.APIKey
	if apiKey == "" {
		apiKey = sessAPIKey
	}
	apiBase := req.APIBase
	if apiBase == "" {
		apiBase = sessAPIBase
	}
	model := req.Model
	if model == "" {
		model = sessModel
	}
	if apiKey == "" || apiBase == "" || model == "" {
		c.JSON(400, gin.H{"error": "missing api_key or api_base or model"})
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
			// 反转
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
	if recallContext != "" {
		sysContent += "\n\n以下是对话历史中的相关上下文，请结合参考：\n" + recallContext
	}

	// 组装完整 messages
	fullMsgs := []gin.H{{"role": "system", "content": sysContent}}
	for _, m := range req.Messages {
		fullMsgs = append(fullMsgs, m)
	}

	// 调用 LLM API
	body, _ := json.Marshal(gin.H{
		"model":      model,
		"messages":   fullMsgs,
		"max_tokens": req.MaxTokens,
	})

	reqURL := strings.TrimRight(apiBase, "/") + "/chat/completions"
	httpReq, _ := http.NewRequest("POST", reqURL, strings.NewReader(string(body)))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		c.JSON(502, gin.H{"error": fmt.Sprintf("请求失败: %s", err.Error())})
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		c.JSON(resp.StatusCode, gin.H{"error": string(respBody)})
		return
	}

	// 解析回复（处理 function calling 响应）
	var result struct {
		Choices []struct {
			Message struct {
				Role          string           `json:"role"`
				Content       string           `json:"content"`
				ToolCalls     []gin.H          `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
	}
	json.Unmarshal(respBody, &result)

	if len(result.Choices) == 0 {
		c.JSON(200, gin.H{"reply": "（无回复）"})
		return
	}

	choice := result.Choices[0]
	reply := choice.Message.Content
	// 如果有 tool_calls，提取文字内容（过滤掉工具调用标签）
	if len(choice.Message.ToolCalls) > 0 && reply == "" {
		// 有些模型用 XML 标签包裹 tool calls，尝试提取纯文本
		for _, tc := range choice.Message.ToolCalls {
			if fn, ok := tc["function"].(gin.H); ok {
				if name, ok := fn["name"].(string); ok {
					reply += fmt.Sprintf("[调用工具: %s]", name)
				}
			}
		}
	}
	// 移除可能的 XML/特殊标记
	if reply != "" {
		// 清理 tool call 标记
		replaceStrs := []struct{ old, new string }{
			{"<|assistant|>", ""}, {"<|tool_call|>", ""}, {"<|tool_calls|>", ""},
			{"<|end|>", ""}, {"\n", " "},
		}
		cleaned := reply
		for _, r := range replaceStrs {
			cleaned = strings.ReplaceAll(cleaned, r.old, r.new)
		}
		reply = strings.TrimSpace(cleaned)
	}

	// 保存对话到数据库
	tx, _ := database.DB.Begin()
	tx.Exec("INSERT INTO copilot_messages(session_id, role, content) VALUES(?, ?, ?)", req.SessionID, "user", req.Messages[len(req.Messages)-1]["content"])
	tx.Exec("INSERT INTO copilot_messages(session_id, role, content) VALUES(?, ?, ?)", req.SessionID, "assistant", reply)
	tx.Exec("UPDATE copilot_sessions SET model=? WHERE id=?", model, req.SessionID)
	tx.Commit()

	c.JSON(200, gin.H{"reply": reply, "model": req.Model})
}

// 获取其他会话最近消息（跨会话回忆）
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

