package websocket

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"github.com/moby/moby/client"
)

var execUpgrader = websocket.Upgrader{

	CheckOrigin: func(
		r *http.Request,
	) bool {

		return true
	},
}

func DockerExecTerminal(
	c *gin.Context,
) {

	println("docker exec websocket request")

	containerID := c.Param("id")

	println("container:", containerID)

	ws, err := execUpgrader.Upgrade(
		c.Writer,
		c.Request,
		nil,
	)

	if err != nil {

		println(
			"websocket upgrade error:",
			err.Error(),
		)

		return
	}

	println("websocket connected")

	defer ws.Close()

	cli, err := client.New(
		client.FromEnv,
	)

	if err != nil {

		ws.WriteJSON(
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	defer cli.Close()

	ctx := context.Background()

	// 创建 exec

	exec, err := cli.ExecCreate(
		ctx,
		containerID,
		client.ExecCreateOptions{

			Cmd: []string{
				"/bin/bash",
			},

			AttachStdin: true,

			AttachStdout: true,

			AttachStderr: true,

			TTY: true,
		},
	)

	if err != nil {

		ws.WriteJSON(
			gin.H{
				"error": err.Error(),
			},
		)

		return

	}

	println(
		"exec id:",
		exec.ID,
	)

	// attach

	attach, err := cli.ExecAttach(
		ctx,
		exec.ID,
		client.ExecAttachOptions{

			TTY: true,
		},
	)

	if err != nil {

		ws.WriteJSON(
			gin.H{
				"error": err.Error(),
			},
		)

		return

	}

	defer attach.Close()

	dockerConn :=
		attach.HijackedResponse.Conn

	if dockerConn == nil {

		ws.WriteJSON(
			gin.H{
				"error": "docker hijack connection nil",
			},
		)

		return
	}

	println(
		"docker terminal attached",
	)

	// Docker -> xterm

	go func() {

		buf := make(
			[]byte,
			4096,
		)

		for {

			n, err := dockerConn.Read(
				buf,
			)

			if n > 0 {

				ws.WriteMessage(
					websocket.BinaryMessage,
					buf[:n],
				)

			}

			if err != nil {

				break

			}

		}

	}()

	// xterm -> Docker

	for {

		_, data, err := ws.ReadMessage()

		if err != nil {

			break

		}

		_, err = dockerConn.Write(
			data,
		)

		if err != nil {

			break

		}

	}

}
