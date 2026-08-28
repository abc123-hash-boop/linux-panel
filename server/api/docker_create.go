package api

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/gin-gonic/gin"
	"net"
	"net/http"
	"net/netip"
	"strconv"
	"strings"

	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/api/types/mount"
	"github.com/moby/moby/api/types/network"
	"github.com/moby/moby/client"
)

type DockerCommand []string

func (c *DockerCommand) UnmarshalJSON(data []byte) error {
	// 支持：
	// "command": "/sbin/init"
	var str string

	if err := json.Unmarshal(data, &str); err == nil {
		if str == "" {
			*c = nil
			return nil
		}

		*c = []string{str}
		return nil
	}

	// 支持：
	// "command": ["/bin/sh", "-c", "echo hello"]
	var arr []string

	if err := json.Unmarshal(data, &arr); err != nil {
		return err
	}

	*c = arr

	return nil
}

type DockerCreateRequest struct {
	Name string `json:"name"`

	Image string `json:"image"`

	Command DockerCommand `json:"command"`

	Env []string `json:"env"`

	TTY bool `json:"tty"`

	Stdin bool `json:"stdin"`

	Privileged bool `json:"privileged"`

	AutoStart bool `json:"auto_start"`

	Volumes []DockerVolume `json:"volumes"`

	Devices []DockerDevice `json:"devices"`

	Ports []string `json:"ports"`
}

type DockerVolume struct {
	Host string `json:"host"`

	Container string `json:"container"`

	Mode string `json:"mode"`
}

type DockerDevice struct {
	Host string `json:"host"`

	Container string `json:"container"`

	Permissions string `json:"permissions"`
}

func DockerContainerCreate(c *gin.Context) {
	var req DockerCreateRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	if req.Image == "" {
		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "missing image",
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

	/*
		========================================================
		Container Config
		========================================================
	*/

	config := &container.Config{
		Image: req.Image,

		Env: req.Env,

		Tty: req.TTY,

		OpenStdin: req.Stdin,

		StdinOnce: false,
	}

	if len(req.Command) > 0 {
		config.Cmd = []string(req.Command)
	}

	/*
		========================================================
		Host Config
		========================================================
	*/

	hostConfig := &container.HostConfig{
		Privileged: req.Privileged,
	}

	/*
		========================================================
		Volumes
		========================================================
	*/

	for _, v := range req.Volumes {
		if v.Host == "" || v.Container == "" {
			continue
		}

		readOnly := false

		if strings.EqualFold(v.Mode, "ro") {
			readOnly = true
		}

		hostConfig.Mounts = append(
			hostConfig.Mounts,
			mount.Mount{
				Type:     mount.TypeBind,
				Source:   v.Host,
				Target:   v.Container,
				ReadOnly: readOnly,
			},
		)
	}

	/*
		========================================================
		Devices
		========================================================
	*/

	for _, d := range req.Devices {
		if d.Host == "" || d.Container == "" {
			continue
		}

		permissions := d.Permissions

		if permissions == "" {
			permissions = "rwm"
		}

		hostConfig.Resources.Devices = append(
			hostConfig.Resources.Devices,
			container.DeviceMapping{
				PathOnHost:        d.Host,
				PathInContainer:   d.Container,
				CgroupPermissions: permissions,
			},
		)
	}

	/*
		========================================================
		Ports

		前端格式：

		"80:80"
		"8080:80"
		"127.0.0.1:8080:80"
		"8080:80/tcp"
		========================================================
	*/

	if len(req.Ports) > 0 {
		if config.ExposedPorts == nil {
			config.ExposedPorts = network.PortSet{}
		}

		if hostConfig.PortBindings == nil {
			hostConfig.PortBindings = network.PortMap{}
		}

		for _, portSpec := range req.Ports {
			if err := addDockerPort(
				config,
				hostConfig,
				portSpec,
			); err != nil {

				c.JSON(
					http.StatusBadRequest,
					gin.H{
						"error": fmt.Sprintf(
							"invalid port %q: %v",
							portSpec,
							err,
						),
					},
				)

				return
			}
		}
	}

	/*
		========================================================
		ContainerCreate

		Moby v0.5.1 新 API：

		cli.ContainerCreate(
			context,
			client.ContainerCreateOptions{
				Config: ...,
				HostConfig: ...,
				Name: ...,
			},
		)
		========================================================
	*/

	result, err := cli.ContainerCreate(
		context.Background(),

		client.ContainerCreateOptions{
			Config:     config,
			HostConfig: hostConfig,
			Name:       req.Name,
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
		========================================================
		Auto Start
		========================================================
	*/

	if req.AutoStart {
		_, err := cli.ContainerStart(
			context.Background(),
			result.ID,
			client.ContainerStartOptions{},
		)

		if err != nil {
			c.JSON(
				http.StatusInternalServerError,
				gin.H{
					"error":   err.Error(),
					"id":      result.ID,
					"created": true,
					"started": false,
				},
			)

			return
		}
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"success":  true,
			"id":       result.ID,
			"warnings": result.Warnings,
			"started":  req.AutoStart,
		},
	)
}

/*
============================================================
Docker Port Parser

支持：

80:80
8080:80
127.0.0.1:8080:80
80:80/tcp
8080:80/udp
============================================================
*/

func addDockerPort(
	config *container.Config,
	hostConfig *container.HostConfig,
	spec string,
) error {

	spec = strings.TrimSpace(spec)

	if spec == "" {
		return fmt.Errorf("empty port")
	}

	protocol := "tcp"

	/*
		处理：

		80:80/tcp
		80:80/udp
	*/

	if slash := strings.LastIndex(spec, "/"); slash >= 0 {
		protocol = strings.ToLower(
			strings.TrimSpace(spec[slash+1:]),
		)

		spec = spec[:slash]

		if protocol == "" {
			protocol = "tcp"
		}
	}

	parts := strings.Split(spec, ":")

	var hostIP string
	var hostPort string
	var containerPort string

	switch len(parts) {

	case 2:

		// 8080:80

		hostPort = strings.TrimSpace(parts[0])
		containerPort = strings.TrimSpace(parts[1])

	case 3:

		// 127.0.0.1:8080:80

		hostIP = strings.TrimSpace(parts[0])
		hostPort = strings.TrimSpace(parts[1])
		containerPort = strings.TrimSpace(parts[2])

	default:

		return fmt.Errorf(
			"expected HOST:CONTAINER or IP:HOST:CONTAINER",
		)
	}

	if hostPort == "" {
		return fmt.Errorf("missing host port")
	}

	if containerPort == "" {
		return fmt.Errorf("missing container port")
	}

	/*
		检查端口
	*/

	cp, err := strconv.Atoi(containerPort)

	if err != nil {
		return fmt.Errorf(
			"invalid container port: %s",
			containerPort,
		)
	}

	hp, err := strconv.Atoi(hostPort)

	if err != nil {
		return fmt.Errorf(
			"invalid host port: %s",
			hostPort,
		)
	}

	if cp < 1 || cp > 65535 {
		return fmt.Errorf(
			"container port out of range: %d",
			cp,
		)
	}

	if hp < 1 || hp > 65535 {
		return fmt.Errorf(
			"host port out of range: %d",
			hp,
		)
	}

	/*
		创建：

		80/tcp

		不能再：

		network.Port("80/tcp")

		因为 Moby v1.55 的 Port 已经不是 string。
	*/

	port, err := network.ParsePort(
		strconv.Itoa(cp) + "/" + protocol,
	)

	if err != nil {
		return fmt.Errorf(
			"invalid container port: %w",
			err,
		)
	}

	/*
		声明 ExposedPort
	*/

	config.ExposedPorts[port] = struct{}{}

	/*
		HostIP 使用 netip.Addr

		0.0.0.0 表示所有 IPv4 地址
	*/

	var ipAddr net.IP

	if hostIP == "" {
		hostIP = "0.0.0.0"
	}

	ipAddr = net.ParseIP(hostIP)

	if ipAddr == nil {
		return fmt.Errorf(
			"invalid host IP: %s",
			hostIP,
		)
	}

	/*
		net.IP -> netip.Addr
	*/

	hostAddr, ok := netIPToAddr(ipAddr)

	if !ok {
		return fmt.Errorf(
			"invalid host IP: %s",
			hostIP,
		)
	}

	hostConfig.PortBindings[port] = []network.PortBinding{
		{
			HostIP:   hostAddr,
			HostPort: strconv.Itoa(hp),
		},
	}

	return nil
}

/*
============================================================
net.IP -> netip.Addr
============================================================
*/

func netIPToAddr(ip net.IP) (addr netip.Addr, ok bool) {
	addr, err := netip.ParseAddr(ip.String())
	if err != nil {
		return netip.Addr{}, false
	}

	return addr, true
}
