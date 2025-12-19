#!/bin/bash

# 🐺 狼人杀后端镜像构建脚本

set -e

echo "🚀 开始构建后端Docker镜像..."

# 配置变量
IMAGE_NAME="werewolf-backend"
VERSION="${1:-latest}"

# 进入后端目录
cd "$(dirname "$0")/server"

# 构建镜像
echo "📦 构建镜像 ${IMAGE_NAME}:${VERSION}..."
docker build -t ${IMAGE_NAME}:${VERSION} .

# 如果指定了ACR地址，则推送
if [ ! -z "$ACR_REGISTRY" ]; then
    echo "📤 推送到 ACR..."
    docker tag ${IMAGE_NAME}:${VERSION} ${ACR_REGISTRY}/${ACR_NAMESPACE:-werewolf-game}/backend:${VERSION}
    docker push ${ACR_REGISTRY}/${ACR_NAMESPACE:-werewolf-game}/backend:${VERSION}
    echo "✅ 推送成功！"
else
    echo "💡 提示：设置 ACR_REGISTRY 环境变量以自动推送到阿里云"
fi

echo "🎉 后端镜像构建完成！"
echo "镜像名称: ${IMAGE_NAME}:${VERSION}"
echo ""
echo "本地运行测试："
echo "  docker run -d -p 3001:3001 --name werewolf-backend ${IMAGE_NAME}:${VERSION}"
echo "  curl http://localhost:3001/health"
