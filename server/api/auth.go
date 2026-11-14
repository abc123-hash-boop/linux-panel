package api

import (
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/gin-gonic/gin"

	"panel/auth"
	"panel/database"
)

func Login(c *gin.Context) {
	if !database.IsInitialized() {
		c.JSON(http.StatusForbidden, gin.H{"error": "setup_required"})
		return
	}

	var data struct {
		Username string `json:"username"`

		Password string `json:"password"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {

		c.JSON(400, gin.H{

			"error": "bad request",
		})

		return

	}

	session :=
		auth.Login(
			data.Username,
			data.Password,
		)

	if session == "" {

		c.JSON(
			http.StatusUnauthorized,
			gin.H{

				"error": "login failed",
			},
		)

		return

	}

	auth.SetCookie(
		c.Writer,
		session,
	)

	c.JSON(200, gin.H{

		"message": "ok",
	})

}

// SetupStatus reports whether the first administrator account has been created.
func SetupStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"initialized": database.IsInitialized()})
}

// CompleteSetup creates the first administrator using the one-time console token.
func CompleteSetup(c *gin.Context) {
	var data struct {
		Token    string `json:"token"`
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求格式无效"})
		return
	}

	data.Token = strings.TrimSpace(data.Token)
	data.Username = strings.TrimSpace(data.Username)
	if data.Token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请输入控制台显示的 Token"})
		return
	}
	if utf8.RuneCountInString(data.Username) < 3 || utf8.RuneCountInString(data.Username) > 32 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "用户名长度必须为 3 到 32 个字符"})
		return
	}
	for _, r := range data.Username {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' || r == '-' || r == '.') {
			c.JSON(http.StatusBadRequest, gin.H{"error": "用户名只能包含英文字母、数字、点、下划线和连字符"})
			return
		}
	}
	if len(data.Password) < 8 || len(data.Password) > 72 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "密码长度必须为 8 到 72 字节"})
		return
	}

	if err := database.CompleteSetup(data.Token, data.Username, data.Password); err != nil {
		switch err {
		case database.ErrInvalidSetupToken:
			c.JSON(http.StatusForbidden, gin.H{"error": "Token 无效或已过期，请检查服务器控制台"})
		case database.ErrSetupNotRequired:
			c.JSON(http.StatusConflict, gin.H{"error": "系统已经完成初始化，请直接登录"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "创建管理员失败"})
		}
		return
	}

	session := auth.Login(data.Username, data.Password)
	if session == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "管理员已创建，但自动登录失败，请手动登录"})
		return
	}
	auth.SetCookie(c.Writer, session)
	c.JSON(http.StatusOK, gin.H{"message": "ok"})
}
