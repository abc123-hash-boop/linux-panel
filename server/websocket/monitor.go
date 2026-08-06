package websocket

import (
	"net/http"
	"time"

	"panel/service"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{

	CheckOrigin: func(r *http.Request) bool {

		return true

	},
}

func Monitor(c *gin.Context) {

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

		data := service.SystemStatus()

		err := conn.WriteJSON(data)

		if err != nil {

			break

		}

		time.Sleep(time.Second)

	}

}
