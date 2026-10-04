package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	panelApi "panel/api"
	"panel/browser"
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

		protected.GET(
			"/services",
			panelApi.Services,
		)
		protected.POST(
			"/service/:name/:action",
			panelApi.ServiceAction,
		)
		protected.GET(
			"/processes",
			panelApi.Processes,
		)
		protected.POST(
			"/process/:pid",
			panelApi.KillProcess,
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
			"/file/upload",
			panelApi.FileUpload,
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
		protected.GET(
			"/docker/info",
			panelApi.DockerInfo,
		)
		protected.GET(
			"/docker/check",
			panelApi.DockerCheck,
		)
		protected.GET(
			"/docker/containers",
			panelApi.DockerContainerList,
		)
		protected.POST(
			"/docker/container/start/:id",
			panelApi.DockerContainerStart,
		)
		protected.POST(
			"/docker/container/stop/:id",
			panelApi.DockerContainerStop,
		)
		protected.POST(
			"/docker/container/restart/:id",
			panelApi.DockerContainerRestart,
		)
		protected.DELETE(
			"/docker/container/:id",
			panelApi.DockerContainerRemove,
		)
		protected.POST(
			"/docker/container/create",
			panelApi.DockerContainerCreate,
		)
		protected.POST(
			"/docker/compose/upload",
			panelApi.DockerComposeUpload,
		)
		protected.POST(
			"/docker/compose/:name/up",
			panelApi.DockerComposeUp,
		)
		protected.POST(
			"/docker/compose/:name/down",
			panelApi.DockerComposeDown,
		)
		protected.GET(
			"/docker/compose/list",
			panelApi.DockerComposeList,
		)
		protected.POST(
			"/docker/compose/:name/restart",
			panelApi.DockerComposeRestart,
		)
		protected.GET(
			"/docker/compose/:name/logs",
			panelApi.DockerComposeLogs,
		)
		protected.GET(
			"/docker/images",
			panelApi.DockerImageList,
		)
		protected.POST(
			"/docker/image/pull",
			panelApi.DockerImagePull,
		)
		protected.GET(
			"/docker/image/pull/status/:id",
			panelApi.DockerImagePullStatus,
		)
		protected.DELETE(
			"/docker/image/:id",
			panelApi.DockerImageRemove,
		)
		protected.POST(
			"/docker/container/exec",
			panelApi.DockerContainerExec,
		)
		protected.GET(
			"/docker/volumes",
			panelApi.DockerVolumeList,
		)
		protected.POST(
			"/docker/volume",
			panelApi.DockerVolumeCreate,
		)
		protected.DELETE(
			"/docker/volume/:name",
			panelApi.DockerVolumeRemove,
		)
		protected.GET(
			"/docker/networks",
			panelApi.DockerNetworkList,
		)

		protected.GET(
			"/docker/network/:id",
			panelApi.DockerNetworkInspect,
		)

		protected.POST(
			"/docker/network",
			panelApi.DockerNetworkCreate,
		)

		protected.DELETE(
			"/docker/network/:id",
			panelApi.DockerNetworkRemove,
		)

		protected.POST(
			"/docker/network/:id/connect",
			panelApi.DockerNetworkConnect,
		)

		protected.POST(
			"/docker/network/:id/disconnect",
			panelApi.DockerNetworkDisconnect,
		)

		/*
		 * ========================================================
		 * Copilot
		 * ========================================================
		 */

		protected.GET(
			"/copilot/history",
			panelApi.CopilotGetHistory,
		)
		protected.POST(
			"/copilot/history",
			panelApi.CopilotSaveHistory,
		)
		protected.GET(
			"/copilot/recent/:id",
			panelApi.CopilotGetRecentMessages,
		)
		protected.POST(
			"/copilot/chat",
			panelApi.CopilotChat,
		)
		protected.GET(
			"/copilot/sessions",
			panelApi.CopilotListSessions,
		)
		protected.POST(
			"/copilot/sessions",
			panelApi.CopilotCreateSession,
		)
		protected.PUT(
			"/copilot/session/:id",
			panelApi.CopilotUpdateSession,
		)
		protected.DELETE(
			"/copilot/session/:id",
			panelApi.CopilotDeleteSession,
		)
		protected.GET(
			"/copilot/providers",
			panelApi.CopilotListProviders,
		)
		protected.POST(
			"/copilot/providers",
			panelApi.CopilotCreateProvider,
		)
		protected.PUT(
			"/copilot/provider/:id",
			panelApi.CopilotUpdateProvider,
		)
		protected.DELETE(
			"/copilot/provider/:id",
			panelApi.CopilotDeleteProvider,
		)
		protected.POST(
			"/copilot/fetch-models",
			panelApi.CopilotFetchModels,
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
	r.GET(
		"/ws/docker/pull/:id",
		middleware.AuthWS(),
		websocket.DockerPull,
	)

	r.GET(
		"/ws/docker/exec/:id",
		middleware.AuthWS(),
		websocket.DockerExecTerminal,
	)
	/*
	 * ============================================================
	 * Browser Runtime API（Session 管理 + CDP + 视频流）
	 * ============================================================
	 */

	browser.RegisterRoutes(r, browser.DefaultManager)

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

	// 清理上次运行残留的 Chrome 进程与 profile
	browser.DefaultManager.CleanupOldSessions()

	srv := &http.Server{
		Addr:    ":8080",
		Handler: r,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %v", err)
		}
	}()

	// 等待退出信号，关闭所有 Browser Session，避免 Chrome 僵尸进程
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down, closing browser sessions...")
	browser.DefaultManager.Shutdown()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("server shutdown: %v", err)
	}
	log.Println("shutdown complete")
}
