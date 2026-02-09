# 前端代码审查报告：狼人杀 App

> 审查维度：**易用性** | **简洁性** | **功能完备性**
>
> 最后更新：2026-02-06

---

## 一、架构总览

| 层面 | 技术选型 | 评价 |
|------|----------|------|
| 框架 | React 18 + TypeScript | 合理 |
| 状态管理 | Zustand | 轻量合理 |
| 实时通信 | Socket.IO Client | 匹配后端 |
| 样式 | Tailwind CSS + `@apply` 复合类 | 开发效率高 |
| 构建 | Vite | 快速 |
| 路由 | react-router-dom | 标准方案 |

### 当前文件结构

```
client/src/
├── App.tsx (44)              # 路由入口 + ConnectionStatus
├── main.tsx (16)             # ToastProvider 包裹
├── config.ts (18)            # API/WS 地址配置
├── index.css                 # Tailwind + glass-panel @apply 类
│
├── pages/
│   ├── LoginPage.tsx (171)       # 登录/注册
│   ├── AdminDashboard.tsx (196)  # 管理员用户 CRUD
│   ├── GodConsole.tsx (711)      # 上帝控制台（已拆分）
│   └── PlayerView.tsx (741)      # 玩家视图（含观战模式）
│
├── components/
│   ├── Toast.tsx (111)               # 自定义 Toast 通知系统
│   ├── ConnectionStatus.tsx (29)     # 全局连接状态指示器
│   ├── GlassPanel.tsx (20)           # 玻璃面板复用组件
│   ├── RoleActionPanel.tsx (552)     # 角色操作面板（策略分发）
│   ├── RoleSelector.tsx (427)        # 自定义剧本选择器
│   ├── god/
│   │   ├── RoomLobby.tsx (96)            # 创建/加入房间
│   │   ├── RoleAssignmentModal.tsx (140) # 角色分配（含防重复校验）
│   │   ├── SheriffElectionPanel.tsx (139)# 警长竞选控制
│   │   ├── ExileVotePanel.tsx (114)      # 放逐投票 + 自爆处理
│   │   ├── NightActionsPanel.tsx (206)   # 夜晚操作状态卡片
│   │   ├── GameHistoryPanel.tsx (159)    # 回合历史 + 流程记录
│   │   ├── MiniOverviewSidebar.tsx (102) # 右侧概览侧边栏
│   │   └── PlayerTableDrawer.tsx (132)   # 玩家详细状态抽屉
│   └── replay/
│       └── GameReplayViewer.tsx (374)    # 可视化复盘
│
├── hooks/
│   ├── useGameSocket.ts (41)     # 统一 WebSocket 消息处理
│   └── useReplayData.ts (254)    # 复盘数据生成
│
├── stores/
│   ├── authStore.ts (42)         # 认证状态（含 localStorage 持久化）
│   └── gameStore.ts (14)         # 游戏状态
│
├── services/
│   └── websocket.ts (148)        # Socket.IO 客户端（含自动重连）
│
└── utils/
    ├── phaseLabels.ts (116)      # 阶段/角色名翻译
    └── gameStats.ts (319)        # 游戏统计计算
```

页面路由：`LoginPage` → 按用户角色路由到 `AdminDashboard` / `GodConsole` / `PlayerView`

---

## 二、已完成修复汇总

### P0 — 阻断性问题（3项 ✅ 全部完成）

| # | 问题 | 修复方案 | 涉及文件 |
|---|------|----------|----------|
| 1 | `alert()` 阻塞游戏 | 自定义 `Toast` 组件，30+ 处替换 | `Toast.tsx`(新), 7个页面文件 |
| 2 | 角色判断用中文名 | 改用英文 ID + `getRoleName()` 显示 | `PlayerView.tsx`, `RoleActionPanel.tsx` |
| 3 | 无自动重连/状态恢复 | Socket.IO 重连 + sessionStorage roomCode | `websocket.ts` |

### P1 — 核心体验（4项 ✅ 全部完成）

| # | 问题 | 修复方案 | 涉及文件 |
|---|------|----------|----------|
| 4 | authStore 刷新丢失 | user + token 持久化到 localStorage | `authStore.ts` |
| 5 | 缺少角色操作面板 | `RoleActionPanel` 策略分发，覆盖全角色 | `RoleActionPanel.tsx`(新) |
| 6 | 夜间阶段硬编码不全 | `NIGHT_PHASES` 常量覆盖 10 个子阶段 | `RoleActionPanel.tsx` |
| 7 | 无连接状态指示 | `ConnectionStatusIndicator` 全局组件 | `ConnectionStatus.tsx`(新), `App.tsx` |

### P2 — 代码质量 + 功能补全（7项 ✅ 全部完成）

| # | 问题 | 修复方案 | 涉及文件 |
|---|------|----------|----------|
| 8 | GodConsole 1565 行 | 拆分为 6 组件 + 1 hook → 711 行 | `god/*.tsx`, `useReplayData.ts` |
| 9 | PlayerView 三元链嵌套 | 抽取 `RoleActionPanel` 组件 | `RoleActionPanel.tsx`(新) |
| 10 | WS 消息处理重复 | `useGameSocket` hook 统一通用消息 | `useGameSocket.ts`(新) |
| 11 | 缺少上帝操作按钮 | 暂停/恢复/强制结束/踢出玩家 | `GodConsole.tsx`, `types.ts` |
| 12 | 出局玩家白屏 | 观战模式面板（阶段+存活列表+角色回顾） | `PlayerView.tsx` |
| 13 | 无 loading / 可重复提交 | `isSubmitting` 状态 + 按钮 disabled | `PlayerView.tsx`, `RoleActionPanel.tsx` |
| 14 | `as any` 类型断言 | `ACTION_RESULT.data` 类型补全 | `types.ts`, `PlayerView.tsx` |

### P3 — 体验优化（4项 ✅ 全部完成）

| # | 问题 | 修复方案 | 涉及文件 |
|---|------|----------|----------|
| 15 | 角色分配可重复 | 实时计数 + disabled 已满选项 | `RoleAssignmentModal.tsx` |
| 16 | Tailwind 类名重复 | `@apply .glass-panel` + `<GlassPanel>` | `index.css`, `GlassPanel.tsx`(新) |
| 17 | 投票无确认 | `confirm()` 弹窗 + `formatVoteTarget()` | `PlayerView.tsx` |
| 18 | 号位选择靠猜 | 12 按钮 grid 替代文本输入 | `PlayerView.tsx` |

---

## 三、待处理问题

以下是当前版本仍存在的问题，按优先级排序供后续 review 继续处理。

### 【高】遗留功能缺口

#### 1. 上帝代操作功能（后端配合）

GodConsole 已有暂停/恢复/强制结束/踢出按钮，但**上帝代替掉线玩家提交夜间行动**的功能尚未实现。需要后端增加 `GOD_FORCE_ACTION` 的处理逻辑，前端需要在 NightActionsPanel 中为每个未提交操作的角色添加"代操作"按钮。

**影响：** 掉线玩家会阻塞当前夜间阶段，上帝无法推进游戏。

#### 2. 无倒计时/超时机制

夜间阶段和投票阶段都没有倒计时。每个阶段可以无限等待，如果有人挂机/掉线，游戏卡死。

**建议：**
- 后端实现阶段超时自动推进
- 前端显示倒计时条/计时器
- 超时未操作自动视为"跳过"

#### 3. 无音效/振动反馈

夜间轮到自己操作时，如果不盯着屏幕就会错过。需要 `PHASE_CHANGED` 时检测是否轮到自己，触发提示音或 `navigator.vibrate()`。

**建议：** 创建 `useNotification` hook，在轮到玩家操作时通过 Web Audio API 播放提示音。

### 【中】代码质量

#### 4. `GlassPanel` 类定义了但未应用到现有组件

`index.css` 中定义了 `.glass-panel` / `.glass-panel-sm` / `.glass-panel-lg` 三个 `@apply` 类，也创建了 `<GlassPanel>` 组件，但现有的 15+ 处 `bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20` 尚未批量替换。

**建议：** 全项目搜索 `bg-white/10 backdrop-blur-md` 并替换为 `glass-panel` 类或 `<GlassPanel>` 组件。可分批进行：先替换 `GodConsole.tsx` 和 `PlayerView.tsx`，再处理子组件。

#### 5. `RoleActionPanel.tsx` 仍有 552 行

虽然已从 PlayerView 中提取，但组件本身仍较大。每个角色的操作面板可进一步拆分为独立文件。

**建议：**
```
components/roles/
├── WolfPanel.tsx
├── WitchPanel.tsx
├── SeerPanel.tsx
├── GuardPanel.tsx
├── GargoylePanel.tsx
├── GravekeeperPanel.tsx
├── WolfBeautyPanel.tsx
├── NightmarePanel.tsx
├── DreamerPanel.tsx
└── VillagerNightPanel.tsx
```
`RoleActionPanel` 只做 dispatch 路由。

#### 6. GodConsole.tsx 中存在未使用变量

`token` 和 `customScript` 在 GodConsole 中被解构/声明但未使用：
- `const { user, token, clearAuth } = useAuthStore()` — `token` 未使用
- `const [customScript, setCustomScript] = useState<ScriptV2 | null>(null)` — 只有 set，从未被读取

#### 7. `groupHistoryByRounds()` 在 GodConsole 中重复定义

GodConsole 和 GameHistoryPanel 中可能存在相同的 `groupHistoryByRounds` 函数。应确认是否已统一到 GameHistoryPanel 内部。

### 【低】UX 改进

#### 8. LoginPage 明文展示默认密码

[LoginPage.tsx](client/src/pages/LoginPage.tsx)：
```tsx
<p>默认管理员账号：admin / admin123</p>
<p>默认上帝账号：god / god</p>
```

开发方便，但生产环境应通过环境变量控制是否显示。

**建议：** `{import.meta.env.DEV && <p>...</p>}` 条件渲染。

#### 9. GameReplayViewer 导出图片在移动端可能 OOM

[GameReplayViewer.tsx](client/src/components/replay/GameReplayViewer.tsx)：`html2canvas` 的 `scale: 2` 在大屏 + 多回合游戏时可能生成巨大的 canvas。

**建议：** 移动端降低 scale 到 1，或改用服务端渲染导出。

#### 10. AdminDashboard 功能单一

目前只有用户 CRUD，缺少：
- 房间列表管理
- 游戏历史查看
- 系统配置（如修改密码）

#### 11. 投票确认使用原生 `confirm()` 弹窗

当前投票确认使用浏览器原生 `confirm()`，与 Toast 通知的自定义 UI 风格不统一。

**建议：** 创建自定义 `ConfirmModal` 组件替代 `confirm()`。同样适用于 GodConsole 中的"强制结束"、"踢出玩家"等确认操作。

---

## 四、整体优先级排序

| 优先级 | 改动 | 收益 | 状态 |
|--------|------|------|------|
| P0 | 替换 `alert()` 为 Toast 组件 | 不阻塞游戏，体验质变 | ✅ 已修复 |
| P0 | 修复角色名判断（中文 vs ID） | 角色操作面板能正常显示 | ✅ 已修复 |
| P0 | 实现自动重连 + 状态恢复 | 刷新/切后台不丢失游戏 | ✅ 已修复 |
| P1 | 持久化 authStore 的 user 对象 | 刷新不需要重新登录 | ✅ 已修复 |
| P1 | 补全各角色专属操作面板 | 玩家知道该干什么 | ✅ 已修复 |
| P1 | 补全夜间阶段常量列表 | 平民不会看到假操作面板 | ✅ 已修复 |
| P1 | 添加连接状态指示 | 玩家知道是否在线 | ✅ 已修复 |
| P2 | 拆分 GodConsole 大组件 | 代码可维护性 | ✅ 已修复 |
| P2 | 抽取 PlayerView 角色面板 | 代码可维护性 | ✅ 已修复 |
| P2 | 统一 WebSocket 消息处理层 | 消除重复，修复闭包 bug | ✅ 已修复 |
| P2 | 添加缺失的上帝操作按钮 | 上帝可以处理异常情况 | ✅ 已修复（部分） |
| P2 | 出局玩家观战模式 | 出局不再白屏 | ✅ 已修复 |
| P2 | 操作提交防重复 + loading | 防止误操作 | ✅ 已修复 |
| P2 | 修复 ServerMessage 类型断言 | 类型安全 | ✅ 已修复 |
| P3 | 角色分配防重复校验 | 减少上帝误操作 | ✅ 已修复 |
| P3 | 抽取 Tailwind 复用类 | 减少 JSX 噪音 | ✅ 已修复 |
| P3 | 投票操作加确认步骤 | 减少误操作 | ✅ 已修复 |
| P3 | 加入房间座位选择 | 提高选位体验 | ✅ 已修复 |
| **后续** | **上帝代操作功能** | **掉线不阻塞游戏** | **待处理（需后端）** |
| **后续** | **阶段倒计时/超时** | **防止游戏卡死** | **待处理（需后端）** |
| **后续** | **音效/振动反馈** | **提高轮次感知** | **待处理** |
| **后续** | **批量应用 GlassPanel** | **减少 JSX 噪音** | **待处理** |
| **后续** | **RoleActionPanel 二次拆分** | **代码可维护性** | **待处理** |
| **后续** | **自定义 ConfirmModal** | **UI 风格统一** | **待处理** |
| **后续** | **LoginPage 密码条件渲染** | **生产安全** | **待处理** |
| **后续** | **清理未使用变量** | **代码整洁** | **待处理** |

---

## 五、值得肯定的设计

- **Zustand** 选型精准 — 相比 Redux 省去了大量 boilerplate，适合这种中等复杂度的应用
- **工具函数分离** — `phaseLabels.ts` 和 `gameStats.ts` 把翻译和统计逻辑从 UI 中抽离，复用性好
- **上帝控制台布局** — 左右分栏（操作区 70% + 概览区 30%）在运行中切换布局，思路正确
- **复盘系统完整** — 从数据生成、可视化浏览到 PNG/JSON 导出的全链路都有了
- **自定义剧本选择器** — `RoleSelector` 的人数预设 + 自动填充平民 + 实时校验是很好的 UX 设计
- **安全意识** — PlayerView 中有注释明确标注"禁止显示 outReason"以防信息泄露
- **组件化程度高** — GodConsole 拆分后形成了清晰的 `god/` 子组件目录，每个组件 100-200 行
- **自定义 Hook 复用** — `useGameSocket` 消除了两个页面的消息处理重复，`useReplayData` 封装了复杂的数据转换逻辑
- **类型安全改善** — `ServerMessage.ACTION_RESULT` 的 `data` 字段已有完整类型定义，消除了 `as any`

---

## 六、本次修复新增/修改文件清单

### 新建文件（12个）

| 文件 | 用途 |
|------|------|
| `components/Toast.tsx` | Toast 通知系统 |
| `components/ConnectionStatus.tsx` | 连接状态指示器 |
| `components/GlassPanel.tsx` | 玻璃面板复用组件 |
| `components/RoleActionPanel.tsx` | 角色操作面板（策略分发） |
| `components/god/RoomLobby.tsx` | GodConsole 创建/加入房间 |
| `components/god/RoleAssignmentModal.tsx` | GodConsole 角色分配弹窗 |
| `components/god/SheriffElectionPanel.tsx` | GodConsole 警长竞选控制 |
| `components/god/ExileVotePanel.tsx` | GodConsole 放逐投票控制 |
| `components/god/NightActionsPanel.tsx` | GodConsole 夜晚操作状态 |
| `components/god/GameHistoryPanel.tsx` | GodConsole 回合/流程历史 |
| `hooks/useGameSocket.ts` | 统一 WebSocket 消息处理 |
| `hooks/useReplayData.ts` | 复盘数据生成 |

### 修改文件（10个）

| 文件 | 主要改动 |
|------|----------|
| `main.tsx` | 添加 `<ToastProvider>` |
| `App.tsx` | 添加 `<ConnectionStatusIndicator>` |
| `index.css` | 添加 `.glass-panel` @apply 类 |
| `pages/PlayerView.tsx` | alert→toast, 角色名修复, 观战模式, loading 状态, 座位选择, 投票确认 |
| `pages/GodConsole.tsx` | alert→toast, 拆分子组件, useGameSocket, 上帝操作按钮 |
| `pages/LoginPage.tsx` | alert→toast |
| `pages/AdminDashboard.tsx` | alert→toast |
| `stores/authStore.ts` | 添加 user 持久化 |
| `services/websocket.ts` | 自动重连 + 状态恢复 + onStatusChange |
| `shared/src/types.ts` | ACTION_RESULT.data 类型 + 4个 GOD_ 消息类型 |
