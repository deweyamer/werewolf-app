# GitHub Actions自动部署指南 🤖

## 什么是GitHub Actions？

GitHub Actions是GitHub提供的**免费CI/CD服务**，可以在你推送代码后自动：
- ✅ 构建项目
- ✅ 运行测试
- ✅ 自动部署到Railway/Vercel
- ✅ 发送通知

**完全免费！每月2000分钟运行时间！**

---

## 为什么要用GitHub Actions？

### 没有GitHub Actions
```
你写代码 → 推送到GitHub → 手动去Railway部署 → 手动去Vercel部署
```
**每次都要手动操作，很麻烦！**

### 有了GitHub Actions
```
你写代码 → 推送到GitHub → 🤖自动部署完成！
```
**完全自动化，解放双手！**

---

## 部署架构图

```
┌─────────────────────────────────────────────────────┐
│                    你的电脑                          │
│  git push origin main                               │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│                   GitHub                            │
│  - 代码托管                                          │
│  - GitHub Actions自动触发                            │
└────────────┬────────────────────────────────────────┘
             │
      ┌──────┴──────┐
      ▼             ▼
┌──────────┐  ┌──────────┐
│ Railway  │  │ Vercel   │
│ (后端)   │  │ (前端)   │
│ 运行中✅  │  │ 运行中✅  │
└──────────┘  └──────────┘
      │             │
      └──────┬──────┘
             ▼
        🎮 游戏上线！
```

---

## 设置步骤

### 第一步：获取部署Token

#### 1. Railway Token

1. 访问: https://railway.app/
2. 登录后点击右上角头像
3. Account Settings → Tokens
4. 点击 "Create Token"
5. 输入名称: `github-actions`
6. 复制Token（只显示一次！）

#### 2. Vercel Token

1. 访问: https://vercel.com/
2. 登录后点击右上角头像
3. Settings → Tokens
4. 点击 "Create"
5. Token Name: `github-actions`
6. Scope: Full Account
7. Expiration: No Expiration
8. 复制Token

#### 3. Vercel Project ID和Org ID

在Vercel项目页面：
```bash
# 安装Vercel CLI
npm i -g vercel

# 登录
vercel login

# 在项目目录中
cd client
vercel link

# 会显示:
# ✅  Linked to your-name/werewolf-game
# 并生成 .vercel/project.json
```

打开 `.vercel/project.json`:
```json
{
  "projectId": "prj_xxxxxxxxxxxxx",  ← 复制这个
  "orgId": "team_xxxxxxxxxxxxx"      ← 复制这个
}
```

---

### 第二步：在GitHub添加Secrets

1. 打开你的GitHub仓库
2. Settings → Secrets and variables → Actions
3. 点击 "New repository secret"
4. 添加以下secrets：

| Name | Value | 说明 |
|------|-------|------|
| `RAILWAY_TOKEN` | 你的Railway Token | Railway部署令牌 |
| `VERCEL_TOKEN` | 你的Vercel Token | Vercel部署令牌 |
| `VERCEL_ORG_ID` | team_xxxxx | Vercel组织ID |
| `VERCEL_PROJECT_ID` | prj_xxxxx | Vercel项目ID |
| `VITE_API_URL` | https://your-backend.railway.app | 后端API地址 |
| `BACKEND_URL` | https://your-backend.railway.app | 用于健康检查 |

---

### 第三步：推送代码触发部署

```bash
# 1. 提交你的代码
git add .
git commit -m "feat: 添加GitHub Actions自动部署"

# 2. 推送到main分支
git push origin main

# 3. 🤖 GitHub Actions自动开始工作！
```

---

## 查看部署状态

### 在GitHub查看

1. 打开你的仓库
2. 点击 "Actions" 标签
3. 看到正在运行的workflow：

```
🟡 Deploy Werewolf Game (运行中)
   ├── ✅ build-and-test (完成)
   ├── 🟡 deploy-backend (运行中)
   └── ⏳ deploy-frontend (等待中)
```

4. 点击进入查看详细日志

### 部署成功

```
✅ Deploy Werewolf Game (3m 24s)
   ├── ✅ build-and-test (1m 12s)
   ├── ✅ deploy-backend (1m 30s)
   ├── ✅ deploy-frontend (0m 42s)
   └── ✅ notify (0m 05s)

🎉 部署成功！
前端: https://your-app.vercel.app
后端: https://your-backend.railway.app
```

---

## Workflow文件说明

文件位置: `.github/workflows/deploy.yml`

### Workflow触发条件

```yaml
on:
  push:
    branches: [ main ]  # 推送到main分支时触发
  pull_request:
    branches: [ main ]  # PR到main分支时触发（只构建不部署）
```

### Job执行顺序

```
build-and-test (构建和测试)
    ↓
    ├─→ deploy-backend (部署后端)
    └─→ deploy-frontend (部署前端)
        ↓
    notify (发送通知)
```

### 关键步骤解析

#### 1. 构建和测试
```yaml
build-and-test:
  runs-on: ubuntu-latest  # 使用Ubuntu系统
  steps:
    - uses: actions/checkout@v3        # 检出代码
    - uses: actions/setup-node@v3      # 安装Node.js
    - run: npm ci                       # 安装依赖
    - run: npm run build                # 构建
```

#### 2. 部署后端
```yaml
deploy-backend:
  needs: build-and-test  # 等待构建完成
  if: github.ref == 'refs/heads/main'  # 只在main分支部署
```

#### 3. 部署前端
```yaml
deploy-frontend:
  uses: amondnet/vercel-action@v20  # 使用Vercel Action
```

---

## 自定义配置

### 只在特定条件下部署

```yaml
# 只在包含特定标签的commit时部署
on:
  push:
    branches: [ main ]
    tags:
      - 'v*'  # 只在打tag时部署

# 或者只在特定文件改变时触发
on:
  push:
    paths:
      - 'server/**'
      - 'client/**'
```

### 添加测试步骤

```yaml
- name: 运行测试
  working-directory: ./server
  run: npm test

- name: 代码质量检查
  run: npm run lint
```

### 添加通知到Slack/Discord

```yaml
- name: 发送Slack通知
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 最简单的替代方案（不用GitHub Actions）

如果你觉得GitHub Actions太复杂，可以用**更简单的方式**：

### Railway自动部署

Railway可以直接连接GitHub自动部署：

1. Railway项目 → Settings
2. 启用 "Auto Deploy from GitHub"
3. 每次推送自动部署！

### Vercel自动部署

Vercel默认就自动部署：

1. 连接GitHub仓库时
2. 自动启用 Git Integration
3. 每次推送自动部署！

**这样就不需要GitHub Actions了！**

---

## 三种方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|-----|------|------|--------|
| **Railway + Vercel自动部署** | 最简单，0配置 | 功能有限 | ⭐⭐⭐⭐⭐ |
| **GitHub Actions** | 完全可控，可自定义 | 需要配置Token | ⭐⭐⭐⭐ |
| **手动部署** | 不需要设置 | 每次都要手动操作 | ⭐⭐ |

---

## 推荐方案 🎯

### 方案A：最简单（推荐新手）

1. Railway → 连接GitHub → 启用自动部署
2. Vercel → 连接GitHub → 自动部署
3. **完成！不需要GitHub Actions！**

### 方案B：进阶（推荐有经验的）

1. 使用GitHub Actions
2. 添加自动测试
3. 添加代码检查
4. 添加部署通知
5. **完整的CI/CD流程！**

---

## 常见问题 ❓

### Q1: GitHub Actions用完免费额度怎么办？

**A**: 每月2000分钟，基本用不完！一次部署只需3-5分钟，可以部署400-600次！

### Q2: Railway和Vercel不支持自动部署怎么办？

**A**: Railway和Vercel都默认支持！连接GitHub后自动启用。

### Q3: 每次推送都会部署吗？

**A**:
- Railway/Vercel自动部署：是的
- GitHub Actions：可以配置条件，比如只在打tag时部署

### Q4: 可以部署到其他平台吗？

**A**: 可以！只需要修改workflow文件，支持：
- AWS
- Google Cloud
- Azure
- Heroku
- 自己的服务器

---

## 下一步 🚀

### 如果选择简单方案（推荐）

1. 按照 [DEPLOY_STEPS.md](./DEPLOY_STEPS.md) 部署
2. Railway和Vercel会自动部署
3. **完成！**

### 如果选择GitHub Actions

1. 按照本文档配置Secrets
2. 推送代码到GitHub
3. 查看Actions运行状态
4. **完成！**

---

**现在你有完整的自动化部署方案了！** 🎉

推荐先用**Railway + Vercel自动部署**（最简单），等熟悉了再添加GitHub Actions做更复杂的CI/CD流程。
