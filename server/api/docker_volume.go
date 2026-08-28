package api

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/moby/moby/client"
)

/*
==================================================
GET /api/docker/volumes

Volume 列表
==================================================
*/

func DockerVolumeList(c *gin.Context) {

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

	result, err := cli.VolumeList(
		context.Background(),
		client.VolumeListOptions{},
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

	volumes := make([]gin.H, 0)

	for _, volume := range result.Items {

		volumes = append(
			volumes,
			gin.H{
				"name":       volume.Name,
				"driver":     volume.Driver,
				"mountpoint": volume.Mountpoint,
				"created":    volume.CreatedAt,
				"scope":      volume.Scope,
				"labels":     volume.Labels,
				"options":    volume.Options,
			},
		)

	}

	c.JSON(
		http.StatusOK,
		volumes,
	)
}

/*
==================================================
POST /api/docker/volume

创建 Volume

body:

{
	"name": "my-volume",
	"driver": "local",
	"labels": {},
	"options": {}
}

==================================================
*/

type DockerVolumeCreateRequest struct {
	Name    string            `json:"name"`
	Driver  string            `json:"driver"`
	Labels  map[string]string `json:"labels"`
	Options map[string]string `json:"options"`
}

func DockerVolumeCreate(c *gin.Context) {

	var req DockerVolumeCreateRequest

	if err := c.ShouldBindJSON(&req); err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	req.Name = strings.TrimSpace(req.Name)

	if req.Name == "" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "missing volume name",
			},
		)

		return
	}

	/*
	 * 默认使用 local driver
	 */

	driver := strings.TrimSpace(
		req.Driver,
	)

	if driver == "" {
		driver = "local"
	}

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

	/*
	 * Docker SDK 当前版本：
	 *
	 * VolumeCreate()
	 *
	 * 返回：
	 *
	 * client.VolumeCreateResult
	 *
	 * 该结构不直接提供：
	 *
	 * Name
	 * Driver
	 * Mountpoint
	 * CreatedAt
	 * Scope
	 *
	 * 所以这里只判断创建是否成功。
	 */

	_, err = cli.VolumeCreate(
		context.Background(),
		client.VolumeCreateOptions{
			Name:       req.Name,
			Driver:     driver,
			Labels:     req.Labels,
			DriverOpts: req.Options,
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

	/*
	 * 创建成功之后重新查询 Volume。
	 *
	 * 这样可以拿到 Docker 实际创建后的完整信息。
	 */

	list, err := cli.VolumeList(
		context.Background(),
		client.VolumeListOptions{},
	)

	if err != nil {

		/*
		 * Volume 已经创建成功，
		 * 只是查询详情失败。
		 */

		c.JSON(
			http.StatusOK,
			gin.H{
				"success": true,
				"name":    req.Name,
				"driver":  driver,
			},
		)

		return
	}

	/*
	 * 找到刚刚创建的 Volume
	 */

	for _, volume := range list.Items {

		if volume.Name != req.Name {
			continue
		}

		c.JSON(
			http.StatusOK,
			gin.H{
				"success":    true,
				"name":       volume.Name,
				"driver":     volume.Driver,
				"mountpoint": volume.Mountpoint,
				"created":    volume.CreatedAt,
				"scope":      volume.Scope,
				"labels":     volume.Labels,
				"options":    volume.Options,
			},
		)

		return
	}

	/*
	 * 创建成功，但没有在列表中找到。
	 */

	c.JSON(
		http.StatusOK,
		gin.H{
			"success": true,
			"name":    req.Name,
			"driver":  driver,
		},
	)
}

/*
==================================================
DELETE /api/docker/volume/:name

删除 Volume
==================================================
*/

func DockerVolumeRemove(c *gin.Context) {

	name := strings.TrimSpace(
		c.Param("name"),
	)

	if name == "" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "missing volume name",
			},
		)

		return
	}

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

	_, err = cli.VolumeRemove(
		context.Background(),
		name,
		client.VolumeRemoveOptions{
			Force: true,
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
			"success": true,
			"name":    name,
		},
	)
}
