#!/bin/bash
# 部署脚本：构建 webui 并复制到 server/web/dist/
set -e

WEBUI_DIR="/home/user/linux-panel/webui"
SERVER_DIST="/home/user/linux-panel/server/web/dist"

echo "=== Building webui ==="
cd "$WEBUI_DIR"
npm run build

echo "=== Deploying to server ==="
# 清空 assets 目录
rm -rf "$SERVER_DIST/assets"
mkdir -p "$SERVER_DIST/assets"

# 复制所有构建产物
cp "$WEBUI_DIR/dist/assets/"* "$SERVER_DIST/assets/"

# 更新 index.html
cp "$WEBUI_DIR/dist/index.html" "$SERVER_DIST/index.html"

echo "=== Deployed ==="
ls "$SERVER_DIST/assets/"
echo "=== index.html ==="
cat "$SERVER_DIST/index.html"
