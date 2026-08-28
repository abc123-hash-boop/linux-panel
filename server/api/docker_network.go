package api

import (
	"context"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/moby/moby/api/types/network"
	"github.com/moby/moby/client"
)

/*
========================================================
GET /api/docker/networks

获取 Docker Network 列表

返回：

[
	{
		id,
		name,
		driver,
		scope,
		ipv4,
		ipv6,
		internal,
		attachable
	}
]

========================================================
*/

func DockerNetworkList(
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

	result, err := cli.NetworkList(
		context.Background(),
		client.NetworkListOptions{},
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

	networks := make(
		[]gin.H,
		0,
		len(result.Items),
	)

	for _, item := range result.Items {

		networks = append(
			networks,
			dockerNetworkSummary(
				item,
			),
		)

	}

	c.JSON(
		http.StatusOK,
		networks,
	)

}

/*
========================================================
Network Summary

注意：

network.Summary 在当前 Moby API 中只有：

	network.Network

Containers 不属于 Summary。

Containers 需要通过 NetworkInspect 获取。

========================================================
*/

func dockerNetworkSummary(
	item network.Summary,
) gin.H {

	ipv4 := make(
		[]string,
		0,
	)

	ipv6 := make(
		[]string,
		0,
	)

	for _, cfg := range item.IPAM.Config {

		if !cfg.Subnet.IsValid() {
			continue
		}

		subnet := cfg.Subnet.String()

		if strings.Contains(
			subnet,
			":",
		) {

			ipv6 = append(
				ipv6,
				subnet,
			)

		} else {

			ipv4 = append(
				ipv4,
				subnet,
			)

		}

	}

	return gin.H{

		"id":
			item.ID,

		"name":
			item.Name,

		"driver":
			item.Driver,

		"scope":
			item.Scope,

		"ipv4":
			ipv4,

		"ipv6":
			ipv6,

		"internal":
			item.Internal,

		"attachable":
			item.Attachable,

	}

}

/*
========================================================
GET /api/docker/network/:id

获取 Network 详细信息

这里使用 NetworkInspect，
因为只有 network.Inspect 才包含 Containers。

========================================================
*/

func DockerNetworkInspect(
	c *gin.Context,
) {

	id := strings.TrimSpace(
		c.Param("id"),
	)

	if id == "" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "missing network id",
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

	result, err := cli.NetworkInspect(
		context.Background(),
		id,
		client.NetworkInspectOptions{
			Verbose: true,
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

	info := result.Network

	ipv4 := make(
		[]gin.H,
		0,
	)

	ipv6 := make(
		[]gin.H,
		0,
	)

	for _, cfg := range info.IPAM.Config {

		entry := gin.H{

			"subnet":
				"-",

			"ip_range":
				"-",

			"gateway":
				"-",

		}

		if cfg.Subnet.IsValid() {

			entry["subnet"] =
				cfg.Subnet.String()

		}

		if cfg.IPRange.IsValid() {

			entry["ip_range"] =
				cfg.IPRange.String()

		}

		if cfg.Gateway.IsValid() {

			entry["gateway"] =
				cfg.Gateway.String()

		}

		if cfg.Subnet.IsValid() &&
			strings.Contains(
				cfg.Subnet.String(),
				":",
			) {

			ipv6 = append(
				ipv6,
				entry,
			)

		} else {

			ipv4 = append(
				ipv4,
				entry,
			)

		}

	}

	containers := make(
		[]gin.H,
		0,
		len(info.Containers),
	)

	for containerID, endpoint :=
		range info.Containers {

		ipv4Address := "-"

		if endpoint.IPv4Address.IsValid() {

			ipv4Address =
				endpoint.IPv4Address.String()

		}

		ipv6Address := "-"

		if endpoint.IPv6Address.IsValid() {

			ipv6Address =
				endpoint.IPv6Address.String()

		}

		containers = append(
			containers,
			gin.H{

				"id":
					containerID,

				"name":
					endpoint.Name,

				"endpoint_id":
					endpoint.EndpointID,

				"mac_address":
					endpoint.MacAddress.String(),

				"ipv4":
					ipv4Address,

				"ipv6":
					ipv6Address,

			},
		)

	}

	c.JSON(
		http.StatusOK,
		gin.H{

			"id":
				info.ID,

			"name":
				info.Name,

			"driver":
				info.Driver,

			"scope":
				info.Scope,

			"created":
				info.Created,

			"enable_ipv4":
				info.EnableIPv4,

			"enable_ipv6":
				info.EnableIPv6,

			"internal":
				info.Internal,

			"attachable":
				info.Attachable,

			"ingress":
				info.Ingress,

			"ipv4":
				ipv4,

			"ipv6":
				ipv6,

			"ipam":
				gin.H{

					"driver":
						info.IPAM.Driver,

					"options":
						info.IPAM.Options,

				},

			"options":
				info.Options,

			"labels":
				info.Labels,

			"containers":
				containers,

		},
	)

}

/*
========================================================
POST /api/docker/network

创建 Network

请求：

{
	"name": "test-network",
	"driver": "bridge",
	"scope": "local",
	"internal": false,
	"attachable": true,
	"enable_ipv4": true,
	"enable_ipv6": false,
	"options": {},
	"labels": {}
}

========================================================
*/

type DockerNetworkCreateRequest struct {

	Name string `json:"name"`

	Driver string `json:"driver"`

	Scope string `json:"scope"`

	Internal bool `json:"internal"`

	Attachable bool `json:"attachable"`

	EnableIPv4 *bool `json:"enable_ipv4"`

	EnableIPv6 *bool `json:"enable_ipv6"`

	IPAM *network.IPAM `json:"ipam"`

	Options map[string]string `json:"options"`

	Labels map[string]string `json:"labels"`

}

/*
========================================================
POST /api/docker/network

创建 Network
========================================================
*/

func DockerNetworkCreate(
	c *gin.Context,
) {

	var req DockerNetworkCreateRequest

	if err := c.ShouldBindJSON(
		&req,
	); err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	req.Name = strings.TrimSpace(
		req.Name,
	)

	if req.Name == "" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "missing network name",
			},
		)

		return
	}

	driver := strings.TrimSpace(
		req.Driver,
	)

	if driver == "" {

		driver = "bridge"

	}

	scope := strings.TrimSpace(
		req.Scope,
	)

	if scope == "" {

		scope = "local"

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

	result, err := cli.NetworkCreate(
		context.Background(),
		req.Name,
		client.NetworkCreateOptions{

			Driver:
				driver,

			Scope:
				scope,

			EnableIPv4:
				req.EnableIPv4,

			EnableIPv6:
				req.EnableIPv6,

			IPAM:
				req.IPAM,

			Internal:
				req.Internal,

			Attachable:
				req.Attachable,

			Options:
				req.Options,

			Labels:
				req.Labels,

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

			"success":
				true,

			"id":
				result.ID,

			"warnings":
				result.Warning,

			"name":
				req.Name,

		},
	)

}

/*
========================================================
DELETE /api/docker/network/:id

删除 Network

如果 Network 仍然有容器连接，
Docker 会返回错误。

========================================================
*/

func DockerNetworkRemove(
	c *gin.Context,
) {

	id := strings.TrimSpace(
		c.Param("id"),
	)

	if id == "" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "missing network id",
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

	_, err = cli.NetworkRemove(
		context.Background(),
		id,
		client.NetworkRemoveOptions{},
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

			"success":
				true,

			"id":
				id,

		},
	)

}

/*
========================================================
POST /api/docker/network/:id/connect

将 Container 连接到 Network

请求：

{
	"container": "terminal-test"
}

========================================================
*/

type DockerNetworkContainerRequest struct {

	Container string `json:"container"`

}

/*
========================================================
POST /api/docker/network/:id/connect

========================================================
*/

func DockerNetworkConnect(
	c *gin.Context,
) {

	id := strings.TrimSpace(
		c.Param("id"),
	)

	if id == "" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "missing network id",
			},
		)

		return
	}

	var req DockerNetworkContainerRequest

	if err := c.ShouldBindJSON(
		&req,
	); err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	req.Container = strings.TrimSpace(
		req.Container,
	)

	if req.Container == "" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "missing container",
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

	_, err = cli.NetworkConnect(
		context.Background(),
		id,
		client.NetworkConnectOptions{

			Container:
				req.Container,

			EndpointConfig:
				nil,

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

			"success":
				true,

			"network":
				id,

			"container":
				req.Container,

		},
	)

}

/*
========================================================
POST /api/docker/network/:id/disconnect

从 Network 中断开 Container

请求：

{
	"container": "terminal-test",
	"force": false
}

========================================================
*/

type DockerNetworkDisconnectRequest struct {

	Container string `json:"container"`

	Force bool `json:"force"`

}

/*
========================================================
POST /api/docker/network/:id/disconnect

========================================================
*/

func DockerNetworkDisconnect(
	c *gin.Context,
) {

	id := strings.TrimSpace(
		c.Param("id"),
	)

	if id == "" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "missing network id",
			},
		)

		return
	}

	var req DockerNetworkDisconnectRequest

	if err := c.ShouldBindJSON(
		&req,
	); err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	req.Container = strings.TrimSpace(
		req.Container,
	)

	if req.Container == "" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "missing container",
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

	_, err = cli.NetworkDisconnect(
		context.Background(),
		id,
		client.NetworkDisconnectOptions{

			Container:
				req.Container,

			Force:
				req.Force,

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

			"success":
				true,

			"network":
				id,

			"container":
				req.Container,

		},
	)

}
