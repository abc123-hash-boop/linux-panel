package api

import (
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
)

const composeBase = "/opt/panel/compose"

type ComposeUploadRequest struct {
	Name    string `json:"name"`
	Content string `json:"content"`
}

/*
====================================================
Compose Project Name

只允许：

a-z
A-Z
0-9
_
-

例如：

nginx-test
minecraft
my_server
project-01
====================================================
*/

func validComposeName(name string) bool {

	if name == "" {
		return false
	}

	matched, _ := regexp.MatchString(
		`^[a-zA-Z0-9_-]+$`,
		name,
	)

	return matched
}

/*
====================================================
Compose Project Directory
====================================================
*/

func composeDir(name string) string {

	return filepath.Join(
		composeBase,
		name,
	)

}

/*
====================================================
POST /api/docker/compose/upload

上传 Compose YAML
====================================================
*/

func DockerComposeUpload(
	c *gin.Context,
) {

	var req ComposeUploadRequest

	if err := c.ShouldBindJSON(&req); err != nil {

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

	if !validComposeName(req.Name) {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "invalid project name",
			},
		)

		return
	}

	if strings.TrimSpace(req.Content) == "" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "compose content is empty",
			},
		)

		return
	}

	/*
		项目目录：

		/opt/panel/compose/<name>
	*/

	project := composeDir(
		req.Name,
	)

	err := os.MkdirAll(
		project,
		0755,
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

	file := filepath.Join(
		project,
		"docker-compose.yml",
	)

	err = os.WriteFile(
		file,
		[]byte(req.Content),
		0644,
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
			"project": req.Name,
			"path":    file,
		},
	)

}

/*
====================================================
POST /api/docker/compose/:name/up

docker compose up -d
====================================================
*/

func DockerComposeUp(
	c *gin.Context,
) {

	name := c.Param("name")

	if !validComposeName(name) {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "invalid compose name",
			},
		)

		return
	}

	dir := composeDir(
		name,
	)

	if _, err := os.Stat(dir); err != nil {

		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "compose project not found",
			},
		)

		return
	}

	cmd := exec.Command(
		"docker",
		"compose",
		"up",
		"-d",
	)

	cmd.Dir = dir

	output, err := cmd.CombinedOutput()

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error":  err.Error(),
				"output": string(output),
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"success": true,
			"output":  string(output),
		},
	)

}

/*
====================================================
POST /api/docker/compose/:name/down

docker compose down
====================================================
*/

func DockerComposeDown(
	c *gin.Context,
) {

	name := c.Param("name")

	if !validComposeName(name) {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "invalid compose name",
			},
		)

		return
	}

	dir := composeDir(
		name,
	)

	if _, err := os.Stat(dir); err != nil {

		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "compose project not found",
			},
		)

		return
	}

	cmd := exec.Command(
		"docker",
		"compose",
		"down",
	)

	cmd.Dir = dir

	output, err := cmd.CombinedOutput()

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error":  err.Error(),
				"output": string(output),
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"success": true,
			"output":  string(output),
		},
	)

}

/*
====================================================
POST /api/docker/compose/:name/restart

docker compose restart
====================================================
*/

func DockerComposeRestart(
	c *gin.Context,
) {

	name := c.Param("name")

	if !validComposeName(name) {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "invalid compose name",
			},
		)

		return
	}

	dir := composeDir(
		name,
	)

	if _, err := os.Stat(dir); err != nil {

		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "compose project not found",
			},
		)

		return
	}

	cmd := exec.Command(
		"docker",
		"compose",
		"restart",
	)

	cmd.Dir = dir

	output, err := cmd.CombinedOutput()

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error":  err.Error(),
				"output": string(output),
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"success": true,
			"output":  string(output),
		},
	)

}

/*
====================================================
GET /api/docker/compose/:name/logs

docker compose logs --tail 200
====================================================
*/

func DockerComposeLogs(
	c *gin.Context,
) {

	name := c.Param("name")

	if !validComposeName(name) {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "invalid compose name",
			},
		)

		return
	}

	dir := composeDir(
		name,
	)

	if _, err := os.Stat(dir); err != nil {

		c.JSON(
			http.StatusNotFound,
			gin.H{
				"error": "compose project not found",
			},
		)

		return
	}

	cmd := exec.Command(
		"docker",
		"compose",
		"logs",
		"--tail",
		"200",
	)

	cmd.Dir = dir

	output, err := cmd.CombinedOutput()

	if err != nil {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error":  err.Error(),
				"output": string(output),
			},
		)

		return
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"logs": string(output),
		},
	)

}
