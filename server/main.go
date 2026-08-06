package main

import (
	"github.com/gin-gonic/gin"
	"os"
	"panel/database"

	panelApi "panel/api"
	"panel/middleware"
	"panel/service"
	"panel/websocket"
)

func main() {
	database.Init()
	service.InitMonitor()

	r := gin.Default()

	// 登录接口（公开）
	r.POST(
		"/api/login",
		panelApi.Login,
	)

	// 公开API
	public := r.Group("/api")
	{

		public.GET("/hello", func(c *gin.Context) {

			c.JSON(200, gin.H{

				"message": "vaild",
			})

		})

	}

	// 需要登录认证

	protected := r.Group(
		"/api",
		middleware.Auth(),
	)

	{

		// 系统监控

		protected.GET(
			"/system/status",
			panelApi.SystemStatus,
		)
		protected.POST(
			"/user/password",
			panelApi.ChangePassword,
		)
		protected.POST(
			"/logout",
			panelApi.Logout,
		)
		protected.GET(
			"/files",
			panelApi.FileList,
		)
		protected.GET(
			"/file/read",
			panelApi.FileRead,
		)
		protected.POST(
			"/file/write",
			panelApi.FileWrite,
		)
	}

	// WebSocket

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
	// 静态资源

	r.Static(
		"/assets",
		"./web/dist/assets",
	)

	// Vue路由

	r.NoRoute(func(c *gin.Context) {

		file :=
			"./web/dist" +
				c.Request.URL.Path

		if _, err := os.Stat(file); err == nil {

			c.File(file)

			return

		}

		c.File(
			"./web/dist/index.html",
		)

	})

	r.Run(":8080")

}
