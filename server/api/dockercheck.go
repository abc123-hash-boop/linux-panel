package api

import (
	"os"

	"github.com/gin-gonic/gin"
)

func DockerCheck(c *gin.Context) {

	_, err := os.Stat("/var/run/docker.sock")

	if err == nil {
		c.JSON(200, gin.H{
			"installed": true,
		})
		return
	}

	c.JSON(200, gin.H{
		"installed": false,
	})
}
