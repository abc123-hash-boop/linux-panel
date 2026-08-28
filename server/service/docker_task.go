package service

import "sync"

type DockerLayer struct {
	ID string `json:"id"`

	Status string `json:"status"`

	Current int64 `json:"current"`

	Total int64 `json:"total"`

	Progress int `json:"progress"`
}

type DockerPullTask struct {
	ID string `json:"id"`

	Image string `json:"image"`

	Status string `json:"status"`

	Progress int `json:"progress"`

	Current int64 `json:"current"`

	Total int64 `json:"total"`

	Layer string `json:"layer"`

	Layers map[string]*DockerLayer `json:"layers"`

	Logs []string `json:"logs"`
}

var DockerPullTasks = make(
	map[string]*DockerPullTask,
)

var DockerPullMutex sync.RWMutex

func AddDockerPullTask(
	task *DockerPullTask,
) {

	DockerPullMutex.Lock()

	defer DockerPullMutex.Unlock()

	DockerPullTasks[task.ID] = task

}

func GetDockerPullTask(
	id string,
) *DockerPullTask {

	DockerPullMutex.RLock()

	defer DockerPullMutex.RUnlock()

	return DockerPullTasks[id]

}
