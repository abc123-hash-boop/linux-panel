package api

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
)

/*
 * ============================================================
 * 文件管理 API
 *
 * POST /api/file/mkdir
 * POST /api/file/create
 * POST /api/file/rename
 * POST /api/file/delete
 * ============================================================
 */

/*
 * ============================================================
 * 请求结构
 * ============================================================
 */

type FileMkdirRequest struct {
	Path string `json:"path" binding:"required"`
}

type FileCreateRequest struct {
	Path string `json:"path" binding:"required"`
}

type FileRenameRequest struct {
	Path    string `json:"path" binding:"required"`
	NewPath string `json:"newPath" binding:"required"`
}

type FileDeleteRequest struct {
	Path string `json:"path" binding:"required"`
}

/*
 * ============================================================
 * 路径检查
 *
 * 当前服务器是 Linux 文件管理器，因此使用 filepath.Clean。
 *
 * 注意：
 * 这里不限制用户只能访问某一个目录。
 * 当前行为与已有 /api/files、/api/file/read、
 * /api/file/raw 保持一致。
 * ============================================================
 */

func cleanFilePath(path string) (string, error) {

	path = strings.TrimSpace(path)

	if path == "" {
		return "", errors.New("path empty")
	}

	path = filepath.Clean(path)

	if path == "." {
		path = "/"
	}

	return path, nil
}

/*
 * ============================================================
 * POST /api/file/mkdir
 *
 * 创建目录
 *
 * 请求：
 *
 * {
 *     "path": "/home/user/test"
 * }
 * ============================================================
 */

func FileMkdir(c *gin.Context) {

	var req FileMkdirRequest

	if err := c.ShouldBindJSON(&req); err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "invalid request",
			},
		)

		return
	}

	path, err := cleanFilePath(req.Path)

	if err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	/*
	 * 不允许创建根目录
	 */

	if path == "/" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "cannot create root directory",
			},
		)

		return
	}

	/*
	 * 检查目标是否已经存在
	 */

	_, err = os.Lstat(path)

	if err == nil {

		c.JSON(
			http.StatusConflict,
			gin.H{
				"error": "file or directory already exists",
			},
		)

		return
	}

	if !os.IsNotExist(err) {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	/*
	 * 检查父目录
	 */

	parent := filepath.Dir(path)

	info, err := os.Stat(parent)

	if err != nil {

		if os.IsNotExist(err) {

			c.JSON(
				http.StatusNotFound,
				gin.H{
					"error": "parent directory not found",
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

	if !info.IsDir() {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "parent path is not a directory",
			},
		)

		return
	}

	/*
	 * 创建目录
	 *
	 * 0755：
	 *
	 * rwxr-xr-x
	 */

	if err := os.Mkdir(path, 0755); err != nil {

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
			"message": "directory created",
			"path":    path,
		},
	)
}

/*
 * ============================================================
 * POST /api/file/create
 *
 * 创建空文件
 *
 * 请求：
 *
 * {
 *     "path": "/home/user/test.txt"
 * }
 * ============================================================
 */

func FileCreate(c *gin.Context) {

	var req FileCreateRequest

	if err := c.ShouldBindJSON(&req); err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "invalid request",
			},
		)

		return
	}

	path, err := cleanFilePath(req.Path)

	if err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	if path == "/" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "invalid file path",
			},
		)

		return
	}

	/*
	 * 文件已经存在时不覆盖
	 */

	_, err = os.Lstat(path)

	if err == nil {

		c.JSON(
			http.StatusConflict,
			gin.H{
				"error": "file or directory already exists",
			},
		)

		return
	}

	if !os.IsNotExist(err) {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	/*
	 * 检查父目录
	 */

	parent := filepath.Dir(path)

	info, err := os.Stat(parent)

	if err != nil {

		if os.IsNotExist(err) {

			c.JSON(
				http.StatusNotFound,
				gin.H{
					"error": "parent directory not found",
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

	if !info.IsDir() {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "parent path is not a directory",
			},
		)

		return
	}

	/*
	 * 创建文件
	 *
	 * 0644：
	 *
	 * rw-r--r--
	 */

	file, err := os.OpenFile(
		path,
		os.O_WRONLY|os.O_CREATE|os.O_EXCL,
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

	file.Close()

	c.JSON(
		http.StatusOK,
		gin.H{
			"message": "file created",
			"path":    path,
		},
	)
}

/*
 * ============================================================
 * POST /api/file/rename
 *
 * 重命名 / 移动
 *
 * 请求：
 *
 * {
 *     "path": "/home/user/old.txt",
 *     "newPath": "/home/user/new.txt"
 * }
 *
 * 同一个接口同时支持：
 *
 * /old.txt -> /new.txt
 *
 * 以及：
 *
 * /home/a.txt -> /tmp/a.txt
 *
 * 因此实际上也是一个简单的 move API。
 * ============================================================
 */

func FileRename(c *gin.Context) {

	var req FileRenameRequest

	if err := c.ShouldBindJSON(&req); err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "invalid request",
			},
		)

		return
	}

	oldPath, err := cleanFilePath(req.Path)

	if err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	newPath, err := cleanFilePath(req.NewPath)

	if err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	if oldPath == "/" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "cannot rename root directory",
			},
		)

		return
	}

	if newPath == "/" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "cannot rename to root directory",
			},
		)

		return
	}

	/*
	 * 路径完全相同时不需要操作
	 */

	if oldPath == newPath {

		c.JSON(
			http.StatusOK,
			gin.H{
				"message": "nothing changed",
				"path":    newPath,
			},
		)

		return
	}

	/*
	 * 检查源文件
	 */

	info, err := os.Lstat(oldPath)

	if err != nil {

		if os.IsNotExist(err) {

			c.JSON(
				http.StatusNotFound,
				gin.H{
					"error": "source file not found",
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
	 * 防止把目录移动到自己的子目录
	 *
	 * 例如：
	 *
	 * /home/test
	 *
	 * -> /home/test/a
	 */

	if info.IsDir() {

		relative, err := filepath.Rel(
			oldPath,
			newPath,
		)

		if err == nil {

			if relative == ".." ||
				!strings.HasPrefix(
					relative,
					".."+string(os.PathSeparator),
				) {

				c.JSON(
					http.StatusBadRequest,
					gin.H{
						"error": "cannot move directory into itself",
					},
				)

				return
			}
		}
	}

	/*
	 * 不允许覆盖已有文件
	 */

	_, err = os.Lstat(newPath)

	if err == nil {

		c.JSON(
			http.StatusConflict,
			gin.H{
				"error": "destination already exists",
			},
		)

		return
	}

	if !os.IsNotExist(err) {

		c.JSON(
			http.StatusInternalServerError,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	/*
	 * 检查目标父目录
	 */

	parent := filepath.Dir(newPath)

	parentInfo, err := os.Stat(parent)

	if err != nil {

		if os.IsNotExist(err) {

			c.JSON(
				http.StatusNotFound,
				gin.H{
					"error": "destination directory not found",
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

	if !parentInfo.IsDir() {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "destination parent is not a directory",
			},
		)

		return
	}

	/*
	 * 执行重命名 / 移动
	 */

	if err := os.Rename(
		oldPath,
		newPath,
	); err != nil {

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
			"message": "renamed",
			"path":    oldPath,
			"newPath": newPath,
		},
	)
}

/*
 * ============================================================
 * POST /api/file/delete
 *
 * 删除文件 / 空目录 / 非空目录
 *
 * 请求：
 *
 * {
 *     "path": "/home/user/test.txt"
 * }
 *
 * 使用 os.RemoveAll：
 *
 * 文件       -> 删除
 * 空目录     -> 删除
 * 非空目录   -> 递归删除
 * ============================================================
 */

func FileDelete(c *gin.Context) {

	var req FileDeleteRequest

	if err := c.ShouldBindJSON(&req); err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "invalid request",
			},
		)

		return
	}

	path, err := cleanFilePath(req.Path)

	if err != nil {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": err.Error(),
			},
		)

		return
	}

	/*
	 * 严禁删除根目录
	 */

	if path == "/" {

		c.JSON(
			http.StatusBadRequest,
			gin.H{
				"error": "cannot delete root directory",
			},
		)

		return
	}

	/*
	 * 检查文件是否存在
	 */

	_, err = os.Lstat(path)

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
	 * 删除
	 *
	 * RemoveAll 会递归删除目录。
	 */

	if err := os.RemoveAll(path); err != nil {

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
			"message": "deleted",
			"path":    path,
		},
	)
}
