package api

import (
	"net/http"

	"os"

	"path/filepath"

	"github.com/gin-gonic/gin"
)

func FileList(c *gin.Context) {

	path := c.Query("path")

	if path == "" {

		path = "/"

	}

	info, err := os.Stat(path)

	if err != nil || !info.IsDir() {

		c.JSON(

			http.StatusBadRequest,

			gin.H{

				"error": "path error",
			},
		)

		return

	}

	files, err := os.ReadDir(path)

	if err != nil {

		c.JSON(

			500,

			gin.H{

				"error": err.Error(),
			},
		)

		return

	}

	result := []gin.H{}

	for _, file := range files {

		full := filepath.Join(

			path,

			file.Name(),
		)

		stat, err := os.Stat(full)

		if err != nil {

			continue

		}

		isDir :=

			file.IsDir()

		// 处理Linux软链接

		if file.Type()&os.ModeSymlink != 0 {

			target, err := filepath.EvalSymlinks(full)

			if err == nil {

				targetInfo, err := os.Stat(target)

				if err == nil && targetInfo.IsDir() {

					isDir = true

				}

			}

		}

		result = append(

			result,

			gin.H{

				"name": file.Name(),

				"dir": isDir,

				"size": stat.Size(),

				"mode": stat.Mode().String(),
			},
		)

	}

	c.JSON(

		200,

		gin.H{

			"path": path,

			"files": result,
		},
	)

}
