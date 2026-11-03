package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"panel/service"
)

// NginxStatus GET /api/sites/nginx
func NginxStatusHandler(c *gin.Context) {
	c.JSON(http.StatusOK, service.NginxStatus())
}

// NginxSites GET /api/sites/nginx/sites
func NginxSitesHandler(c *gin.Context) {
	c.JSON(http.StatusOK, service.NginxSites())
}

// NginxCreateSite POST /api/sites/nginx/site/create
func NginxCreateSite(c *gin.Context) {
	var req struct {
		Name    string `json:"name"`
		Content string `json:"content"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "site name required"})
		return
	}

	if err := service.NginxCreateSite(req.Name, req.Content); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func NginxSiteAction(c *gin.Context) {
	name := c.Param("name")
	action := c.Param("action")

	switch action {
	case "enable":
		if err := service.NginxEnableSite(name); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	case "disable":
		if err := service.NginxDisableSite(name); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	case "delete":
		if err := service.NginxDeleteSite(name); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid action: " + action})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// NginxServiceAction POST /api/sites/nginx/:action
func NginxServiceAction(c *gin.Context) {
	action := c.Param("action")

	if err := service.NginxAction(action); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// SqlDBs GET /api/sites/sql
func SqlDBs(c *gin.Context) {
	c.JSON(http.StatusOK, service.SqlListDBs())
}

// SqlQuery POST /api/sites/sql/query  { "path": "...", "query": "SELECT ..." }
func SqlQuery(c *gin.Context) {
	var req struct {
		Path  string `json:"path"`
		Query string `json:"query"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Path == "" || req.Query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "path and query required"})
		return
	}

	res, err := service.SqlQuery(req.Path, req.Query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

// SqlCreateDB POST /api/sites/sql/create  { "name": "mysite", "password": "..." }
func SqlCreateDB(c *gin.Context) {
	var req struct {
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "database name required"})
		return
	}

	res, err := service.SqlCreateDB(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

// SqlDeleteDB POST /api/sites/sql/delete { "path": "..." }
func SqlDeleteDB(c *gin.Context) {
	var req struct {
		Path string `json:"path"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := service.SqlDeleteDB(req.Path); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// CreateSite POST /api/sites/nginx/site/create { name, content, dbName, dbPassword }
func CreateSite(c *gin.Context) {
	var req struct {
		Name     string `json:"name"`
		Content  string `json:"content"`
		DBName   string `json:"dbName"`   // optional: SQLite database name (for PHP)
		DBPasswd string `json:"dbPassword"` // optional: custom password (auto-generate if empty)
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 如果是 PHP 模式且需要数据库，先创建数据库
	var dbPath string
	if req.DBName != "" {
		dbRes, err := service.SqlCreateDB(service.CreateDBRequest{
			Name:     req.DBName,
			Password: req.DBPasswd,
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create database: " + err.Error()})
			return
		}
		dbPath = dbRes.Path
	}

	// 写入并启用站点
	if err := service.NginxCreateSite(req.Name, req.Content); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"dbPath":  dbPath,
	})
}
