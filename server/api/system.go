package api

import (
	"github.com/gin-gonic/gin"
	"panel/service"
)

func SystemStatus(c *gin.Context) {

	c.JSON(
		200,
		service.SystemStatus(),
	)

}
