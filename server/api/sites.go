package api

import (
	"net/http"
	"strings"

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

// NginxSiteConfig GET/PUT /api/sites/nginx/site/:name/config
func NginxSiteConfig(c *gin.Context) {
	name := c.Param("name")
	if c.Request.Method == http.MethodGet {
		content, version, err := service.NginxReadSite(name)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"name": name, "content": content, "resourceVersion": version})
		return
	}
	var req struct {
		Content         string `json:"content"`
		ResourceVersion string `json:"resourceVersion"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := service.NginxUpdateSite(name, req.Content, req.ResourceVersion); err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "resource changed") {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// NginxCreateSite POST /api/sites/nginx/site/create
func NginxCreateSite(c *gin.Context) {
	var req struct {
		Name           string `json:"name"`
		Content        string `json:"content"`
		CreateDatabase bool   `json:"createDatabase"`
		DatabaseName   string `json:"databaseName"`
		DatabaseUser   string `json:"databaseUser"`
		DatabasePass   string `json:"databasePassword"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "site name required"})
		return
	}

	var database *service.MariaDBCredentials
	if req.CreateDatabase {
		if !strings.Contains(req.Content, "fastcgi_pass") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "附加 MariaDB 数据库仅适用于 PHP 站点"})
			return
		}
		created, err := service.MariaDBCreateDatabase(req.DatabaseName, req.DatabaseUser, req.DatabasePass)
		if err != nil {
			status := http.StatusBadRequest
			if strings.Contains(err.Error(), "cannot connect") || strings.Contains(err.Error(), "command failed") {
				status = http.StatusServiceUnavailable
			}
			c.JSON(status, gin.H{"error": err.Error()})
			return
		}
		database = &created
	}

	if err := service.NginxCreateSite(req.Name, req.Content); err != nil {
		if database != nil {
			_ = service.MariaDBDeleteDatabase(database.Database, database.Username)
		}
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "already exists") || strings.Contains(err.Error(), "already belongs") {
			status = http.StatusConflict
		} else if strings.Contains(err.Error(), "invalid") || strings.Contains(err.Error(), "required") || strings.Contains(err.Error(), "must contain") {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"success": true, "database": database})
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

// MariaDBDatabases GET /api/sites/mariadb
func MariaDBDatabases(c *gin.Context) {
	databases, err := service.MariaDBListDatabases()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"databases": databases})
}

// MariaDBCreate POST /api/sites/mariadb/create
func MariaDBCreate(c *gin.Context) {
	var req struct {
		Database string `json:"database"`
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	credentials, err := service.MariaDBCreateDatabase(req.Database, req.Username, req.Password)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "cannot connect") || strings.Contains(err.Error(), "command failed") {
			status = http.StatusServiceUnavailable
		} else if strings.Contains(err.Error(), "already exists") {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "credentials": credentials})
}

// MariaDBDelete POST /api/sites/mariadb/delete
func MariaDBDelete(c *gin.Context) {
	var req struct {
		Database string `json:"database"`
		Username string `json:"username"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := service.MariaDBDeleteManagedDatabase(req.Database, req.Username); err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "cannot verify") {
			status = http.StatusServiceUnavailable
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// MariaDBUsers GET /api/sites/mariadb/users
func MariaDBUsers(c *gin.Context) {
	users, err := service.MariaDBListUsers()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"users": users})
}

// MariaDBUserCreate POST /api/sites/mariadb/users/create
func MariaDBUserCreate(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	credentials, err := service.MariaDBCreateUser(req.Username, req.Password)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "cannot connect") || strings.Contains(err.Error(), "command failed") {
			status = http.StatusServiceUnavailable
		} else if strings.Contains(err.Error(), "already exists") {
			status = http.StatusConflict
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"success": true, "credentials": credentials})
}

// MariaDBUserPassword POST /api/sites/mariadb/users/password
func MariaDBUserPassword(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	password, err := service.MariaDBResetUserPassword(req.Username, req.Password)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "cannot verify") || strings.Contains(err.Error(), "command failed") {
			status = http.StatusServiceUnavailable
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "username": req.Username, "password": password, "host": "127.0.0.1"})
}

// MariaDBUserGrant POST /api/sites/mariadb/users/grant
func MariaDBUserGrant(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Database string `json:"database"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := service.MariaDBGrantDatabase(req.Username, req.Database); err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "cannot verify") || strings.Contains(err.Error(), "command failed") {
			status = http.StatusServiceUnavailable
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// MariaDBUserRevoke POST /api/sites/mariadb/users/revoke
func MariaDBUserRevoke(c *gin.Context) {
	var req struct {
		Username string `json:"username"`
		Database string `json:"database"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := service.MariaDBRevokeDatabase(req.Username, req.Database); err != nil {
		status := http.StatusBadRequest
		if strings.Contains(err.Error(), "cannot verify") || strings.Contains(err.Error(), "command failed") {
			status = http.StatusServiceUnavailable
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}
