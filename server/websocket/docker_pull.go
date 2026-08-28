package websocket

import (
	"encoding/json"
	"time"

	"panel/service"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func DockerPull(c *gin.Context) {

	id := c.Param("id")

	conn, err := upgrader.Upgrade(
		c.Writer,
		c.Request,
		nil,
	)

	if err != nil {
		return
	}

	defer conn.Close()

	for {

		task := service.GetDockerPullTask(id)

		if task == nil {

			conn.WriteJSON(
				gin.H{
					"error": "task not found",
				},
			)

			break
		}

		data, err := json.Marshal(task)

		if err != nil {
			break
		}

		err = conn.WriteMessage(
			websocket.TextMessage,
			data,
		)

		if err != nil {
			break
		}

		if task.Status == "done" ||
			task.Status == "failed" {

			break
		}

		time.Sleep(
			time.Second,
		)

	}

}
