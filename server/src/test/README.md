# 狼人杀游戏 E2E 测试框架

## 设计理念

### 为什么不做笛卡尔积测试？

笛卡尔积测试（测试所有可能的组合）存在以下问题：

1. **组合爆炸**：
   - 12个剧本 × 10种角色组合 × 5种夜晚行动顺序 × 3种投票结果 = **1,800+ 测试用例**
   - 每个测试耗时 30-60 秒 = **15-30 小时**运行时间
   - 维护成本极高，任何改动都可能影响大量测试

2. **测试不稳定**：
   - 多客户端并发通信，时序问题
   - 随机性导致测试不可重复

3. **调试困难**：
   - 失败时难以定位具体问题
   - 日志过于复杂

### 我们的测试策略：分层 + 场景化

```
┌─────────────────────────────────────────┐
│  P0: 冒烟测试 (Smoke Tests)             │  每次必跑
│  - 关键路径验证                         │  运行时间: 1-2分钟
│  - 基本流程完整性                       │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  P1: 关键功能测试 (Critical Tests)      │  每日构建
│  - 核心角色技能                         │  运行时间: 5-10分钟
│  - 核心游戏机制                         │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  P2: 重要功能测试 (Important Tests)     │  每周回归
│  - 技能交互                             │  运行时间: 15-30分钟
│  - 复杂场景                             │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  P3: 边界情况测试 (Edge Cases)          │  发版前
│  - 特殊规则                             │  运行时间: 30-60分钟
│  - 边界条件                             │
└─────────────────────────────────────────┘
```

## 核心组件

### 1. E2ETestFramework.ts - 测试执行框架

提供DSL风格的测试API，让测试易读易写：

```typescript
const executor = new E2ETestExecutor();
await executor.init();

// 配置游戏
const config: E2ETestConfig = {
  name: '女巫解药测试',
  scriptId: 'dreamer-nightmare',
  roleAssignments: ScenarioBuilder.dreamerScript(),
  scenario: '验证女巫使用解药能救下被刀的玩家',
};

await executor.setupGame(config);

// 执行回合
const round: TestRound = {
  roundNumber: 1,
  nightActions: [
    { phase: 'wolf', playerId: 2, target: 9 },
    { phase: 'witch', playerId: 7, target: 9, data: { actionType: 'save' } },
  ],
  expectedDeaths: [], // 期望没人死亡
};

await executor.executeRound(round);
```

### 2. TestRunner.ts - 测试运行器

支持：
- 批量运行测试
- 优先级过滤
- 报告生成
- 成对测试策略

### 3. ScenarioBuilder - 场景构建器

预定义常用配置：

```typescript
// 标准12人局
ScenarioBuilder.standard12Player(
  ['wolf', 'wolf', 'wolf', 'wolf'],  // 狼人
  ['seer', 'witch', 'hunter', 'guard'],  // 神职
  4  // 平民数量
)

// 预设剧本
ScenarioBuilder.dreamerScript()
ScenarioBuilder.gravekeeperScript()
ScenarioBuilder.knightBeautyScript()
```

## 使用方法

### 快速开始

```bash
# 安装依赖
cd server
npm install

# 运行所有测试
npm run test:e2e

# 只运行冒烟测试（快速验证）
npm run test:e2e:smoke

# 运行关键功能测试
npm run test:e2e:critical
```

### 添加 package.json 脚本

```json
{
  "scripts": {
    "test:e2e": "tsx src/test/runE2ETests.ts all",
    "test:e2e:smoke": "tsx src/test/runE2ETests.ts smoke",
    "test:e2e:critical": "tsx src/test/runE2ETests.ts critical",
    "test:e2e:important": "tsx src/test/runE2ETests.ts important"
  }
}
```

### 编写新测试

#### 1. 冒烟测试（最简单）

```typescript
// 在 E2ESmokeTest.test.ts 中添加
it('应该能完成基本游戏流程', async () => {
  const executor = new E2ETestExecutor();
  await executor.init();

  const { config, rounds } = TestScenarios.smokeTest();
  await executor.setupGame(config);

  for (const round of rounds) {
    await executor.executeRound(round);
  }
});
```

#### 2. 场景化测试（推荐）

```typescript
// 在 E2EScenarioTest.test.ts 中添加
it('骑士应该能决斗指定玩家', async () => {
  const executor = new E2ETestExecutor();
  await executor.init();

  const config: E2ETestConfig = {
    name: '骑士决斗测试',
    scriptId: 'knight-beauty',
    roleAssignments: ScenarioBuilder.knightBeautyScript(),
    scenario: '验证骑士白天能发起决斗',
  };

  await executor.setupGame(config);

  // 第一晚：正常流程
  const round1: TestRound = {
    roundNumber: 1,
    nightActions: [
      { phase: 'wolf', playerId: 1, target: 9 },
      { phase: 'seer', playerId: 6, target: 1 },
    ],
    expectedDeaths: [9],
  };

  await executor.executeRound(round1);

  // 白天：骑士决斗
  // TODO: 添加决斗逻辑测试
});
```

## 测试策略指南

### 成对测试（Pairwise Testing）

当需要测试多个因素的交互时，不要测试全排列，而是使用成对策略：

```typescript
// ❌ 错误：全排列测试（3! = 6 个测试）
const allCombinations = [
  ['seer', 'witch', 'guard'],
  ['seer', 'guard', 'witch'],
  ['witch', 'seer', 'guard'],
  ['witch', 'guard', 'seer'],
  ['guard', 'seer', 'witch'],
  ['guard', 'witch', 'seer'],
];

// ✅ 正确：成对测试（3 个测试即可覆盖所有两两交互）
const pairwiseTests = [
  { seer: 'first', witch: 'second', guard: 'third' },
  { seer: 'second', witch: 'first', guard: 'third' },
  { seer: 'third', witch: 'second', guard: 'first' },
];
```

### 等价类划分

将相似的功能归类，只测试代表性样本：

```typescript
// ✅ 查验类技能只测试预言家（代表所有查验类）
it('查验类技能应该返回正确信息', async () => {
  // 测试预言家
});

// ✅ 保护类技能只测试守卫（代表所有保护类）
it('保护类技能应该免疫伤害', async () => {
  // 测试守卫
});
```

### 边界值测试

专注测试极端情况：

```typescript
// 最少配置
{ playerCount: 6, wolfCount: 2, godCount: 2 }

// 狼多配置
{ playerCount: 12, wolfCount: 5, godCount: 3 }

// 神多配置
{ playerCount: 12, wolfCount: 3, godCount: 6 }
```

## 测试覆盖率目标

| 优先级 | 覆盖目标 | 运行频率 |
|--------|----------|----------|
| P0 (Smoke) | 100% 关键路径 | 每次提交 |
| P1 (Critical) | 80% 核心功能 | 每日构建 |
| P2 (Important) | 60% 重要功能 | 每周回归 |
| P3 (Edge) | 40% 边界情况 | 发版前 |

## 测试报告示例

```
================================================================================
                         狼人杀 E2E 测试报告
================================================================================

📦 P0-SMOKE Tests
--------------------------------------------------------------------------------
   总测试数: 2
   ✅ 通过: 2
   ❌ 失败: 0
   ⏱️  耗时: 1234ms
   通过率: 100.0%

📦 P1-CRITICAL Tests
--------------------------------------------------------------------------------
   总测试数: 5
   ✅ 通过: 4
   ❌ 失败: 1
   ⏱️  耗时: 5678ms
   通过率: 80.0%

   失败的测试:
     ❌ 女巫毒药 - 毒人功能
        错误: 期望玩家 2 死亡，但实际未死亡

================================================================================
                             总结
================================================================================
总测试数: 7
✅ 通过: 6
❌ 失败: 1
⏱️  总耗时: 6912ms
通过率: 85.7%
================================================================================
```

## 常见问题

### Q: 我应该测试所有角色组合吗？

**A:** 不应该。使用等价类划分：
- 查验类：测试预言家即可
- 保护类：测试守卫即可
- 死亡类：测试女巫毒药即可

### Q: 测试失败时如何调试？

**A:**
1. 查看测试报告中的错误信息
2. 检查 `expectedDeaths` 是否正确
3. 使用 `executor.getGame()` 查看游戏状态
4. 添加 `console.log` 输出中间状态

### Q: 如何测试随机角色分配？

**A:** 不要测试随机性本身，而是：
1. 固定角色分配进行测试
2. 测试角色分配逻辑的正确性（单元测试）
3. 手动测试随机场景

### Q: 测试太慢怎么办？

**A:**
1. 只运行 P0/P1 级别测试
2. 使用 `skipDayPhase()` 跳过不必要的白天流程
3. 并行运行独立测试（未来优化）

## 贡献指南

添加新测试时：

1. ✅ 明确测试场景和目标
2. ✅ 使用描述性的测试名称
3. ✅ 设置正确的优先级
4. ✅ 添加必要的断言
5. ✅ 更新本文档

不要：

1. ❌ 测试所有可能的组合（笛卡尔积）
2. ❌ 写过于复杂的测试（难以维护）
3. ❌ 依赖随机性（测试不稳定）
4. ❌ 测试实现细节（测试行为）

## 未来优化

- [ ] 并行测试执行
- [ ] 测试覆盖率统计
- [ ] 失败重试机制
- [ ] 可视化测试报告
- [ ] CI/CD 集成
- [ ] 性能基准测试

## 联系方式

有问题或建议？欢迎提 Issue 或 PR！
