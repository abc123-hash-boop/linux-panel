package websocket


import (

    "os/exec"

    "github.com/gin-gonic/gin"

    "github.com/creack/pty"

    gorilla "github.com/gorilla/websocket"

)



func Terminal(c *gin.Context){


    ws,err:=upgrader.Upgrade(

        c.Writer,

        c.Request,

        nil,

    )


    if err!=nil{

        return

    }


    defer ws.Close()



    cmd:=exec.Command(

        "/bin/bash",

        "-l",

    )




    ptmx,err:=pty.Start(cmd)


    if err!=nil{

        return

    }



    defer ptmx.Close()




    // shell输出 -> websocket

    go func(){


        buf:=make([]byte,4096)


        for{


            n,err:=ptmx.Read(buf)


            if err!=nil{

                return

            }


            ws.WriteMessage(

                gorilla.TextMessage,

                buf[:n],

            )


        }


    }()





    // websocket输入 -> shell

    for{


        _,msg,err:=ws.ReadMessage()


        if err!=nil{

            break

        }



        ptmx.Write(msg)


    }



    cmd.Process.Kill()

}
