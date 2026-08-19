#!/bin/bash
set -e
set -o pipefail
set -u


echo '#################################'
echo '#   Linux Panel 前端 - 构建     #'
echo '#   请确认已安装Nodejs最新版    #'
echo '#################################'
echo 'Builder 1.0 Starting...'
echo '系统版本:'
uname -r
echo 'Nodejs版本:'
node -v
echo '[作业 1/2] 调用Nodejs编译'
npm run build
echo '[作业1 - 完成] 构建完毕且无报错'
echo '[作业 2/2] 复制成品'
cp -r dist ../server/web/
echo '[系统] 所有作业完成，现在退出'
