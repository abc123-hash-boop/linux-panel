<div align="center">

# PPanel

**下一代 Linux 服务器管理面板** · 玻璃拟态 UI · 开箱即用

![License](https://img.shields.io/badge/license-Private?color=blue)
![Go](https://img.shields.io/badge/Go-1.27?logo=go&color=00ADD8)
![React](https://img.shields.io/badge/React-18?logo=react&color=61DAFB)
![Status](https://img.shields.io/badge/status-active?color=green)

</div>

---

## ✨ 简介

PPanel 是一款自托管的 Linux 服务器管理面板，为 VPS / 物理机 / NAS 提供一站式运维能力。
前后端一体化构建，单二进制部署，零外部依赖，适合个人服务器、家用 NAS 与轻量云主机。

| 特性 | 说明 |
|---|---|
| 🎨 玻璃拟态 UI | 基于 React 18 + Tailwind，深色玻璃质感，视觉高端 |
| 🌐 中英双语 | 全站 i18n，一键切换，默认跟随浏览器偏好 |
| 🚀 单文件部署 | Go 编译产物 `linux-panel` 一个二进制，内含 Web 前端 |
| 🔒 安全 | 登录鉴权 + 会话 Cookie，API 全部受保护 |
| 📡 实时 | WebSocket 监控 / 终端 / Docker 拉取日志 / 容器 exec |

---

## 🧩 功能总览

### 1. 系统概览（Dashboard）

- CPU / 内存 / 磁盘 / 负载 / 运行时长实时卡片
- **网络与 IP 信息**：出口 IPv4 / IPv6、ISP、ASN、IP 类型（住宅/机房）、国家、城市
- 基于 `ipinfo.io` 自动识别，每 30 分钟刷新一次，无 IPv6 时优雅显示 `ipv6: -`

### 2. Docker 管理

- 镜像 / 容器 / 卷 / 网络全图形化
- 容器生命周期：start / stop / restart / remove / exec
- Compose 项目：上传 / up / down / restart / logs
- 实时拉取日志（WebSocket）+ 容器内终端

### 3. 终端（Terminal）

- 多标签 xterm.js，主机 PTY / 容器内终端
- WebSocket 传输，优雅断开，关闭标签不残留
- 支持重连、`exit` 安全处理、真实标题（onTitleChange）

### 4. 文件管理（Files）

- 高仿 Windows 资源管理器：浏览 / 上传 / 下载 / 重命名 / 删除 / 新建
- 文本文件在线编辑，大文件分片处理

### 5. 任务管理器（Process Manager）

- 实时进程列表：PID / 名称 / CPU% / 内存%
- 搜索过滤 + 列排序（CPU / 内存）
- 一键终止进程，5 秒自动刷新

### 6. 系统服务（Services）

- Systemd 服务管理：状态 / 启停 / 重启
- 与任务管理器联动，运维闭环

### 7. 浏览器（Browser）

- 远程无头 Chrome 自动化 + WebRTC 实时视频流
- CDP 控制、页面访问、脚本执行、历史恢复

### 8. Copilot（AI 助手）

- 内置 LLM 对话，多 Provider 配置
- 会话管理、历史持久化、模型自选

### 9. 设置（Settings）

- 修改密码、语言切换
- 所有偏好本地持久化（localStorage + 后端 DB）

---

## 🏗 技术栈

```
前端                    后端
├─ React 18             ├─ Go 1.27
├─ Vite 构建             ├─ Gin 路由
├─ Tailwind CSS          ├─ gopsutil 系统采集
├─ lucide-react 图标     ├─ Docker SDK 容器管理
├─ xterm.js 终端         ├─ Chrome DevTools Protocol
└─ WebSocket 实时通道    └─ SQLite 持久化
```

- **前端**：React 18 + Vite，模块化分页面打包（Dashboard / Docker / Files / Terminal / ProcessManager / Services / Browser / Copilot / Settings / Login）
- **后端**：Go + Gin，gopsutil 采集 CPU/内存/磁盘/负载/网络，Docker SDK 管理容器，CDP 驱动无头 Chrome
- **部署**：`go build` 单一二进制，内嵌前端 `web/dist`，`./linux-panel` 即起

---

## 🚀 快速开始

### 1. 构建

```bash
# 前端（一次性，构建产物进入 webui/dist）
cd webui && npm install && npm run build

# 后端（将前端打包进二进制）
cd server && go build -o bin/linux-panel .
```

> 开发时可将 `webui/dist` 同步到 `server/web/dist`，前端改动即生效。

### 2. 运行

```bash
./bin/linux-panel
# 监听 :8080
```

### 3. 访问

- 打开 `http://<主机IP>:8080`
- 默认管理员：`admin / 123456`（首次启动自动创建）
- **务必立即修改默认密码**

---

## 📁 目录结构

```
linux-panel/
├─ server/                  # Go 后端
│  ├─ api/                  # REST API handlers
│  ├─ browser/              # 无头 Chrome / CDP / WebRTC
│  ├─ database/             # SQLite 持久化
│  ├─ middleware/           # 鉴权中间件
│  ├─ service/              # 系统监控 / IP 采集
│  ├─ websocket/            # 终端 / 监控 / Docker 日志
│  ├─ web/dist/             # 前端构建产物（内嵌）
│  └─ main.go
├─ webui/                   # React 前端源码
│  └─ src/
│     ├─ views/             # 各功能页（Dashboard/Docker/Files/Terminal/...）
│     ├─ components/        # 布局 / 侧边栏 / 通用组件
│     └─ i18n/              # 中英文词条 + I18nProvider
└─ README.md
```

---

## 🔐 安全提示

- 默认凭据 `admin / 123456` 仅用于首次初始化，生产环境请立即修改
- 建议配合反向代理（Nginx / Caddy）+ HTTPS + 防火墙限制访问 IP
- 面板 API 默认全部需要登录态，未鉴权请求返回 401

---

## 📝 开发进展

- [x] 登录鉴权 + 玻璃拟态深色 UI
- [x] 系统概览（含出口 IP / ISP / ASN / IP 类型 / 国家 / 城市）
- [x] Docker 全量管理 + Compose + 实时日志 / exec
- [x] 多标签终端（主机 / 容器）+ 优雅断开 / 重连
- [x] 文件管理（增删改查 / 上传 / 下载 / 在线编辑）
- [x] 任务管理器（进程 + Systemd 服务 + 硬件检测）
- [x] 远程浏览器（CDP + WebRTC 视频流）
- [x] Copilot AI 助手（多 Provider）
- [x] 全站中英文 i18n
- [ ] 用户多账号 / RBAC 权限
- [ ] 告警 / 通知（邮件 / Webhook）
- [ ] 插件 / 自定义仪表盘

---

<div align="center">

**PPanel** — 让运维更优雅。

⭐ Star 这个项目，支持持续开发。

</div>
