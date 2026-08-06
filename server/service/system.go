package service

import (
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/load"
	"github.com/shirou/gopsutil/v4/mem"
	netstat "github.com/shirou/gopsutil/v4/net"
)

var (
	systemCache map[string]interface{}

	cacheLock sync.RWMutex
)

func formatDuration(sec uint64) string {

	d := sec / 86400
	h := (sec % 86400) / 3600
	m := (sec % 3600) / 60

	return fmt.Sprintf(
		"%d天 %d小时 %d分钟",
		d, h, m,
	)
}

// 网络速度
func getNetworkSpeed() map[string]interface{} {

	before, _ := netstat.IOCounters(false)

	time.Sleep(time.Second)

	after, _ := netstat.IOCounters(false)

	if len(before) == 0 || len(after) == 0 {

		return map[string]interface{}{
			"rx": 0,
			"tx": 0,
		}

	}

	return map[string]interface{}{

		"rx": after[0].BytesRecv - before[0].BytesRecv,

		"tx": after[0].BytesSent - before[0].BytesSent,
	}

}

// 采集系统数据

func collectSystem() {

	for {

		cpuPercent, _ :=
			cpu.Percent(0, false)

		cpuInfo, _ :=
			cpu.Info()

		cpuModel := ""

		if len(cpuInfo) > 0 {

			cpuModel =
				cpuInfo[0].ModelName

		}

		memInfo, _ :=
			mem.VirtualMemory()

		diskInfo, _ :=
			disk.Usage("/")

		hostInfo, _ :=
			host.Info()

		loadInfo, _ :=
			load.Avg()

		cores, _ := cpu.Counts(false)

		threads, _ := cpu.Counts(true)

		data := map[string]interface{}{

			"cpu": math.Round(cpuPercent[0]*100) / 100,

			"cpu_model": cpuModel,

			"cpu_cores": cores,

			"cpu_threads": threads,

			"memory": math.Round(memInfo.UsedPercent*100) / 100,

			"disk": math.Round(diskInfo.UsedPercent*100) / 100,

			"hostname": hostInfo.Hostname,

			"kernel": hostInfo.KernelVersion,

			"os": hostInfo.OS,

			"uptime": hostInfo.Uptime,

			"uptime_text": formatDuration(hostInfo.Uptime),

			"load1": loadInfo.Load1,

			"load5": loadInfo.Load5,

			"load15": loadInfo.Load15,

			"network": getNetworkSpeed(),
		}

		cacheLock.Lock()

		systemCache = data

		cacheLock.Unlock()

		time.Sleep(time.Second)

	}

}

// 初始化

func InitMonitor() {

	go collectSystem()

}

// API读取

func SystemStatus() map[string]interface{} {

	cacheLock.RLock()

	defer cacheLock.RUnlock()

	return systemCache

}
