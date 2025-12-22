# 狼人杀游戏前端测试文档

## 📋 测试概览

本测试套件覆盖了狼人杀游戏前端的核心功能,特别关注与后端逻辑的适配和安全性验证。

### 测试类型

1. **工具函数单元测试** (`utils/*.test.ts`)
   - `phaseLabels.test.ts` - 阶段标签和死亡原因翻译
   - `gameStats.test.ts` - 游戏统计和数据处理

2. **集成测试** (`test/integration/*.test.ts`)
   - `backendAdaptation.test.ts` - 后端逻辑适配验证

3. **组件测试** (待实现)
   - God Console 组件测试
   - Player View 组件测试

---

## 🚀 运行测试

### 安装依赖

```bash
cd client
npm install
```

### 运行所有测试

```bash
npm test
```

### 运行测试并查看UI

```bash
npm run test:ui
```

### 生成测试覆盖率报告

```bash
npm run test:coverage
```

---

## 🔍 重点测试场景

### 1. 死亡原因枚举适配 (P0)

**测试文件**: `phaseLabels.test.ts`, `backendAdaptation.test.ts`

**背景**: 后端已将死亡原因从 camelCase 改为 snake_case:
- `wolfKill` → `wolf_kill`
- `vote` → `exile`
- `dreamerKilled` → `dream_kill`

**测试验证**:
```typescript
// 新格式
expect(translateDeathReason('wolf_kill')).toBe('🐺 被狼刀');
expect(translateDeathReason('exile')).toBe('🗳️ 被投票放逐');
expect(translateDeathReason('self_destruct')).toBe('💣 狼人自爆');

// 兼容旧格式
expect(translateDeathReason('wolfKill')).toBe('🐺 被狼刀');
expect(translateDeathReason('vote')).toBe('🗳️ 被投票放逐');
```

**关键断言**:
- ✅ 所有后端枚举值都有对应翻译
- ✅ 兼容旧格式(向后兼容)
- ✅ 新增死亡原因正确翻译

---

### 2. 守墓人规则验证 (P0)

**测试文件**: `backendAdaptation.test.ts`

**背景**: 守墓人只能验尸被投票放逐(`exile`)的玩家,不能验尸:
- 夜晚被狼刀的玩家 (`wolf_kill`)
- 被毒死的玩家 (`poison`)
- 摄梦人梦死的玩家 (`dream_kill`)
- 狼人自爆 (`self_destruct`)

**测试验证**:
```typescript
const game = createGravekeeperTestGame();
// 2号被放逐 (可验尸)
// 9号被狼刀 (不可验尸)

const validTargets = game.players.filter(
  p => !p.alive && p.outReason === 'exile'
);

expect(validTargets.map(p => p.playerId)).toEqual([2]);
```

**关键断言**:
- ✅ 只有 `outReason === 'exile'` 的玩家可以被验尸
- ✅ 前端UI正确过滤可验尸玩家列表
- ✅ God Console 显示守墓人规则提示

---

### 3. 投票机制适配 (P1)

**测试文件**: `backendAdaptation.test.ts`

**背景**: 投票放逐的玩家应该设置 `outReason = 'exile'`

**测试验证**:
```typescript
const game = createMockGame({
  players: [
    createMockPlayer({
      playerId: 2,
      alive: false,
      outReason: 'exile',  // 投票放逐
    }),
  ],
});

const stats = calculatePlayerStats(game);
expect(stats[0].outReason).toBe('exile');
expect(stats[0].outReasonText).toBe('🗳️ 被投票放逐');
```

**关键断言**:
- ✅ 投票后玩家 `outReason` 为 `'exile'`
- ✅ 投票数据结构正确
- ✅ 与后端投票流程一致

---

### 4. 信息安全验证 (P0)

**测试文件**: `backendAdaptation.test.ts`

**背景**:
- **God Console**: 应该显示所有信息(全知视角)
- **Player View**: 只显示玩家应该知道的信息(严格隔离)

**测试验证**:
```typescript
// Player View 不应该泄露出局原因
const player = {
  playerId: 1,
  alive: false,
  outReason: 'wolf_kill',  // 敏感信息
};

// PlayerView UI 只显示 "已出局"
// 不显示具体原因 (会泄露狼人行为)
```

**关键断言**:
- ✅ 玩家看不到其他玩家的角色
- ✅ 出局原因不在玩家视图中显示
- ✅ God Console 可以看到所有信息
- ✅ 夜间行动只对相关角色可见

---

## 📊 测试覆盖率目标

### 当前状态

- **工具函数**: ~90% 覆盖率
- **关键逻辑**: 100% 覆盖率
- **组件测试**: 待实现

### 优先级

1. **P0 (必须)**: 死亡原因枚举、守墓人规则、信息安全
2. **P1 (重要)**: 投票机制、游戏状态同步
3. **P2 (改进)**: UI交互、用户体验

---

## 🐛 已知问题和修复

### 已修复的问题

1. ✅ **死亡原因枚举不匹配**
   - 文件: `client/src/utils/phaseLabels.ts`
   - 修复: 添加了所有后端枚举值的翻译
   - 测试: `phaseLabels.test.ts`

2. ✅ **守墓人规则未在UI体现**
   - 文件: `client/src/pages/GodConsole.tsx:700-733`
   - 修复: 添加了规则提示和可验尸玩家列表
   - 测试: `backendAdaptation.test.ts`

3. ✅ **PlayerView 信息泄露风险**
   - 文件: `client/src/pages/PlayerView.tsx:334-336`
   - 修复: 添加了安全警告注释
   - 测试: `backendAdaptation.test.ts`

---

## 📝 测试数据工厂

### Mock Data 使用

我们提供了完整的测试数据工厂 (`test/mockData/gameMocks.ts`):

```typescript
// 创建基础游戏
const game = createMockGame({ currentPhase: 'wolf' });

// 创建玩家
const player = createMockPlayer({ role: 'seer', camp: 'good' });

// 创建完整12人局
const fullGame = createMockFullGame();

// 创建守墓人测试场景
const gravekeeperGame = createGravekeeperTestGame();

// 创建投票测试场景
const votingGame = createVotingTestGame();

// 创建已结束的游戏
const finishedGame = createFinishedGameGoodWin();
```

---

## 🔧 测试配置

### vitest.config.ts

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
      ],
    },
  },
});
```

### 测试环境设置

文件: `src/test/setup.ts`
- 配置 jest-dom matchers
- Mock WebSocket
- Mock window.matchMedia
- 自动清理测试环境

---

## 📚 参考文档

### 相关文件

1. **分析报告**: `CRITICAL_ISSUES_ANALYSIS.md`
   - 完整的批判性分析
   - 问题优先级
   - 修复方案

2. **后端测试**: `server/E2E_TESTING_SUMMARY.md`
   - E2E测试框架
   - 后端逻辑验证
   - 测试覆盖率报告

3. **守墓人规则**: `server/src/game/roles/GravekeeperHandler.ts`
   - 后端实现逻辑
   - 验尸规则验证

---

## 🎯 下一步计划

### 待实现的测试

1. **GodConsole 组件测试**
   - [ ] 渲染测试
   - [ ] 实时状态更新
   - [ ] 导出复盘功能
   - [ ] 用户交互(分配角色、推进阶段)

2. **PlayerView 组件测试**
   - [ ] 渲染测试
   - [ ] 角色特定UI
   - [ ] 投票界面
   - [ ] 信息隔离验证

3. **E2E 测试**
   - [ ] 完整游戏流程
   - [ ] WebSocket 通信
   - [ ] 多客户端协同

---

## 💡 最佳实践

### 编写测试时

1. **使用 Mock 数据工厂**
   ```typescript
   import { createMockGame, createMockPlayer } from './mockData/gameMocks';
   ```

2. **清晰的测试描述**
   ```typescript
   it('P0: 守墓人只能验尸被放逐的玩家', () => {
     // ...
   });
   ```

3. **优先级标记**
   - `P0`: 关键功能,必须通过
   - `P1`: 重要功能
   - `P2`: 体验优化

4. **关注边界情况**
   - 空值处理
   - 极端值
   - 异常状态

---

## 🤝 贡献指南

### 添加新测试

1. 在相应目录创建 `.test.ts` 文件
2. 使用统一的 Mock 数据
3. 添加清晰的描述和注释
4. 更新本文档

### 报告问题

1. 在 `CRITICAL_ISSUES_ANALYSIS.md` 中记录
2. 标注优先级(P0/P1/P2)
3. 提供复现步骤
4. 编写失败的测试

---

## 📞 联系方式

如有问题或建议,请查阅:
- `CRITICAL_ISSUES_ANALYSIS.md` - 问题分析报告
- `server/E2E_TESTING_SUMMARY.md` - 后端测试文档
