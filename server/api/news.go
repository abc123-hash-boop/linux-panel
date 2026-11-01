package api

import (
	"encoding/json"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

type NewsArticle struct {
	Title      string `json:"title"`
	Subtitle   string `json:"subtitle"`
	URL        string `json:"url"`
	Importance int    `json:"importance"`
}

type NewsData struct {
	Version   int           `json:"version"`
	UpdatedAt string        `json:"updatedAt"`
	Articles  []NewsArticle `json:"articles"`
}

func News(c *gin.Context) {
	data, err := os.ReadFile("news.json")
	if err != nil {
		// fallback to server dir
		data, err = os.ReadFile("../news.json")
		if err != nil {
			c.JSON(
				http.StatusOK,
				NewsData{
					Version:   1,
					UpdatedAt: "",
					Articles:  []NewsArticle{},
				},
			)
			return
		}
	}

	var news NewsData
	if err := json.Unmarshal(data, &news); err != nil {
		c.JSON(
			http.StatusOK,
			NewsData{
				Version:   1,
				UpdatedAt: "",
				Articles:  []NewsArticle{},
			},
		)
		return
	}

	c.JSON(
		http.StatusOK,
		news,
	)
}
