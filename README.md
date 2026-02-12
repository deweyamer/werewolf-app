# 🐺 狼人杀 线下面杀版

基于 React + TypeScript + Socket.IO 的实时多人狼人杀游戏，专为线下面杀场景设计。上帝通过控制台推进游戏流程，玩家在手机/平板上接收角色信息和执行操作。

## 📚 文档导航

### 开发与使用
- 🚀 **[5分钟快速开始](./docs/development/QUICK_START.md)** - 本地运行游戏
- 📖 **[完整使用指南](./docs/development/USER_GUIDE.md)** - 详细的游戏说明
- 🔥 **[热重载开发指南](./docs/development/HOT_RELOAD.md)** - 开发环境配置

### 部署文档
- 🐳 **[Docker本地部署](./docs/deployment/DOCKER_DEPLOYMENT.md)** - 推荐！一键Docker部署
- ☁️ **[阿里云函数计算](./docs/deployment/ALIYUN_FC_DEPLOYMENT.md)** - 阿里云Serverless部署
- ⚡ **[快速云端部署](./docs/deployment/DEPLOY_STEPS.md)** - Vercel + Railway 部署
- 📋 **[完整部署指南](./docs/deployment/DEPLOYMENT_GUIDE.md)** - 详细的部署方案对比
- 🤖 **[GitHub Actions](./docs/deployment/GITHUB_ACTIONS_GUIDE.md)** - CI/CD自动化流程

## 功能特性

### 核心功能
- 实时 WebSocket 通信，多端同步
- 三种用户角色：管理员（用户/剧本管理）、上帝（游戏主持）、玩家
- 上帝控制台：创建房间、角色分配、流程推进、EventFeed 实时事件流
- 玩家视图：加入房间、查看角色、执行夜间操作
- 警长竞选系统（首日白天）
- 游戏历史记录与回放
- 自动胜负判定
- Bot 托管（掉线玩家自动决策）

### 支持角色

| 角色 | 阵营 | 技能 |
|-----|------|------|
| 普通狼人 | 狼人 | 夜间刀人 |
| 噩梦之影 | 狼人 | 首晚恐惧一名玩家使其无法行动 |
| 狼美人 | 狼人 | 魅惑一名玩家，狼美人死亡时目标连结死亡 |
| 石像鬼 | 狼人 | 独狼，每晚查验一名玩家的具体角色 |
| 预言家 | 好人 | 每晚查验一名玩家的阵营 |
| 女巫 | 好人 | 解药救人 + 毒药杀人（各一瓶） |
| 猎人 | 好人 | 死亡时开枪带走一名玩家 |
| 守卫 | 好人 | 每晚守护一人（不可连续守护同一人） |
| 摄梦人 | 好人 | 每晚梦游一人，连续两晚同一人则目标梦死 |
| 骑士 | 好人 | 白天决斗，对方是狼人则狼人死，否则自己死 |
| 守墓人 | 好人 | 自动获得上轮被投票出局者的阵营信息 |
| 平民 | 好人 | 依靠推理和投票 |

### 预设剧本

| 剧本 | 人数 | 狼人配置 | 好人配置 | 难度 |
|------|------|---------|---------|------|
| 12人标准剧本 | 12 | 4普通狼人 | 预言家+女巫+猎人+守卫+4民 | 中等 |
| 9人标准剧本 | 9 | 狼美人+2普通狼人 | 预言家+女巫+猎人+3民 | 中等 |
| 摄梦人剧本 | 12 | 噩梦之影+3普通狼人 | 摄梦人+预言家+女巫+猎人+4民 | 中等 |
| 骑士狼美人剧本 | 12 | 狼美人+3普通狼人 | 骑士+预言家+女巫+守卫+4民 | 高 |
| 守墓人石像鬼剧本 | 12 | 石像鬼+3普通狼人 | 守墓人+预言家+女巫+猎人+4民 | 高 |

## 技术栈

- **前端**: React 18 + TypeScript + Vite 5 + Tailwind CSS 3 + Zustand 4 + Socket.IO Client
- **后端**: Node.js + Express 4 + Socket.IO 4 + TypeScript
- **数据存储**: JSON 文件（无数据库依赖）
- **测试**: Vitest + React Testing Library（前端）、Vitest + E2E 测试框架（后端）

## 项目结构

```
werewolf-app/
├── client/          # React 前端
│   └── src/
│       ├── pages/        # LoginPage, AdminDashboard, GodConsole, PlayerView
│       ├── components/   # RoleActionPanel, god/, replay/, player/
│       ├── hooks/        # useGameSocket, useReplayData
│       ├── stores/       # Zustand: authStore, gameStore
│       ├── services/     # WebSocket 服务
│       └── utils/        # phaseLabels, eventFeedUtils, gameStats
├── server/          # Node.js 后端
│   └── src/
│       ├── game/
│       │   ├── flow/     # GameFlowEngine（阶段推进、胜负判定）
│       │   ├── roles/    # IRoleHandler 实现（各角色处理器）
│       │   ├── script/   # ScriptPresets, ScriptValidator
│       │   └── skill/    # SkillResolver（技能优先级结算）
│       ├── services/     # Auth, Game, Script, Bot, Replay
│       └── websocket/    # SocketManager（消息路由）
├── shared/          # 前后端共享
│   └── src/
│       ├── types.ts      # TypeScript 类型定义
│       └── constants.ts  # 角色、阶段、出局原因等常量
└── docs/            # 文档
```

## 🚀 快速开始

### 方式1：Docker部署（推荐）

```bash
cd werewolf-app
docker-compose up -d
# 浏览器打开 http://localhost:3000
```

详见 [Docker部署文档](./docs/deployment/DOCKER_DEPLOYMENT.md)

### 方式2：本地开发

**前提**：Node.js 18+

```bash
# 安装依赖
npm install
npm install --workspaces

# 启动开发环境（前后端同时启动）
npm run dev
```

- 前端: http://localhost:3000
- 后端API: http://localhost:3001/api
- WebSocket: ws://localhost:3001

### 默认账号

系统首次启动自动创建：

| 角色 | 用户名 | 密码 | 数量 |
|-----|--------|------|------|
| 管理员 | `admin` | `admin123` | 1 |
| 上帝 | `god` | `god` | 1 |
| 测试玩家 | `test1` ~ `test12` | `test` | 12 |

玩家也可以在登录页自行注册。

## 使用流程

1. **上帝创建房间** — 登录 `god/god`，选择剧本，创建房间，记下 6 位房间码
2. **玩家加入** — 各玩家登录后输入房间码加入
3. **分配角色** — 上帝点击"分配角色" → "随机分配" → "确认分配"
4. **开始游戏** — 上帝点击"开始游戏"，按阶段推进流程

### 游戏流程

**夜间阶段**（按技能优先级执行）：
1. 恐惧阶段 — 噩梦之影恐惧目标（首晚）
2. 守护阶段 — 守卫/摄梦人选择守护目标
3. 狼人阶段 — 狼人投票刀人
4. 女巫阶段 — 女巫使用解药/毒药
5. 预言家阶段 — 预言家查验身份
6. 夜间结算 — 公布死亡信息

**白天阶段**：
1. 警长竞选（仅第一天白天）
2. 讨论 → 投票放逐
3. 猎人/骑士技能触发
4. 白天结算 → 进入下一轮

**胜利条件**：
- 狼人胜利：存活狼人 ≥ 存活好人
- 好人胜利：所有狼人出局

## 注意事项

1. 首夜女巫不使用解药，被刀者会死亡
2. 摄梦人守护的玩家被刀，摄梦人替死
3. 警长死亡时可以传递或撕毁警徽
4. 猎人被毒死不能开枪
5. 守卫不能连续两晚守护同一人

## License

MIT
