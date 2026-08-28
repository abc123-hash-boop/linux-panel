package api

import (
	"context"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/moby/moby/client"
)

/*
============================================================
Docker Client

使用 Moby 最新 API

github.com/moby/moby/client

============================================================
*/

func dockerClient() (
	client.APIClient,
	error,
) {

	return client.New(
		client.FromEnv,
	)

}

/*
============================================================
Docker Info Response

前端使用简化结构

============================================================
*/

type DockerInfoResponse struct {
	ID string `json:"id"`

	ServerVersion string `json:"server_version"`

	OperatingSystem string `json:"os"`

	KernelVersion string `json:"kernel"`

	Architecture string `json:"architecture"`

	Containers int `json:"containers"`

	Running int `json:"running"`

	Paused int `json:"paused"`

	Stopped int `json:"stopped"`

	Images int `json:"images"`

	CPU int `json:"cpu"`

	Memory uint64 `json:"memory"`

	StorageDriver string `json:"storage_driver"`

	CgroupVersion string `json:"cgroup_version"`

	DockerRoot string `json:"docker_root"`
}

/*
============================================================
GET /api/docker/info

获取 Docker 信息

============================================================
*/

func DockerInfo(
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

	infoResult, err := cli.Info(
		context.Background(),
		client.InfoOptions{},
	)

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	info := infoResult.Info

	result := DockerInfoResponse{

		ID: info.ID,

		ServerVersion: info.ServerVersion,

		OperatingSystem: info.OperatingSystem,

		KernelVersion: info.KernelVersion,

		Architecture: info.Architecture,

		Containers: info.Containers,

		Running: info.ContainersRunning,

		Paused: info.ContainersPaused,

		Stopped: info.ContainersStopped,

		Images: info.Images,

		CPU: info.NCPU,

		Memory: uint64(info.MemTotal),

		StorageDriver: info.Driver,

		CgroupVersion: info.CgroupVersion,

		DockerRoot: info.DockerRootDir,
	}

	c.JSON(
		http.StatusOK,
		result,
	)

}

/*
============================================================
GET /api/docker/containers

获取全部容器

包含:
- running
- stopped

============================================================
*/

func DockerContainers(
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
			http.StatusInternalServerError,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,

		gin.H{

			"containers": result,
		},
	)

}
