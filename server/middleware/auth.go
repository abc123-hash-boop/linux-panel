package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"panel/auth"
)

func Auth() gin.HandlerFunc {

	return func(c *gin.Context) {

		if !auth.Check(c.Request) {

			c.Abort()

			c.JSON(
				http.StatusUnauthorized,
				gin.H{

					"error": "unauthorized",
				},
			)

			return

		}

		c.Next()

	}

}
