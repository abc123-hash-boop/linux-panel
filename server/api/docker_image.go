package api

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"panel/service"

	"github.com/gin-gonic/gin"
	"github.com/moby/moby/client"
)

/*
==================================================
GET /api/docker/images

镜像列表

==================================================
*/

func DockerImageList(c *gin.Context) {

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

	result, err := cli.ImageList(
		context.Background(),
		client.ImageListOptions{
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

	images := make([]gin.H, 0)

	for _, image := range result.Items {

		images = append(
			images,
			gin.H{

				"id": image.ID,

				"tags": image.RepoTags,

				"size": image.Size,

				"created": image.Created,

				"containers": image.Containers,
			},
		)

	}

	c.JSON(
		http.StatusOK,
		images,
	)

}

/*
==================================================
POST /api/docker/image/pull

body:

{
 "image":"ubuntu:latest"
}

==================================================
*/

type DockerImagePullRequest struct {
	Image string `json:"image"`
}

type DockerPullMessage struct {
	Status string `json:"status"`

	ID string `json:"id"`

	ProgressDetail struct {
		Current int64 `json:"current"`

		Total int64 `json:"total"`
	} `json:"progressDetail"`
}

func DockerImagePull(c *gin.Context) {

	var req DockerImagePullRequest

	if err := c.ShouldBindJSON(&req); err != nil {

		c.JSON(
			400,
			gin.H{
				"error": err.Error(),
			},
		)

		return

	}

	if req.Image == "" {

		c.JSON(
			400,
			gin.H{
				"error": "missing image",
			},
		)

		return

	}

	taskID :=
		"pull-" +
			strings.ReplaceAll(
				req.Image,
				":",
				"-",
			)

	task := &service.DockerPullTask{

		ID: taskID,

		Image: req.Image,

		Status: "running",

		Progress: 0,

		Layers: make(
			map[string]*service.DockerLayer,
		),

		Logs: []string{},
	}

	service.AddDockerPullTask(task)

	go func() {

		cli, err := dockerClient()

		if err != nil {

			task.Status = "failed"

			task.Logs = append(
				task.Logs,
				err.Error(),
			)

			return

		}

		defer cli.Close()

		reader, err := cli.ImagePull(
			context.Background(),
			req.Image,
			client.ImagePullOptions{},
		)

		if err != nil {

			task.Status = "failed"

			task.Logs = append(
				task.Logs,
				err.Error(),
			)

			return

		}

		defer reader.Close()

		decoder := json.NewDecoder(reader)

		for {

			var msg DockerPullMessage

			err := decoder.Decode(&msg)

			if err != nil {

				break

			}

			if msg.Status != "" {

				task.Logs = append(
					task.Logs,
					msg.Status,
				)

			}

			if msg.ID != "" {

				layer := task.Layers[msg.ID]

				if layer == nil {

					layer = &service.DockerLayer{

						ID: msg.ID,
					}

					task.Layers[msg.ID] = layer

				}

				layer.Status =
					msg.Status

				layer.Current =
					msg.ProgressDetail.Current

				layer.Total =
					msg.ProgressDetail.Total

				if layer.Total > 0 {

					layer.Progress =
						int(
							float64(layer.Current) /
								float64(layer.Total) *
								100,
						)

				}

				task.Layer = msg.ID

			}

			var total int64

			var current int64

			for _, layer := range task.Layers {

				total += layer.Total

				current += layer.Current

			}

			if total > 0 {

				task.Total = total

				task.Current = current

				task.Progress =
					int(
						float64(current) /
							float64(total) *
							100,
					)

			}

			if msg.Status == "Pull complete" {

				task.Progress = 100

			}

		}

		task.Status = "done"

	}()

	c.JSON(
		200,
		gin.H{

			"success": true,

			"task_id": taskID,
		},
	)

}

/*
==================================================
GET pull status

==================================================
*/

func DockerImagePullStatus(c *gin.Context) {

	id := c.Param("id")

	task := service.GetDockerPullTask(id)

	if task == nil {

		c.JSON(
			404,
			gin.H{
				"error": "task not found",
			},
		)

		return

	}

	c.JSON(
		200,
		task,
	)

}

/*
==================================================
DELETE image

==================================================
*/

func DockerImageRemove(c *gin.Context) {

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

	result, err := cli.ImageRemove(
		context.Background(),
		id,
		client.ImageRemoveOptions{
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

			"result": result,
		},
	)

}
