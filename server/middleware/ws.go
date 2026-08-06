package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"panel/auth"
)

func AuthWS() gin.HandlerFunc {

	return func(c *gin.Context) {

		if !auth.Check(c.Request) {

			c.AbortWithStatus(
				http.StatusUnauthorized,
			)

			return

		}

		c.Next()

	}

}
