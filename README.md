<div align="center">

# PPanel

**Linux 服务器管理面板** · React 管理界面 · Go 后端 · 浏览器远程控制

![Go](https://img.shields.io/badge/Go-1.26%2B-00ADD8?logo=go)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite)
![Status](https://img.shields.io/badge/status-active-brightgreen)

[功能介绍](#功能概览) · [快速开始](#快速开始) · [开发指南](#本地开发) · [安全说明](#安全说明)

</div>

---

## 项目简介

PPanel 是一个面向 Linux 主机的自托管管理面板，适用于 VPS、物理服务器和家用 NAS。项目采用 Go + Gin 提供后端 API，React + Vite 构建 Web 管理界面，提供系统监控、Docker、文件、终端、服务、站点和远程浏览器等管理功能。

项目仍在积极开发中。当前已实现主要管理模块，部分功能依赖宿主机已安装的软件或外部服务；多用户权限、告警和插件系统等仍在规划中。

## 功能概览

| 模块 | 当前能力 |
|---|---|
| **Dashboard** | CPU、内存、磁盘、系统负载、运行时间及公网 IP 信息展示；采集出口 IPv4/IPv6、ISP、ASN 和地理位置等信息 |
| **Docker** | Docker 状态与信息、容器和镜像管理、容器创建及生命周期操作、卷和网络管理、Compose 项目管理、拉取日志及容器交互终端 |
| **Terminal** | 基于 WebSocket 和 PTY 的主机终端；多标签会话、窗口大小同步和容器终端 |
| **Files** | 文件浏览、上传、下载、创建、重命名、删除、文本文件查看与编辑 |
| **Process Manager** | 进程列表、CPU/内存占用、排序筛选及终止进程 |
| **Services** | systemd 服务状态查看、启动、停止和重启 |
| **Sites** | Nginx 状态与站点管理，支持静态站点、反向代理和 PHP 应用配置场景 |
| **Browser** | 远程无头 Chrome、CDP 页面控制、实时画面串流、鼠标键盘输入、多标签页和会话状态恢复；新标签页可自动跟随切换 |
| **Copilot** | LLM Provider 配置、模型获取、对话会话管理；提供终端、文件和浏览器相关工具能力 |
| **News** | 面板内信息/公告展示 |
| **Settings** | 修改登录密码及中英文界面切换 |
| **Login** | 用户名密码登录、会话 Cookie 鉴权；支持 Enter 提交 |

### Browser 模块说明

Browser 使用无头 Chrome 作为浏览器运行时，通过 Chrome DevTools Protocol（CDP）控制页面，并使用 WebRTC 传输实时画面。前端可进行地址导航、标签页切换、鼠标和键盘输入等操作。浏览器运行需要宿主机安装可执行的 Chrome/Chromium，并确保运行用户具有启动浏览器所需的权限和依赖。

### Copilot 模块说明

Copilot 支持配置兼容的模型服务 Provider，包括自定义 API Base URL、API Key 和模型选择。模型服务由用户自行提供，需根据所选服务商配置正确的接口地址和密钥；模型可用性、费用及速率限制由对应服务商决定。

## 技术栈

### 前端

- React 18、React Router
- Vite 5
- Tailwind CSS
- Axios
- xterm.js
- lucide-react
- WebSocket / WebRTC

### 后端

- Go 1.26+
- Gin
- gopsutil：系统信息与资源监控
- Moby Docker Client：Docker 管理
- gorilla/websocket：WebSocket 通信
- creack/pty：主机终端
- Pion WebRTC：浏览器画面传输
- SQLite（modernc.org/sqlite）：本地数据持久化
- MariaDB：通过本机 Unix Socket 管理数据库、专用用户与授权（需安装 MariaDB Server）

## 站点与数据库管理

Sites 页面提供 Nginx、MariaDB 与 SQLite 三个管理入口：

- **MariaDB**：查看业务数据库、关联的 `localhost` 用户、表数量与数据大小；创建数据库时同时创建专用用户，仅授予该数据库权限。密码留空时自动生成，并且只在创建成功时返回一次。
- **删除 MariaDB 数据库**：会删除数据库及其专用用户；如果该用户还拥有其他数据库的授权，Panel 会拒绝删除，避免影响其他应用。
- **SQLite**：管理本地 SQLite 文件数据库。SQLite 不使用 MariaDB 用户名或主机配置，适合轻量级本地应用。
- **PHP 站点附加数据库**：创建 PHP 站点时仍可勾选附加 MariaDB 数据库，创建流程与数据库管理页共用同一套 MariaDB 服务逻辑。

WordPress 等 PHP 应用应选择 MariaDB，并使用创建成功时显示的数据库名、用户名、密码和主机（`127.0.0.1`）。不要使用 MariaDB 管理员 root 账户连接 PHP 应用。

## 环境要求

- Linux 主机（主要面向 Ubuntu 等常见发行版）
- Go 1.26 或更新版本
- Node.js 与 npm（仅构建前端时需要）
- Docker Engine（使用 Docker 模块时需要）
- Chrome 或 Chromium（使用 Browser 模块时需要）
- Nginx（使用 Sites 模块中的 Nginx 管理功能时需要）
- MariaDB Server（使用 Sites → MariaDB 数据库管理时需要；Panel 需以具备本地 MariaDB 管理权限的账户运行）

Docker、Chrome、Nginx 属于可选运行依赖，不使用对应模块时无需全部安装。

## 快速开始

### 1. 获取项目

```bash
git clone https://github.com/abc123-hash-boop/linux-panel.git
cd linux-panel
```

### 2. 构建前端

```bash
cd webui
npm install
npm run build
cd ..
```

### 3. 部署前端静态文件

后端从运行目录下的 `server/web/dist` 提供前端页面和静态资源。构建完成后，将 Vite 产物复制到该目录：

```bash
rm -rf server/web/dist
mkdir -p server/web/dist
cp -a webui/dist/. server/web/dist/
```

### 4. 构建后端

```bash
cd server
go mod download
go build -o linux-panel .
```

### 5. 启动

请在包含 `web` 目录的 `server` 目录中启动程序，以便后端能找到前端静态文件：

```bash
./linux-panel
```

默认监听地址为 `0.0.0.0:8080`。在浏览器中访问：

```text
http://<服务器IP>:8080
```

首次初始化会创建默认管理员账户：

- 用户名：`admin`
- 密码：`123456`

**首次登录后请立即修改默认密码，并避免将管理面板直接暴露在公网。**

## 本地开发

### 前端开发

```bash
cd webui
npm install
npm run dev
```

Vite 开发服务器默认使用其配置的开发端口。开发时可通过 Vite 代理配置连接后端 API。

### 后端开发

```bash
cd server
go run .
```

后端默认监听 `:8080`。前端生产构建产物需要位于 `server/web/dist`，否则页面路由无法正常提供静态文件。

### 更新前端并部署到后端目录

在仓库根目录执行：

```bash
cd webui && npm run build
cd ..
rm -rf server/web/dist
mkdir -p server/web/dist
cp -a webui/dist/. server/web/dist/
```

## 项目结构

```text
linux-panel/
├── server/                  # Go 后端
│   ├── api/                 # REST API 处理器
│   ├── auth/                # 登录会话相关逻辑
│   ├── browser/             # Chrome、CDP、WebRTC 与浏览器会话管理
│   ├── database/            # SQLite 初始化与数据持久化
│   ├── middleware/          # API / WebSocket 鉴权
│   ├── service/             # 系统监控等服务
│   ├── websocket/           # 终端、监控、Docker 实时通道
│   ├── web/dist/            # 前端生产构建文件
│   ├── main.go              # 服务入口与路由注册
│   └── go.mod
├── webui/                   # React 前端
│   ├── src/
│   │   ├── components/      # 通用组件与布局
│   │   ├── views/           # 各功能页面
│   │   └── i18n/            # 中英文语言资源
│   ├── package.json
│   └── vite.config.js
├── README.md
└── deploy.sh                # 前端构建与静态文件部署脚本（需按环境调整路径）
```

## 安全说明

PPanel 具有对主机进行管理的能力，部署时请特别注意：

- 首次登录后立即修改默认管理员密码。
- 建议通过 Nginx、Caddy 等反向代理配置 HTTPS。
- 使用防火墙限制管理端口的来源 IP，不要将管理端口无保护地暴露到公网。
- Docker 管理、文件管理和终端功能具有较高系统权限影响范围，请仅向可信用户开放。
- API 使用登录会话进行鉴权；WebSocket 管理通道也有对应的鉴权处理。
- Copilot 配置中的 API Key 属于敏感凭据，请勿提交到 Git 仓库或公开日志。

## 开发进度

### 已实现

- [x] 登录鉴权、会话管理与密码修改
- [x] 中英文界面切换
- [x] 系统资源监控与公网 IP 信息
- [x] Docker 容器、镜像、卷、网络及 Compose 管理
- [x] 主机与容器 WebSocket 终端
- [x] 文件浏览、上传、下载和文本编辑
- [x] 进程管理与 systemd 服务管理
- [x] Nginx 站点管理功能
- [x] 无头 Chrome 远程浏览器、CDP 控制和 WebRTC 画面传输
- [x] 浏览器多标签页、自动切换及会话恢复
- [x] Copilot Provider 配置与模型对话功能
- [x] 登录表单 Enter 键提交

### 规划中

- [ ] 多用户账号与 RBAC 权限管理
- [ ] 告警与通知（邮件 / Webhook）
- [ ] 插件系统
- [ ] 自定义仪表盘

## 参与开发

欢迎提交 Issue 和 Pull Request。提交问题时，建议附上：

- Linux 发行版与版本
- Go、Node.js 版本
- 相关模块及复现步骤
- 后端日志和浏览器控制台错误（注意移除密码、Token、API Key 等敏感信息）

---

<div align="center">

**PPanel** — 让 Linux 服务器管理更直观。

</div>
