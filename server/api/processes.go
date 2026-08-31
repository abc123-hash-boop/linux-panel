package api


import (
	"net/http"

	"github.com/gin-gonic/gin"

	"panel/service"
)



func Processes(c *gin.Context){


	list,err :=
		service.ListProcesses()


	if err != nil {

		c.JSON(
			500,
			gin.H{
				"error":err.Error(),
			},
		)

		return
	}



	c.JSON(
		http.StatusOK,
		list,
	)

}
