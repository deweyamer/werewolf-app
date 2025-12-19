#!/bin/bash

# 🐺 狼人杀完整构建和推送脚本
# 用于阿里云函数计算部署

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🐺 狼人杀游戏 - 完整构建脚本${NC}"
echo ""

# 检查必需的环境变量
if [ -z "$ACR_REGISTRY" ]; then
    echo -e "${RED}❌ 错误: 请设置 ACR_REGISTRY 环境变量${NC}"
    echo "例如: export ACR_REGISTRY=registry.cn-hangzhou.aliyuncs.com"
    exit 1
fi

if [ -z "$VITE_API_URL" ]; then
    echo -e "${YELLOW}⚠️  警告: 未设置 VITE_API_URL，使用默认值${NC}"
    export VITE_API_URL="http://localhost:3001"
fi

# 配置
ACR_NAMESPACE="${ACR_NAMESPACE:-werewolf-game}"
VERSION="${1:-latest}"

echo "📋 配置信息："
echo "  ACR仓库: ${ACR_REGISTRY}"
echo "  命名空间: ${ACR_NAMESPACE}"
echo "  版本标签: ${VERSION}"
echo "  后端API: ${VITE_API_URL}"
echo ""

# 询问是否继续
read -p "是否继续构建并推送? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 0
fi

# 登录ACR
echo -e "${GREEN}🔐 登录到阿里云容器镜像服务...${NC}"
docker login ${ACR_REGISTRY}

# 构建后端
echo ""
echo -e "${GREEN}📦 构建后端镜像...${NC}"
./build-backend.sh ${VERSION}

# 构建前端
echo ""
echo -e "${GREEN}📦 构建前端镜像...${NC}"
./build-frontend.sh ${VERSION}

# 完成
echo ""
echo -e "${GREEN}🎉 全部构建完成！${NC}"
echo ""
echo "镜像信息："
echo "  后端: ${ACR_REGISTRY}/${ACR_NAMESPACE}/backend:${VERSION}"
echo "  前端: ${ACR_REGISTRY}/${ACR_NAMESPACE}/frontend:${VERSION}"
echo ""
echo "下一步："
echo "  1. 登录阿里云函数计算控制台"
echo "  2. 更新函数镜像地址"
echo "  3. 重新部署函数"
echo ""
echo "或者运行以下命令使用Funcraft自动部署："
echo "  fun deploy -y"
