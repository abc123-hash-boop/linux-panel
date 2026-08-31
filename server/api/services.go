package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"panel/service"
)



func Services(c *gin.Context){

	list,err:=service.ListServices()

	if err!=nil{
		c.JSON(500,gin.H{
			"error":err.Error(),
		})
		return
	}


	c.JSON(http.StatusOK,list)
}




func ServiceAction(c *gin.Context){

	name:=c.Param("name")
	action:=c.Param("action")


	err:=service.Action(
		name,
		action,
	)


	if err!=nil{

		c.JSON(500,gin.H{
			"error":err.Error(),
		})

		return
	}


	c.JSON(200,gin.H{
		"success":true,
	})
}
