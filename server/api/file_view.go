package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

func FileRead(c *gin.Context) {

	path := c.Query("path")

	if path == "" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "path empty",
			},
		)

		return
	}

	info, err := os.Stat(path)

	if err != nil || info.IsDir() {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "not file",
			},
		)

		return
	}

	/*
	 * ========================================================
	 * 只允许文本文件
	 * ========================================================
	 */

	ext := strings.ToLower(
		filepath.Ext(path),
	)

	switch ext {

	case ".js",
		".jsx",
		".json",
		".txt",
		".log":

		// 允许

	default:

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "unsupported text file type",
			},
		)

		return
	}

	/*
	 * ========================================================
	 * 限制文件大小
	 * ========================================================
	 */

	if info.Size() > 2*1024*1024 {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "file too large",
			},
		)

		return
	}

	data, err := os.ReadFile(path)

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
			"path":    path,
			"content": string(data),
		},
	)
}
