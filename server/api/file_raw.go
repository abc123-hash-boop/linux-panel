package api

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

func FileRaw(c *gin.Context) {

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

	/*
	 * ============================================================
	 * 获取文件信息
	 * ============================================================
	 */

	info, err := os.Stat(path)

	if err != nil {

		if os.IsNotExist(err) {
			c.JSON(
				http.StatusNotFound,
				gin.H{
					"error": "file not found",
				},
			)

			return
		}

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	if info.IsDir() {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "cannot read directory",
			},
		)

		return
	}

	/*
	 * ============================================================
	 * 文件名
	 * ============================================================
	 */

	filename := filepath.Base(path)

	/*
	 * ============================================================
	 * 判断下载 / 在线预览
	 * ============================================================
	 */

	download :=
		c.Query("download") == "1" ||
			strings.EqualFold(
				c.Query("download"),
				"true",
			)

	if download {

		c.Header(
			"Content-Disposition",
			fmt.Sprintf(
				`attachment; filename="%s"`,
				filename,
			),
		)

	} else {

		c.Header(
			"Content-Disposition",
			fmt.Sprintf(
				`inline; filename="%s"`,
				filename,
			),
		)
	}

	/*
	 * ============================================================
	 * 让 Gin / net/http 处理文件
	 *
	 * c.File 不会把整个文件读进内存。
	 * 对以后下载大文件更加合适。
	 * ============================================================
	 */

	c.File(path)
}
