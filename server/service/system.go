package service

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strings"
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

type IpInfoResult struct {
	IPv4     string `json:"ipv4"`
	IPv6     string `json:"ipv6"`
	ISP      string `json:"isp"`
	ASN      string `json:"asn"`
	IPType   string `json:"ip_type"`
	IPTypeZh string `json:"ip_type_zh"`
	Country  string `json:"country"`
	City     string `json:"city"`
}

func fetchIpInfo() IpInfoResult {
	res := IpInfoResult{
		IPv4:     "-",
		IPv6:     "-",
		ISP:      "-",
		ASN:      "-",
		IPType:   "Server/Hosting",
		IPTypeZh: "服务器机房",
		Country:  "-",
		City:     "-",
	}

	client := &http.Client{Timeout: 5 * time.Second}

	// 获取出口 IPv4
	if resp, err := client.Get("https://api.ipify.org?format=json"); err == nil {
		var data struct {
			IP string `json:"ip"`
		}
		if json.NewDecoder(resp.Body).Decode(&data) == nil && data.IP != "" {
			res.IPv4 = data.IP
		}
		resp.Body.Close()
	}

	// 获取出口 IPv6
	if resp, err := client.Get("https://api64.ipify.org?format=json"); err == nil {
		var data struct {
			IP string `json:"ip"`
		}
		if json.NewDecoder(resp.Body).Decode(&data) == nil && data.IP != "" && data.IP != res.IPv4 {
			if strings.Contains(data.IP, ":") {
				res.IPv6 = data.IP
			}
		}
		resp.Body.Close()
	}

	// 用 ipinfo.io 查 ISP/ASN/类型（无需 token）
	targetIP := res.IPv4
	if targetIP == "-" && res.IPv6 != "-" {
		targetIP = res.IPv6
	}

	if targetIP != "-" {
		urlStr := "https://ipinfo.io/" + targetIP + "/json"
		if resp, err := client.Get(urlStr); err == nil {
			var data struct {
				AsOrganization string   `json:"as_organization"`
				Orgs           []string `json:"orgs"`
				Org            string   `json:"org"`
				Asn            string   `json:"asn"`
				Public         string   `json:"public"`
				Private        string   `json:"private"`
				Country        string   `json:"country"`
				City           string   `json:"city"`
			}
			if json.NewDecoder(resp.Body).Decode(&data) == nil {
				if data.Country != "" {
					res.Country = data.Country
				}
				if data.City != "" {
					res.City = data.City
				}
				if data.AsOrganization != "" {
					res.ISP = data.AsOrganization
				} else if len(data.Orgs) > 0 {
					res.ISP = data.Orgs[0]
				} else if data.Org != "" {
					// 匿名调用时只有 org 字段，形如 "AS45102 Alibaba (US) Technology Co., Ltd."
					res.ISP = data.Org
				}
				if data.Asn != "" {
					res.ASN = data.Asn
				} else if res.ISP != "" {
					// 从 org 里解析出 AS 号作为兜底，例如 "AS45102 Alibaba..." -> "AS45102"
					if idx := strings.Index(res.ISP, "AS"); idx == 0 {
						end := idx + 2
						for end < len(res.ISP) && res.ISP[end] >= '0' && res.ISP[end] <= '9' {
							end++
						}
						res.ASN = res.ISP[:end]
						// 去掉 ASN 前缀，让 ISP 显示为运营商名
						if end < len(res.ISP) {
							ispName := strings.TrimSpace(res.ISP[end:])
							if ispName != "" {
								res.ISP = ispName
							}
						}
					}
				}
				if data.Public == "true" {
					ispLower := strings.ToLower(res.ISP)
					isHosting := strings.Contains(ispLower, "alibaba") ||
						strings.Contains(ispLower, "aliyun") ||
						strings.Contains(ispLower, "tencent") ||
						strings.Contains(ispLower, "aws") ||
						strings.Contains(ispLower, "amazon") ||
						strings.Contains(ispLower, "cloudflare") ||
						strings.Contains(ispLower, "digitalocean") ||
						strings.Contains(ispLower, "hetzner") ||
						strings.Contains(ispLower, "ovh") ||
						strings.Contains(ispLower, "data center") ||
						strings.Contains(ispLower, "datacenter") ||
						strings.Contains(ispLower, "vps") ||
						strings.Contains(ispLower, "hosting")
					if isHosting {
						res.IPType = "Server/Hosting"
						res.IPTypeZh = "服务器机房"
					} else {
						res.IPType = "Residential"
						res.IPTypeZh = "住宅宽带"
					}
				} else if data.Private == "true" {
					res.IPType = "Private"
					res.IPTypeZh = "内网"
				}
			}
			resp.Body.Close()
		}
	}

	if res.ISP == "-" {
		res.ISP = "Unknown"
	}
	if res.ASN == "-" {
		res.ASN = "Unknown"
	}

	return res
}

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
	var ipInfo IpInfoResult
	ipInfoFetched := false
	ipFetchTicker := time.NewTicker(30 * time.Minute)
	go func() {
		ipInfo = fetchIpInfo()
		ipInfoFetched = true
	}()

	for {
		if ipInfoFetched && ipInfo.IPv4 == "-" {
			ipInfo = fetchIpInfo()
		}

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

			"ip_info": ipInfo,
		}

		cacheLock.Lock()

		systemCache = data

		cacheLock.Unlock()

		select {
		case <-ipFetchTicker.C:
			ipInfo = fetchIpInfo()
		case <-time.After(time.Second):
		}

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
