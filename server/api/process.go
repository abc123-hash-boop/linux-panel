package api

import (
    "net/http"
    "os"
    "strconv"

    "github.com/gin-gonic/gin"
)


func KillProcess(c *gin.Context){

    pidText :=
        c.Param("pid")


    pid,err :=
        strconv.Atoi(pidText)


    if err != nil {

        c.JSON(
            400,
            gin.H{
                "error":"invalid pid",
            },
        )

        return
    }


    process,err :=
        os.FindProcess(pid)


    if err != nil {

        c.JSON(
            500,
            gin.H{
                "error":err.Error(),
            },
        )

        return
    }


    err =
    process.Kill()


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
        gin.H{
            "success":true,
        },
    )

}
