package api


import (

    "net/http"

    "os"

    "github.com/gin-gonic/gin"

)



type WriteRequest struct {


    Path string `json:"path"`


    Content string `json:"content"`


}




func FileWrite(c *gin.Context){



    var req WriteRequest



    if err:=c.ShouldBindJSON(&req); err!=nil{


        c.JSON(

            http.StatusBadRequest,

            gin.H{

                "error":"invalid request",

            },

        )


        return

    }




    if req.Path==""{


        c.JSON(

            400,

            gin.H{

                "error":"path empty",

            },

        )


        return

    }




    // 防止写目录

    info,err:=os.Stat(req.Path)


    if err==nil && info.IsDir(){


        c.JSON(

            400,

            gin.H{

                "error":"cannot write directory",

            },

        )


        return

    }





    // 写文件

    err=os.WriteFile(

        req.Path,

        []byte(req.Content),

        0644,

    )




    if err!=nil{


        c.JSON(

            500,

            gin.H{

                "error":err.Error(),

            },

        )


        return

    }





    c.JSON(

        200,

        gin.H{

            "message":"saved",

        },

    )


}
