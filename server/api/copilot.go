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
	CopilotModelKey       = "copilot_model"
	CopilotAPIKeyKey      = "copilot_api_key"
	CopilotAPIBase        = "copilot_api_base"
	CopilotHistoryKey     = "copilot_history"
	CopilotProvidersKey   = "copilot_providers"
)

// CopilotSettings 前端提交的配置结构
type CopilotSettings struct {
	Model  string `json:"model"`
	APIKey string `json:"api_key"`
	APIBase string `json:"api_base"`
}

// CopilotProvider 一个模型提供商
type CopilotProvider struct {
	Name   string `json:"name"`
	Icon   string `json:"icon,omitempty"`
	APIKey string `json:"api_key"`
	APIBase string `json:"api_base"`
}

// ============================================================
// 设置 CRUD
// ============================================================

func copilotGetValue(key string) string {
	var value string
	database.DB.QueryRow("SELECT value FROM settings WHERE key = ?", key).Scan(&value)
	return value
}

func copilotUpsert(key, value string) {
	upsert := `INSERT INTO settings (key, value) VALUES (?, ?)
	           ON CONFLICT(key) DO UPDATE SET value = excluded.value`
	database.DB.Exec(upsert, key, value)
}

// CopilotGetSettings 获取当前配置
func CopilotGetSettings(c *gin.Context) {
	rows, err := database.DB.Query("SELECT key, value FROM settings WHERE key IN (?, ?, ?)",
		CopilotModelKey, CopilotAPIKeyKey, CopilotAPIBase)
	if err != nil {
		c.JSON(500, gin.H{"error": "database error"})
		return
	}
	defer rows.Close()

	settings := gin.H{
		"model":    "gpt-4o",
		"api_key":  "",
		"api_base": "https://api.openai.com/v1",
	}

	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			continue
		}
		switch key {
		case CopilotModelKey:
			settings["model"] = value
		case CopilotAPIKeyKey:
			settings["api_key"] = value
		case CopilotAPIBase:
			settings["api_base"] = value
		}
	}
	c.JSON(200, settings)
}

// CopilotSaveSettings 保存配置
func CopilotSaveSettings(c *gin.Context) {
	var data CopilotSettings
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request"})
		return
	}

	if data.Model != "" {
		copilotUpsert(CopilotModelKey, data.Model)
	}
	if data.APIKey != "" {
		copilotUpsert(CopilotAPIKeyKey, data.APIKey)
	}
	if data.APIBase != "" {
		copilotUpsert(CopilotAPIBase, data.APIBase)
	}

	c.JSON(200, gin.H{"message": "saved"})
}

// ============================================================
// Provider CRUD
// ============================================================

// CopilotGetProviders 获取所有已保存的提供商
func CopilotGetProviders(c *gin.Context) {
	value := copilotGetValue(CopilotProvidersKey)
	if value == "" {
		c.JSON(200, []CopilotProvider{})
		return
	}
	var providers []CopilotProvider
	if err := json.Unmarshal([]byte(value), &providers); err != nil {
		c.JSON(200, []CopilotProvider{})
		return
	}
	c.JSON(200, providers)
}

// CopilotSaveProviders 保存所有提供商
func CopilotSaveProviders(c *gin.Context) {
	var providers []CopilotProvider
	if err := c.ShouldBindJSON(&providers); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request"})
		return
	}
	data, _ := json.Marshal(providers)
	copilotUpsert(CopilotProvidersKey, string(data))
	c.JSON(200, gin.H{"message": "saved"})
}

// ============================================================
// 获取模型列表（后端代理，避免 CORS）
// ============================================================

// CopilotFetchModels 代理请求模型列表
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

	// 解析 OpenAI 格式
	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		// 直接返回原始 body
		c.JSON(200, gin.H{"raw": string(body)})
		return
	}

	ids := make([]string, len(result.Data))
	for i, item := range result.Data {
		ids[i] = item.ID
	}
	c.JSON(200, ids)
}

// ============================================================
// 历史记录
// ============================================================

// CopilotGetHistory 获取聊天历史
func CopilotGetHistory(c *gin.Context) {
	value := copilotGetValue(CopilotHistoryKey)
	if value == "" {
		c.JSON(200, []gin.H{})
		return
	}
	var history []gin.H
	json.Unmarshal([]byte(value), &history)
	c.JSON(200, history)
}

// CopilotSaveHistory 保存聊天历史（追加）
func CopilotSaveHistory(c *gin.Context) {
	var newMsgs []gin.H
	if err := c.ShouldBindJSON(&newMsgs); err != nil || len(newMsgs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad request"})
		return
	}

	var existing []gin.H
	value := copilotGetValue(CopilotHistoryKey)
	if value != "" {
		json.Unmarshal([]byte(value), &existing)
	}
	existing = append(existing, newMsgs...)
	if len(existing) > 50 {
		existing = existing[len(existing)-50:]
	}
	data, _ := json.Marshal(existing)
	copilotUpsert(CopilotHistoryKey, string(data))
	c.JSON(200, gin.H{"message": "saved"})
}
