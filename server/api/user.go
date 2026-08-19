package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"panel/database"

	"panel/auth"

	"golang.org/x/crypto/bcrypt"
)

func ChangePassword(c *gin.Context) {

	username :=
		auth.GetUser(
			c.Request,
		)

	if username == "" {

		c.JSON(
			http.StatusUnauthorized,
			gin.H{
				"error": "unauthorized",
			},
		)

		return

	}

	var data struct {
		OldPassword string `json:"old_password"`

		NewPassword string `json:"new_password"`
	}

	if err := c.ShouldBindJSON(&data); err != nil {

		c.JSON(400, gin.H{

			"error": "bad request",
		})

		return

	}

	var hash string

	err :=
		database.DB.QueryRow(

			"SELECT password FROM users WHERE username=?",

			username,
		).Scan(&hash)

	if err != nil {

		c.JSON(500, gin.H{

			"error": "user not found",
		})

		return

	}

	// 验证旧密码

	err =
		bcrypt.CompareHashAndPassword(

			[]byte(hash),

			[]byte(data.OldPassword),
		)

	if err != nil {

		c.JSON(400, gin.H{

			"error": "old password wrong",
		})

		return

	}

	// 新密码加密

	newHash, _ :=
		bcrypt.GenerateFromPassword(

			[]byte(data.NewPassword),

			bcrypt.DefaultCost,
		)

	_, err =
		database.DB.Exec(

			"UPDATE users SET password=? WHERE username=?",

			string(newHash),

			username,
		)

	if err != nil {

		c.JSON(500, gin.H{

			"error": "update failed",
		})

		return

	}

	c.JSON(200, gin.H{

		"message": "password changed",
	})

}
func Logout(c *gin.Context) {

	auth.Logout(
		c.Request,
	)

	c.SetCookie(

		"session",

		"",

		-1,

		"/",

		"",

		false,

		true,
	)

	c.JSON(200, gin.H{

		"message": "logout",
	})

}
