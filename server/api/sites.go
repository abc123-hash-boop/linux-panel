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
