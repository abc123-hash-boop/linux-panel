package api

import (
	"net/http"
	"os"
	"path/filepath"

	"github.com/gin-gonic/gin"
)

func DockerComposeList(
	c *gin.Context,
) {

	base := "/opt/panel/compose"

	entries, err := os.ReadDir(base)

	if err != nil {

		if os.IsNotExist(err) {

			c.JSON(
				http.StatusOK,
				[]interface{}{},
			)

			return

		}

		c.JSON(
			500,
			gin.H{
				"error": err.Error(),
			},
		)

		return

	}

	result := make(
		[]gin.H,
		0,
	)

	for _, entry := range entries {

		if !entry.IsDir() {

			continue

		}

		project := entry.Name()

		composeFile := filepath.Join(
			base,
			project,
			"docker-compose.yml",
		)

		_, err := os.Stat(
			composeFile,
		)

		if err != nil {

			continue

		}

		result = append(
			result,
			gin.H{

				"name": project,

				"path": composeFile,
			},
		)

	}

	c.JSON(
		http.StatusOK,
		result,
	)

}
