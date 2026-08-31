package service

import (
	"os/exec"
	"strings"
)

type ServiceInfo struct {
	Name    string `json:"name"`
	Status  string `json:"status"`
	Enabled string `json:"enabled"`
}


func ListServices() ([]ServiceInfo, error) {

	cmd := exec.Command(
		"systemctl",
		"list-units",
		"--type=service",
		"--all",
		"--no-pager",
		"--no-legend",
		"--plain",
	)

	out, err := cmd.Output()

	if err != nil {
		return nil, err
	}


	lines := strings.Split(
		string(out),
		"\n",
	)


	var result []ServiceInfo


	for _, line := range lines {

		fields := strings.Fields(line)


		// 空行
		if len(fields) < 5 {
			continue
		}


		name := fields[0]


		// 排除 systemd 的异常标记
		if name == "●" {
			continue
		}


		// 只保留 service
		if !strings.HasSuffix(name, ".service") {
			continue
		}


		// systemd格式:
		// NAME LOAD ACTIVE SUB DESCRIPTION
		status := fields[3]


		enabledCmd := exec.Command(
			"systemctl",
			"is-enabled",
			name,
		)


		enabledOut, err := enabledCmd.Output()


		enabled := "unknown"

		if err == nil {
			enabled = strings.TrimSpace(
				string(enabledOut),
			)
		}


		result = append(
			result,
			ServiceInfo{
				Name: name,
				Status: status,
				Enabled: enabled,
			},
		)
	}


	return result,nil
}



func Action(name string, action string) error {

	cmd := exec.Command(
		"systemctl",
		action,
		name,
	)

	return cmd.Run()
}
