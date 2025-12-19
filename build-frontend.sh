#!/bin/bash

# 🐺 狼人杀前端镜像构建脚本

set -e

echo "🚀 开始构建前端Docker镜像..."

# 配置变量
IMAGE_NAME="werewolf-frontend"
VERSION="${1:-latest}"
BACKEND_URL="${VITE_API_URL:-http://localhost:3001}"

# 进入前端目录
cd "$(dirname "$0")/client"

# 构建镜像
echo "📦 构建镜像 ${IMAGE_NAME}:${VERSION}..."
echo "🔗 后端API地址: ${BACKEND_URL}"
docker build \
    --build-arg VITE_API_URL=${BACKEND_URL} \
    -t ${IMAGE_NAME}:${VERSION} .

# 如果指定了ACR地址，则推送
if [ ! -z "$ACR_REGISTRY" ]; then
    echo "📤 推送到 ACR..."
    docker tag ${IMAGE_NAME}:${VERSION} ${ACR_REGISTRY}/${ACR_NAMESPACE:-werewolf-game}/frontend:${VERSION}
    docker push ${ACR_REGISTRY}/${ACR_NAMESPACE:-werewolf-game}/frontend:${VERSION}
    echo "✅ 推送成功！"
else
    echo "💡 提示：设置 ACR_REGISTRY 环境变量以自动推送到阿里云"
fi

echo "🎉 前端镜像构建完成！"
echo "镜像名称: ${IMAGE_NAME}:${VERSION}"
echo ""
echo "本地运行测试："
echo "  docker run -d -p 8080:80 --name werewolf-frontend ${IMAGE_NAME}:${VERSION}"
echo "  打开浏览器: http://localhost:8080"
