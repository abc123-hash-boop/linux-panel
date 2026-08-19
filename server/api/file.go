package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

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
			http.StatusInternalServerError,
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

		isDir := file.IsDir()

		// Linux 软链接处理
		if file.Type()&os.ModeSymlink != 0 {

			target, err := filepath.EvalSymlinks(full)

			if err == nil {

				targetInfo, err := os.Stat(target)

				if err == nil && targetInfo.IsDir() {
					isDir = true
				}
			}
		}

		/*
		 * 文件类型
		 */

		fileType := "file"

		if isDir {
			fileType = "directory"
		} else {

			ext := strings.ToLower(
				filepath.Ext(file.Name()),
			)

			switch ext {

			case ".js":
				fileType = "javascript"

			case ".jsx":
				fileType = "javascript-react"

			case ".json":
				fileType = "json"

			case ".txt":
				fileType = "text"

			case ".log":
				fileType = "log"

			case ".img":
				fileType = "img"

			case ".iso":
				fileType = "iso"

			case ".png",
				".jpg",
				".jpeg",
				".jepg",
				".ico":

				fileType = "image"

			default:
				fileType = "file"
			}
		}

		result = append(
			result,
			gin.H{
				"name": file.Name(),

				"dir": isDir,

				"size": stat.Size(),

				"mode": stat.Mode().String(),

				"type": fileType,
			},
		)
	}

	c.JSON(
		http.StatusOK,
		gin.H{
			"path":  path,
			"files": result,
		},
	)
}
