package api

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/moby/moby/client"
)

/*
========================================================
GET /api/docker/containers

获取容器列表

返回:

[
 {
   id,
   name,
   image,
   state,
   status,
   ip,
   ports
 }
]

========================================================
*/

func DockerContainerList(
	c *gin.Context,
) {

	cli, err := dockerClient()

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	defer cli.Close()

	result, err := cli.ContainerList(
		context.Background(),
		client.ContainerListOptions{
			All: true,
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

	containers := make(
		[]gin.H,
		0,
	)

	for _, item := range result.Items {

		name := ""

		if len(item.Names) > 0 {

			name = strings.TrimPrefix(
				item.Names[0],
				"/",
			)

		}

		ip := ""

		for _, network := range item.NetworkSettings.Networks {

			if network.IPAddress.IsValid() {
				ip = network.IPAddress.String()
			}

			break

		}

		ports := make(
			[]string,
			0,
		)

		for _, port := range item.Ports {

			if port.PublicPort != 0 {

				ports = append(
					ports,
					fmt.Sprintf(
						"%d:%d/%s",
						port.PublicPort,
						port.PrivatePort,
						port.Type,
					),
				)

			} else {

				ports = append(
					ports,
					fmt.Sprintf(
						"%d/%s",
						port.PrivatePort,
						port.Type,
					),
				)

			}

		}

		containers = append(
			containers,
			gin.H{

				"id": item.ID,

				"name": name,

				"image": item.Image,

				"state": item.State,

				"status": item.Status,

				"ip": ip,

				"ports": ports,
			},
		)

	}

	c.JSON(
		http.StatusOK,
		containers,
	)

}

/*
========================================================
POST /api/docker/container/start/:id

启动容器

========================================================
*/

func DockerContainerStart(
	c *gin.Context,
) {

	id := c.Param("id")

	if id == "" {

		c.JSON(
			400,
			gin.H{
				"error": "missing id",
			},
		)

		return

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

	_, err = cli.ContainerStart(
		context.Background(),
		id,
		client.ContainerStartOptions{},
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
		200,
		gin.H{
			"success": true,
		},
	)

}

/*
========================================================
POST /api/docker/container/stop/:id

停止容器

========================================================
*/

func DockerContainerStop(
	c *gin.Context,
) {

	id := c.Param("id")

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

	_, err = cli.ContainerStop(
		context.Background(),
		id,
		client.ContainerStopOptions{},
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
		200,
		gin.H{
			"success": true,
		},
	)

}

/*
========================================================
POST /api/docker/container/restart/:id

重启容器

========================================================
*/

func DockerContainerRestart(
	c *gin.Context,
) {

	id := c.Param("id")

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

	_, err = cli.ContainerRestart(
		context.Background(),
		id,
		client.ContainerRestartOptions{},
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
		200,
		gin.H{
			"success": true,
		},
	)

}

/*
========================================================
DELETE /api/docker/container/:id

删除容器

========================================================
*/

func DockerContainerRemove(
	c *gin.Context,
) {

	id := c.Param("id")

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

	_, err = cli.ContainerRemove(
		context.Background(),
		id,
		client.ContainerRemoveOptions{
			Force: true,
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
		200,
		gin.H{
			"success": true,
		},
	)

}
