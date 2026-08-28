package api

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/moby/moby/client"
)

type DockerExecRequest struct {
	Container string `json:"container"`

	Cmd []string `json:"cmd"`

	TTY bool `json:"tty"`
}

func DockerContainerExec(
	c *gin.Context,
) {

	var req DockerExecRequest

	if err := c.ShouldBindJSON(&req); err != nil {

		c.JSON(
			400,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	if req.Cmd == nil {

		req.Cmd = []string{
			"/bin/sh",
		}

	}

	cli, err := dockerClient()

	if err != nil {

		c.JSON(
			500,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	defer cli.Close()

	result, err := cli.ExecCreate(
		context.Background(),
		req.Container,
		client.ExecCreateOptions{

			Cmd: req.Cmd,

			AttachStdin: true,

			AttachStdout: true,

			AttachStderr: true,

			TTY: req.TTY,
		},
	)

	if err != nil {

		c.JSON(
			500,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,
		gin.H{

			"id": result.ID,
		},
	)

}
