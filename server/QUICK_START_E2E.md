# E2E 测试快速开始指南

## 5 分钟快速上手

### 第一步：理解测试策略

我们**不做**笛卡尔积测试（会有数百万个测试用例），而是采用**分层场景化测试**：

```
P0: 冒烟测试 (2个) → 1-2分钟 → 每次提交运行
P1: 关键测试 (5个) → 5-10分钟 → 每日构建运行
P2: 重要测试 (2个) → 15-30分钟 → 每周回归
P3: 边界测试 (2个) → 30-60分钟 → 发版前运行
```

### 第二步：运行测试

```bash
# 进入 server 目录
cd server

# 安装依赖（如果还没安装）
npm install

# 运行最快的冒烟测试（推荐开始）
npm run test:e2e:smoke

# 运行关键功能测试
npm run test:e2e:critical

# 运行完整测试套件
npm run test:e2e
```

### 第三步：查看测试报告

运行后你会看到类似这样的报告：

```
╔════════════════════════════════════════════════════════════════╗
║          狼人杀游戏 E2E 自动化测试套件                        ║
╚════════════════════════════════════════════════════════════════╝

🔥 运行模式: 冒烟测试 (P0)

运行测试: 冒烟测试 - 标准游戏流程

=== 冒烟测试 - 标准流程 ===
剧本: dreamer-nightmare
场景: 验证游戏基本流程能正常运行2个回合

执行第 1 回合...
  ✓ fear: 玩家1 -> 6
  ✓ dream: 玩家5 -> 2
  ✓ wolf: 玩家2 -> 9
  ✓ witch: 玩家7 -> 无目标
  ✓ seer: 玩家6 -> 2
  ✓ 验证死亡玩家: 9

执行第 2 回合...
  ✓ fear: 玩家1 -> 7
  ✓ dream: 玩家5 -> 2
  ✓ wolf: 玩家2 -> 10
  ✓ witch: 玩家7 -> 无目标
  ✓ seer: 玩家6 -> 2
  ✓ 验证死亡玩家: 9, 10

✅ 冒烟测试通过

✅ 通过 (1234ms)

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

================================================================================
                             总结
================================================================================
总测试数: 2
✅ 通过: 2
❌ 失败: 0
⏱️  总耗时: 1234ms
通过率: 100.0%
================================================================================
```

## 测试文件说明

### 核心文件（不需要修改）

- `E2ETestFramework.ts` - 测试框架核心
- `TestRunner.ts` - 测试运行器
- `runE2ETests.ts` - 可执行脚本

### 测试用例文件（你可能需要修改）

- `E2ESmokeTest.test.ts` - 冒烟测试
- `E2EScenarioTest.test.ts` - 场景测试

## 添加新测试

### 简单方式：使用 Vitest

```typescript
// 在 E2ESmokeTest.test.ts 或 E2EScenarioTest.test.ts 中添加

it('应该测试新功能', async () => {
  const executor = new E2ETestExecutor();
  await executor.init();

  const config: E2ETestConfig = {
    name: '新功能测试',
    scriptId: 'dreamer-nightmare',
    roleAssignments: ScenarioBuilder.dreamerScript(),
    scenario: '描述你要测试什么',
  };

  await executor.setupGame(config);

  const round: TestRound = {
    roundNumber: 1,
    nightActions: [
      { phase: 'wolf', playerId: 2, target: 9 },
      { phase: 'seer', playerId: 6, target: 2 },
    ],
    expectedDeaths: [9],
  };

  await executor.executeRound(round);

  // 添加你的断言
  const game = executor.getGame();
  expect(game?.status).toBe('running');
});
```

### 高级方式：使用 TestRunner

```typescript
// 在 runE2ETests.ts 的 allTests 数组中添加

{
  priority: TestPriority.CRITICAL,
  name: '你的测试名称',
  fn: async () => {
    const executor = new E2ETestExecutor();
    await executor.init();

    // ... 测试逻辑
  },
},
```

## 常见问题

### Q1: 测试失败了怎么办？

查看错误信息，通常会告诉你：
- 哪个玩家的行动失败了
- 期望的结果是什么
- 实际的结果是什么

### Q2: 如何调试测试？

```typescript
// 在测试中添加日志
console.log('当前游戏状态:', executor.getGame());
console.log('玩家9的状态:', executor.getPlayer(9));
console.log('存活的狼人:', executor.getAliveWolves());
```

### Q3: 测试太慢怎么办？

只运行需要的优先级：
```bash
npm run test:e2e:smoke      # 最快，只测关键路径
npm run test:e2e:critical   # 稍慢，测核心功能
```

### Q4: 如何测试特定剧本？

```typescript
const config: E2ETestConfig = {
  name: '自定义测试',
  scriptId: 'your-script-id',  // 修改这里
  roleAssignments: {
    1: 'wolf',
    2: 'wolf',
    // ... 自定义角色分配
  },
  scenario: '测试描述',
};
```

## 测试覆盖范围

### 已覆盖的功能 ✅

- [x] 基本游戏流程（夜晚 → 白天 → 结算）
- [x] 女巫救人/毒人
- [x] 守卫守护机制
- [x] 恐惧机制
- [x] 守卫连续守护限制
- [x] 女巫技能次数限制
- [x] 摄梦人连续梦死
- [x] 石像鬼阵营归属

### 待添加的功能 ⏳

- [ ] 猎人开枪机制
- [ ] 骑士决斗
- [ ] 白狼王自爆
- [ ] 狼美人魅惑连结
- [ ] 守墓人验尸
- [ ] 预言家查验
- [ ] 投票机制
- [ ] 上警流程
- [ ] 胜利条件判定

## 性能基准

在标准硬件上的预期运行时间：

| 测试级别 | 测试数量 | 预期时间 | 用途 |
|---------|---------|---------|------|
| P0 Smoke | 2 | 1-2 分钟 | 每次提交 |
| P1 Critical | 5 | 5-10 分钟 | 每日构建 |
| P2 Important | 2 | 15-30 分钟 | 每周回归 |
| P3 Edge | 2 | 30-60 分钟 | 发版前 |
| **完整套件** | **11** | **~60 分钟** | **完整验证** |

## 下一步

1. **运行现有测试**：确保所有测试通过
2. **查看测试代码**：理解测试是如何编写的
3. **添加新测试**：为未覆盖的功能添加测试
4. **集成 CI/CD**：将测试加入自动化流程

## 获取帮助

- 查看 `README.md` 了解详细文档
- 查看 `E2E_TEST_FRAMEWORK.md` 了解设计思路
- 查看现有测试代码学习最佳实践
