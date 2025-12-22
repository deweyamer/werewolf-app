/**
 * E2E 测试执行脚本
 *
 * 使用方式:
 *   npm run test:e2e           # 运行所有测试
 *   npm run test:e2e:smoke     # 只运行冒烟测试
 *   npm run test:e2e:critical  # 运行关键测试
 */

import {
  E2ETestExecutor,
  E2ETestConfig,
  TestRound,
  TestScenarios,
  ScenarioBuilder,
} from './E2ETestFramework.js';
import {
  TestRunner,
  TestPriority,
  PrioritizedTest,
  TestPriorityRunner,
} from './TestRunner.js';
import {
  allScriptTests,
  dreamerScriptTests,
  knightBeautyScriptTests,
  gravekeeperGargoyleScriptTests,
} from './E2EScriptTests.js';

// ==================== 定义所有测试用例 ====================

const allTests: PrioritizedTest[] = [
  // ===== P0: 冒烟测试 =====
  {
    priority: TestPriority.SMOKE,
    name: '冒烟测试 - 标准游戏流程',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();

      const { config, rounds } = TestScenarios.smokeTest();
      await executor.setupGame(config);

      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  // ===== P1: 关键功能测试 =====
  {
    priority: TestPriority.CRITICAL,
    name: '女巫解药 - 救人功能',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();

      const config: E2ETestConfig = {
        name: '女巫解药测试',
        scriptId: 'dreamer-nightmare',
        roleAssignments: ScenarioBuilder.dreamerScript(),
        scenario: '验证女巫使用解药能救下被刀的玩家',
      };

      await executor.setupGame(config);

      const round: TestRound = {
        roundNumber: 1,
        nightActions: [
          { phase: 'wolf', playerId: 2, target: 9 },
          { phase: 'witch', playerId: 7, target: 9, data: { actionType: 'save' } },
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        expectedDeaths: [],
      };

      await executor.executeRound(round);

      const player9 = executor.getPlayer(9);
      if (!player9?.alive) {
        throw new Error('玩家9应该被救活');
      }
    },
  },

  {
    priority: TestPriority.CRITICAL,
    name: '女巫毒药 - 毒人功能',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();

      const config: E2ETestConfig = {
        name: '女巫毒药测试',
        scriptId: 'dreamer-nightmare',
        roleAssignments: ScenarioBuilder.dreamerScript(),
        scenario: '验证女巫使用毒药能额外毒死一个玩家',
      };

      await executor.setupGame(config);

      const round: TestRound = {
        roundNumber: 1,
        nightActions: [
          { phase: 'wolf', playerId: 2, target: 9 },
          { phase: 'witch', playerId: 7, target: 2, data: { actionType: 'poison' } },
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        expectedDeaths: [9, 2],
      };

      await executor.executeRound(round);
    },
  },

  {
    priority: TestPriority.CRITICAL,
    name: '守卫守护 - 免疫狼刀',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();

      const config: E2ETestConfig = {
        name: '守卫守护机制',
        scriptId: 'knight-beauty',
        roleAssignments: ScenarioBuilder.knightBeautyScript(),
        scenario: '验证守卫守护的玩家免疫狼刀',
      };

      await executor.setupGame(config);

      const round: TestRound = {
        roundNumber: 1,
        nightActions: [
          { phase: 'guard', playerId: 8, target: 9 },
          { phase: 'wolf', playerId: 1, target: 9 },
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          { phase: 'seer', playerId: 6, target: 1 },
        ],
        expectedDeaths: [],
      };

      await executor.executeRound(round);

      const player9 = executor.getPlayer(9);
      if (!player9?.alive) {
        throw new Error('玩家9应该被守护免疫');
      }
    },
  },

  {
    priority: TestPriority.CRITICAL,
    name: '恐惧机制 - 禁用技能',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();

      const config: E2ETestConfig = {
        name: '恐惧机制测试',
        scriptId: 'dreamer-nightmare',
        roleAssignments: ScenarioBuilder.dreamerScript(),
        scenario: '验证噩梦之影恐惧后，目标无法使用技能',
      };

      await executor.setupGame(config);

      const round: TestRound = {
        roundNumber: 1,
        nightActions: [
          { phase: 'fear', playerId: 1, target: 6 },
          { phase: 'dream', playerId: 5, target: 2 },
          { phase: 'wolf', playerId: 2, target: 9 },
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          {
            phase: 'seer',
            playerId: 6,
            target: 2,
            expected: { success: false, message: '恐惧' },
          },
        ],
        expectedDeaths: [9],
      };

      await executor.executeRound(round);
    },
  },

  // ===== P2: 重要功能测试 =====
  {
    priority: TestPriority.IMPORTANT,
    name: '女巫解药次数限制',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();

      const config: E2ETestConfig = {
        name: '女巫解药次数限制',
        scriptId: 'dreamer-nightmare',
        roleAssignments: ScenarioBuilder.dreamerScript(),
        scenario: '验证女巫解药只能使用一次',
      };

      await executor.setupGame(config);

      const round1: TestRound = {
        roundNumber: 1,
        nightActions: [
          { phase: 'wolf', playerId: 2, target: 9 },
          { phase: 'witch', playerId: 7, target: 9, data: { actionType: 'save' } },
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        expectedDeaths: [],
      };

      await executor.executeRound(round1);

      const round2: TestRound = {
        roundNumber: 2,
        nightActions: [
          { phase: 'wolf', playerId: 2, target: 10 },
          {
            phase: 'witch',
            playerId: 7,
            target: 10,
            data: { actionType: 'save' },
            expected: { success: false },
          },
        ],
        expectedDeaths: [10],
      };

      await executor.executeRound(round2);
    },
  },

  {
    priority: TestPriority.IMPORTANT,
    name: '摄梦人连续梦死',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();

      const config: E2ETestConfig = {
        name: '摄梦人梦死机制',
        scriptId: 'dreamer-nightmare',
        roleAssignments: ScenarioBuilder.dreamerScript(),
        scenario: '验证摄梦人连续两晚梦同一人会梦死该玩家',
      };

      await executor.setupGame(config);

      const round1: TestRound = {
        roundNumber: 1,
        nightActions: [
          { phase: 'dream', playerId: 5, target: 10 },
          { phase: 'wolf', playerId: 2, target: 9 },
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        expectedDeaths: [9],
      };

      await executor.executeRound(round1);

      const round2: TestRound = {
        roundNumber: 2,
        nightActions: [
          { phase: 'dream', playerId: 5, target: 10 },
          { phase: 'wolf', playerId: 2, target: 11 },
          { phase: 'seer', playerId: 6, target: 3 },
        ],
        expectedDeaths: [9, 10, 11],
      };

      await executor.executeRound(round2);
    },
  },

  // ===== P3: 边界情况测试 =====
  {
    priority: TestPriority.EDGE_CASE,
    name: '守卫连续守护限制',
    fn: async () => {
      const { config, rounds } = TestScenarios.guardConsecutiveTest();
      const executor = new E2ETestExecutor();
      await executor.init();

      await executor.setupGame(config);

      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  {
    priority: TestPriority.EDGE_CASE,
    name: '石像鬼阵营归属',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();

      const config: E2ETestConfig = {
        name: '石像鬼阵营归属',
        scriptId: 'gravekeeper-gargoyle',
        roleAssignments: ScenarioBuilder.gravekeeperScript(),
        scenario: '验证石像鬼计入狼阵营',
      };

      await executor.setupGame(config);

      const wolves = executor.getAliveWolves();
      const goods = executor.getAliveGood();

      if (wolves.length !== 4) {
        throw new Error(`期望4个狼，实际${wolves.length}个`);
      }

      if (goods.length !== 8) {
        throw new Error(`期望8个好人，实际${goods.length}个`);
      }

      const gargoyleInWolves = wolves.some(p => p.role === 'gargoyle');
      if (!gargoyleInWolves) {
        throw new Error('石像鬼应该在狼阵营中');
      }
    },
  },

  // ==================== 摄梦人剧本测试 ====================

  // 核心规则测试
  {
    priority: TestPriority.CRITICAL,
    name: '【摄梦人】连续两晚梦死机制',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = dreamerScriptTests.dreamerConsecutiveDreamKill;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  {
    priority: TestPriority.IMPORTANT,
    name: '【摄梦人】不连续梦不会梦死',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = dreamerScriptTests.dreamerNonConsecutiveDream;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  {
    priority: TestPriority.CRITICAL,
    name: '【摄梦人】噩梦恐惧持续整个回合',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = dreamerScriptTests.nightmareFearMechanism;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  // 边界情况测试
  {
    priority: TestPriority.EDGE_CASE,
    name: '【摄梦人】边界：摄梦人梦自己',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = dreamerScriptTests.dreamerDreamThemself;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  {
    priority: TestPriority.IMPORTANT,
    name: '【摄梦人】边界：女巫救人 vs 梦死',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = dreamerScriptTests.witchSaveThenDreamerKill;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  {
    priority: TestPriority.EDGE_CASE,
    name: '【摄梦人】边界：噩梦之影不能恐惧自己',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = dreamerScriptTests.nightmareFearSelf;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  {
    priority: TestPriority.IMPORTANT,
    name: '【摄梦人】边界：恐惧在白天结算后清除',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = dreamerScriptTests.fearClearAfterDay;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  // ==================== 骑士狼美人剧本测试 ====================

  // 核心规则测试
  {
    priority: TestPriority.CRITICAL,
    name: '【骑士狼美人】守卫连续守护限制',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = knightBeautyScriptTests.guardConsecutiveProtection;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  {
    priority: TestPriority.CRITICAL,
    name: '【骑士狼美人】守卫守护免疫狼刀',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = knightBeautyScriptTests.guardProtectionImmune;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  {
    priority: TestPriority.IMPORTANT,
    name: '【骑士狼美人】守卫守护 vs 女巫毒药',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = knightBeautyScriptTests.guardVsWitchPoison;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  // 边界情况测试
  {
    priority: TestPriority.EDGE_CASE,
    name: '【骑士狼美人】边界：守卫守护自己',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = knightBeautyScriptTests.guardProtectSelf;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  {
    priority: TestPriority.EDGE_CASE,
    name: '【骑士狼美人】边界：守卫守护死人',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = knightBeautyScriptTests.guardProtectDeadPlayer;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  // ==================== 守墓人石像鬼剧本测试 ====================

  // 核心规则测试
  {
    priority: TestPriority.CRITICAL,
    name: '【守墓人石像鬼】石像鬼查验具体角色',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = gravekeeperGargoyleScriptTests.gargoyleCheckSpecificRole;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  {
    priority: TestPriority.IMPORTANT,
    name: '【守墓人石像鬼】守墓人验尸机制',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = gravekeeperGargoyleScriptTests.gravekeeperAutopsy;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  {
    priority: TestPriority.IMPORTANT,
    name: '【守墓人石像鬼】预言家查验石像鬼',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = gravekeeperGargoyleScriptTests.seerCheckGargoyle;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  // 边界情况测试

  {
    priority: TestPriority.EDGE_CASE,
    name: '【守墓人石像鬼】边界：守墓人验尸狼人',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = gravekeeperGargoyleScriptTests.gravekeeperAutopsyWolf;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  {
    priority: TestPriority.EDGE_CASE,
    name: '【守墓人石像鬼】边界：石像鬼查验自己',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = gravekeeperGargoyleScriptTests.gargoyleCheckSelf;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },

  {
    priority: TestPriority.EDGE_CASE,
    name: '【守墓人石像鬼】边界：守墓人验尸空气',
    fn: async () => {
      const executor = new E2ETestExecutor();
      await executor.init();
      const { config, rounds } = gravekeeperGargoyleScriptTests.gravekeeperAutopsyNoBody;
      await executor.setupGame(config);
      for (const round of rounds) {
        await executor.executeRound(round);
      }
    },
  },
];

// ==================== 主执行函数 ====================

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'all';

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║          狼人杀游戏 E2E 自动化测试套件                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  let priority: TestPriority;

  switch (mode) {
    case 'smoke':
      priority = TestPriority.SMOKE;
      console.log('\n🔥 运行模式: 冒烟测试 (P0)\n');
      break;
    case 'critical':
      priority = TestPriority.CRITICAL;
      console.log('\n⚡ 运行模式: 关键功能测试 (P0 + P1)\n');
      break;
    case 'important':
      priority = TestPriority.IMPORTANT;
      console.log('\n📌 运行模式: 重要功能测试 (P0 + P1 + P2)\n');
      break;
    case 'all':
      priority = TestPriority.EDGE_CASE;
      console.log('\n🎯 运行模式: 完整测试 (P0 + P1 + P2 + P3)\n');
      break;
    default:
      console.error(`未知模式: ${mode}`);
      console.log('可用模式: smoke, critical, important, all');
      process.exit(1);
  }

  try {
    const result = await TestPriorityRunner.runPriority(allTests, priority);

    // 生成报告
    const runner = new TestRunner();
    runner['results'] = [result];
    const report = runner.generateReport();

    console.log(report);

    // 退出码
    process.exit(result.failed > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('\n❌ 测试执行失败:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 自动执行（当作为脚本运行时）
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { main };
