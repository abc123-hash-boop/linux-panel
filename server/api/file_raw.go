package api

import (
	"fmt"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

/*
 * ============================================================
 * GET /api/file/raw
 *
 * 文件查看 / 下载
 *
 * 在线预览：
 *
 * /api/file/raw?path=/home/user/test.txt
 *
 *
 * 下载：
 *
 * /api/file/raw?path=/home/user/test.zip&download=1
 *
 * ============================================================
 */

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

	/*
	 * 不允许读取目录
	 */

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

	encodedName :=
		url.QueryEscape(filename)

	/*
	 * ============================================================
	 * 判断下载模式
	 * ============================================================
	 */

	download :=

		c.Query("download") == "1" ||

			strings.EqualFold(
				c.Query("download"),
				"true",
			)

	if download {

		/*
		 * 下载
		 */

		c.Header(
			"Content-Disposition",
			fmt.Sprintf(
				`attachment; filename="%s"; filename*=UTF-8''%s`,
				filename,
				encodedName,
			),
		)

	} else {

		/*
		 * 浏览器预览
		 */

		c.Header(
			"Content-Disposition",
			fmt.Sprintf(
				`inline; filename="%s"; filename*=UTF-8''%s`,
				filename,
				encodedName,
			),
		)

	}

	/*
	 * ============================================================
	 * MIME 类型
	 * ============================================================
	 */

	contentType :=

		mime.TypeByExtension(
			filepath.Ext(filename),
		)

	if contentType != "" {

		c.Header(
			"Content-Type",
			contentType,
		)

	} else {

		c.Header(
			"Content-Type",
			"application/octet-stream",
		)

	}

	/*
	 * ============================================================
	 * 文件大小
	 *
	 * 方便浏览器显示进度
	 * ============================================================
	 */

	c.Header(
		"Content-Length",
		fmt.Sprintf(
			"%d",
			info.Size(),
		),
	)

	/*
	 * ============================================================
	 * 输出文件
	 *
	 * Gin 会使用 io.Copy
	 *
	 * 不会一次性加载整个文件到内存
	 *
	 * 支持大文件
	 *
	 * ============================================================
	 */

	c.File(path)

}
