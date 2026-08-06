package api


import (

	"net/http"

	"os"

	"github.com/gin-gonic/gin"

)



func FileRead(c *gin.Context){



	path := c.Query("path")



	if path==""{


		c.JSON(

			400,

			gin.H{

				"error":"path empty",

			},

		)


		return

	}





	info,err:=os.Stat(path)



	if err!=nil || info.IsDir(){


		c.JSON(

			400,

			gin.H{

				"error":"not file",

			},

		)


		return

	}





	data,err:=os.ReadFile(path)



	if err!=nil{


		c.JSON(

			500,

			gin.H{

				"error":err.Error(),

			},

		)


		return

	}





	// 限制大小 2MB

	if len(data)>2*1024*1024{


		c.JSON(

			400,

			gin.H{

				"error":"file too large",

			},

		)


		return

	}





	c.JSON(

		http.StatusOK,

		gin.H{


			"path":path,


			"content":string(data),


		},

	)


}
