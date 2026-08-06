package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"panel/auth"
)

func Login(c *gin.Context) {

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
