package api

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

type WriteRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

func FileWrite(c *gin.Context) {

	var req WriteRequest

	if err := c.ShouldBindJSON(&req); err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "invalid request",
			},
		)

		return
	}

	if req.Path == "" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "path empty",
			},
		)

		return
	}

	/*
	 * ========================================================
	 * 检查文件
	 * ========================================================
	 */

	info, err := os.Stat(req.Path)

	if err == nil && info.IsDir() {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "cannot write directory",
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
		filepath.Ext(req.Path),
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
	 * 限制写入大小
	 * ========================================================
	 */

	if len(req.Content) > 2*1024*1024 {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "file too large",
			},
		)

		return
	}

	/*
	 * ========================================================
	 * 写文件
	 * ========================================================
	 */

	err = os.WriteFile(
		req.Path,
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
			"message": "saved",
		},
	)
}
