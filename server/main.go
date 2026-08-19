package main

import (
	"os"

	"github.com/gin-gonic/gin"

	panelApi "panel/api"
	"panel/database"
	"panel/middleware"
	"panel/service"
	"panel/websocket"
)

func main() {

	database.Init()
	service.InitMonitor()

	r := gin.Default()

	/*
	 * ============================================================
	 * 登录接口
	 * ============================================================
	 */

	r.POST(
		"/api/login",
		panelApi.Login,
	)

	/*
	 * ============================================================
	 * API
	 * ============================================================
	 */

	protected := r.Group(
		"/api",
		middleware.Auth(),
	)

	{

		/*
		 * 登录状态
		 */

		protected.GET(
			"/hello",
			func(c *gin.Context) {

				c.JSON(
					200,
					gin.H{
						"message":   "vaild",
						"logged_in": true,
					},
				)

			},
		)

		/*
		 * ========================================================
		 * 系统
		 * ========================================================
		 */

		protected.GET(
			"/system/status",
			panelApi.SystemStatus,
		)

		/*
		 * ========================================================
		 * 用户
		 * ========================================================
		 */

		protected.POST(
			"/user/password",
			panelApi.ChangePassword,
		)

		protected.POST(
			"/logout",
			panelApi.Logout,
		)

		/*
		 * ========================================================
		 * 文件管理
		 * ========================================================
		 */

		/*
		 * 文件列表
		 *
		 * GET /api/files?path=/
		 */

		protected.GET(
			"/files",
			panelApi.FileList,
		)

		/*
		 * 文本文件读取
		 *
		 * GET /api/file/read?path=/xxx
		 */

		protected.GET(
			"/file/read",
			panelApi.FileRead,
		)

		protected.GET(
			"/file/raw",
			panelApi.FileRaw,
		)

		/*
		 * 文件写入
		 *
		 * POST /api/file/write
		 */

		protected.POST(
			"/file/write",
			panelApi.FileWrite,
		)

		protected.POST(
			"/file/mkdir",
			panelApi.FileMkdir,
		)
		
		protected.POST(
			"/file/create",
			panelApi.FileCreate,
		)
		
		protected.POST(
			"/file/rename",
			panelApi.FileRename,
		)
		
		protected.POST(
			"/file/delete",
			panelApi.FileDelete,
		)
	
	}

	/*
	 * ============================================================
	 * WebSocket
	 * ============================================================
	 */

	r.GET(
		"/ws/status",
		middleware.AuthWS(),
		websocket.Monitor,
	)

	r.GET(
		"/ws/terminal",
		middleware.AuthWS(),
		websocket.Terminal,
	)

	/*
	 * ============================================================
	 * 静态资源
	 * ============================================================
	 */

	r.Static(
		"/assets",
		"./web/dist/assets",
	)

	/*
	 * ============================================================
	 * API 404
	 *
	 * 非法 API 不能进入 SPA。
	 *
	 * 例如：
	 *
	 * GET /api/abc
	 *
	 * 返回：
	 *
	 * {
	 *     "error": "API endpoint not found"
	 * }
	 * ============================================================
	 */

	r.NoRoute(func(c *gin.Context) {

		if len(c.Request.URL.Path) >= 4 &&
			c.Request.URL.Path[:4] == "/api" {

			c.JSON(
				404,
				gin.H{
					"error": "API endpoint not found",
					"path":  c.Request.URL.Path,
				},
			)

			return
		}

		/*
		 * ========================================================
		 * SPA
		 * ========================================================
		 */

		file := "./web/dist" +
			c.Request.URL.Path

		if _, err := os.Stat(file); err == nil {

			c.File(file)

			return
		}

		c.File(
			"./web/dist/index.html",
		)

	})

	/*
	 * ============================================================
	 * 启动
	 * ============================================================
	 */

	r.Run(":8080")
}
