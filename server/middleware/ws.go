package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"panel/auth"
)

func AuthWS() gin.HandlerFunc {

	return func(c *gin.Context) {

		if !auth.Check(c.Request) {

			// 兼容 WebSocket 握手不支持 Cookie 的场景
			session := c.Query("session")
			if session == "" {
				c.AbortWithStatus(http.StatusUnauthorized)
				return
			}

			if !auth.CheckSession(session) {
				c.AbortWithStatus(http.StatusUnauthorized)
				return
			}

			c.Next()
			return

		}

		c.Next()

	}

}
