package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

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
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	Model    string `json:"model"`
	APIKey   string `json:"api_key"`
	APIBase  string `json:"api_base"`
}

func CopilotListSessions(c *gin.Context) {
	rows, err := database.DB.Query("SELECT id, name, model, api_key, api_base FROM copilot_sessions ORDER BY id")
	if err != nil {
		c.JSON(500, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	var sessions []Session
	for rows.Next() {
		var s Session
		rows.Scan(&s.ID, &s.Name, &s.Model, &s.APIKey, &s.APIBase)
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
	id, _ := database.DB.Exec("INSERT INTO copilot_sessions(name, model, api_key, api_base) VALUES(?,?,?,?)",
		name, "gpt-4o", "", "https://api.openai.com/v1")
	res, _ := id.LastInsertId()
	c.JSON(200, gin.H{"id": res, "name": name})
}

func CopilotUpdateSession(c *gin.Context) {
	id := c.Param("id")
	var data Session
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request"})
		return
	}
	_, err := database.DB.Exec(
		"UPDATE copilot_sessions SET name=?, model=?, api_key=?, api_base=? WHERE id=?",
		data.Name, data.Model, data.APIKey, data.APIBase, id)
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
// 历史记录（全局，按 session ID 过滤可选）
// ============================================================

func CopilotGetHistory(c *gin.Context) {
	value := func() string {
		var v string
		database.DB.QueryRow("SELECT value FROM settings WHERE key=?", CopilotHistoryKey).Scan(&v)
		return v
	}()
	if value == "" {
		c.JSON(200, []gin.H{})
		return
	}
	var history []gin.H
	json.Unmarshal([]byte(value), &history)
	c.JSON(200, history)
}

func CopilotSaveHistory(c *gin.Context) {
	var newMsgs []gin.H
	if err := c.ShouldBindJSON(&newMsgs); err != nil || len(newMsgs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request"})
		return
	}
	value := func() string {
		var v string
		database.DB.QueryRow("SELECT value FROM settings WHERE key=?", CopilotHistoryKey).Scan(&v)
		return v
	}()
	var existing []gin.H
	json.Unmarshal([]byte(value), &existing)
	existing = append(existing, newMsgs...)
	if len(existing) > 50 {
		existing = existing[len(existing)-50:]
	}
	data, _ := json.Marshal(existing)
	upsert := `INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`
	database.DB.Exec(upsert, CopilotHistoryKey, string(data))
	c.JSON(200, gin.H{"message": "saved"})
}
