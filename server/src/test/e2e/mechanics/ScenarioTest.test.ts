/**
 * E2E 场景化测试
 *
 * 测试策略：
 * - 每个测试针对一个具体的游戏机制或交互
 * - 设计有针对性的场景，而非全流程
 * - 测试关键的角色技能交互
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  E2ETestExecutor,
  E2ETestConfig,
  TestRound,
  ScenarioBuilder,
} from './E2ETestFramework.js';

describe('E2E 场景化测试 - 特定机制验证', () => {
  let executor: E2ETestExecutor;

  beforeEach(async () => {
    executor = new E2ETestExecutor();
    await executor.init();
  });

  describe('女巫技能测试', () => {
    it('女巫应该能正确使用解药救人', async () => {
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
          { phase: 'wolf', playerId: 2, target: 9 }, // 狼刀9号
          { phase: 'witch', playerId: 7, target: 9, data: { actionType: 'save' } }, // 女巫救9号
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        expectedDeaths: [], // 9号应该被救活，没人死
      };

      await executor.executeRound(round);

      const player9 = executor.getPlayer(9);
      expect(player9?.alive).toBe(true);
    });

    it('女巫应该能正确使用毒药毒人', async () => {
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
          { phase: 'wolf', playerId: 2, target: 9 }, // 狼刀9号
          { phase: 'witch', playerId: 7, target: 2, data: { actionType: 'poison' } }, // 女巫毒2号狼人
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        expectedDeaths: [9, 2], // 9号被刀死，2号被毒死
      };

      await executor.executeRound(round);

      const player2 = executor.getPlayer(2);
      const player9 = executor.getPlayer(9);
      expect(player2?.alive).toBe(false);
      expect(player9?.alive).toBe(false);
    });

    it('女巫解药只能使用一次', async () => {
      const config: E2ETestConfig = {
        name: '女巫解药次数限制',
        scriptId: 'dreamer-nightmare',
        roleAssignments: ScenarioBuilder.dreamerScript(),
        scenario: '验证女巫解药只能使用一次',
      };

      await executor.setupGame(config);

      // 第一晚使用解药
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

      // 第二晚尝试再次使用解药（应该失败）
      const round2: TestRound = {
        roundNumber: 2,
        nightActions: [
          { phase: 'wolf', playerId: 2, target: 10 },
          {
            phase: 'witch',
            playerId: 7,
            target: 10,
            data: { actionType: 'save' },
            expected: { success: false, message: '已' }, // 应该提示已使用过
          },
        ],
        expectedDeaths: [10], // 10号应该死亡（无法被救）
      };

      await executor.executeRound(round2);
    });
  });

  describe('摄梦人机制测试', () => {
    it('摄梦人连续两晚梦同一人应该梦死', async () => {
      const config: E2ETestConfig = {
        name: '摄梦人梦死机制',
        scriptId: 'dreamer-nightmare',
        roleAssignments: ScenarioBuilder.dreamerScript(),
        scenario: '验证摄梦人连续两晚梦同一人会梦死该玩家',
      };

      await executor.setupGame(config);

      // 第一晚梦10号
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

      const player10AfterRound1 = executor.getPlayer(10);
      expect(player10AfterRound1?.alive).toBe(true); // 第一晚不会死

      // 第二晚再次梦10号
      const round2: TestRound = {
        roundNumber: 2,
        nightActions: [
          { phase: 'dream', playerId: 5, target: 10 }, // 再次梦10号
          { phase: 'wolf', playerId: 2, target: 11 },
          { phase: 'seer', playerId: 6, target: 3 },
        ],
        expectedDeaths: [9, 10, 11], // 10号应该梦死
      };

      await executor.executeRound(round2);

      const player10AfterRound2 = executor.getPlayer(10);
      expect(player10AfterRound2?.alive).toBe(false); // 第二晚梦死
    });
  });

  describe('守卫机制测试', () => {
    it('守卫守护的玩家应该免疫狼刀', async () => {
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
          { phase: 'guard', playerId: 8, target: 9 }, // 守护9号
          { phase: 'wolf', playerId: 1, target: 9 }, // 狼刀9号
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          { phase: 'seer', playerId: 6, target: 1 },
        ],
        expectedDeaths: [], // 9号被守护，应该不死
      };

      await executor.executeRound(round);

      const player9 = executor.getPlayer(9);
      expect(player9?.alive).toBe(true);
    });
  });

  describe('恐惧机制测试', () => {
    it('被恐惧的玩家应该无法使用技能', async () => {
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
          { phase: 'fear', playerId: 1, target: 6 }, // 恐惧预言家
          { phase: 'dream', playerId: 5, target: 2 },
          { phase: 'wolf', playerId: 2, target: 9 },
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          {
            phase: 'seer',
            playerId: 6,
            target: 2,
            expected: { success: false, message: '恐惧' }, // 应该失败
          },
        ],
        expectedDeaths: [9],
      };

      await executor.executeRound(round);
    });
  });

  describe('石像鬼机制测试', () => {
    it('石像鬼应该能查验到具体角色', async () => {
      const config: E2ETestConfig = {
        name: '石像鬼查验机制',
        scriptId: 'gravekeeper-gargoyle',
        roleAssignments: ScenarioBuilder.gravekeeperScript(),
        scenario: '验证石像鬼能查验具体角色而非只看阵营',
      };

      const game = await executor.setupGame(config);

      // 手动提交石像鬼查验并验证返回数据
      await executor['advanceToPhase']('gargoyle');

      const checkResult = await executor['gameService'].submitAction(game.id, {
        playerId: 1, // 石像鬼
        phase: game.currentPhase,
        target: 6, // 查验预言家
        timestamp: new Date().toISOString(),
      });

      expect(checkResult.success).toBe(true);
      expect(checkResult.data?.role).toBe('seer'); // 应该能看到具体角色
      expect(checkResult.data?.camp).toBe('good');
    });

    it('石像鬼应该算在狼阵营中', async () => {
      const config: E2ETestConfig = {
        name: '石像鬼阵营归属',
        scriptId: 'gravekeeper-gargoyle',
        roleAssignments: ScenarioBuilder.gravekeeperScript(),
        scenario: '验证石像鬼计入狼阵营',
      };

      await executor.setupGame(config);

      const wolves = executor.getAliveWolves();
      const goods = executor.getAliveGood();

      expect(wolves.length).toBe(4); // 石像鬼 + 3狼
      expect(goods.length).toBe(8);

      const gargoyleInWolves = wolves.some(p => p.role === 'gargoyle');
      expect(gargoyleInWolves).toBe(true);
    });
  });

  describe('狼美人机制测试', () => {
    it('狼美人魅惑后应该形成连结', async () => {
      const config: E2ETestConfig = {
        name: '狼美人魅惑机制',
        scriptId: 'knight-beauty',
        roleAssignments: ScenarioBuilder.knightBeautyScript(),
        scenario: '验证狼美人魅惑后与目标形成连结',
      };

      const game = await executor.setupGame(config);

      const round: TestRound = {
        roundNumber: 1,
        nightActions: [
          { phase: 'guard', playerId: 8, target: 6 },
          { phase: 'wolf', playerId: 1, target: 9 },
          { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
          { phase: 'seer', playerId: 6, target: 1 },
          { phase: 'wolf_beauty', playerId: 4, target: 10 }, // 狼美人魅惑10号
        ],
        expectedDeaths: [9],
      };

      await executor.executeRound(round);

      // 验证连结（检查游戏历史或玩家状态）
      const updatedGame = executor.getGame();
      expect(updatedGame?.history.length).toBeGreaterThan(0);

      // TODO: 具体验证连结机制（取决于实现）
    });
  });

  describe('胜利条件测试', () => {
    it('所有狼人死亡时好人获胜', async () => {
      const config: E2ETestConfig = {
        name: '好人胜利条件',
        scriptId: 'dreamer-nightmare',
        roleAssignments: ScenarioBuilder.dreamerScript(),
        scenario: '验证所有狼人死亡后好人获胜',
      };

      await executor.setupGame(config);

      // 通过多回合投票和刀人，逐步淘汰所有狼人
      // 第一晚：刀一个平民，白天投票放逐一个狼人
      const round1: TestRound = {
        roundNumber: 1,
        nightActions: [
          { phase: 'wolf', playerId: 2, target: 9 },
          { phase: 'seer', playerId: 6, target: 2 },
        ],
        dayVotes: [
          { playerId: 5, target: 2 }, // 投狼
          { playerId: 6, target: 2 },
          { playerId: 7, target: 2 },
          { playerId: 8, target: 2 },
          { playerId: 10, target: 2 },
          { playerId: 11, target: 2 },
          { playerId: 12, target: 2 },
        ],
        expectedDeaths: [9, 2],
      };

      console.log('[DEBUG] Test: round1 keys before executeRound:', Object.keys(round1));
      console.log('[DEBUG] Test: round1.dayVotes:', round1.dayVotes);
      await executor.executeRound(round1);

      // 继续淘汰其余狼人...
      // （为了测试速度，可以简化为手动设置状态）

      const game = executor.getGame();
      if (game) {
        // 手动设置所有狼人死亡（快速测试）
        game.players.forEach(p => {
          if (p.role === 'wolf' || p.role === 'nightmare') {
            p.alive = false;
            p.outReason = 'wolf_kill'; // 设置死亡原因
          }
        });

        // 推进到下一个结算阶段以触发胜利判定
        // 需要多次推进直到到达结算阶段
        let currentGame = executor.getGame();
        let attempts = 0;
        const maxAttempts = 30;

        while (currentGame && currentGame.status === 'running' && attempts < maxAttempts) {
          await executor['gameService'].advancePhase(game.id);
          currentGame = executor.getGame();
          attempts++;

          // 如果到达结算阶段，胜利条件会被检查
          if (currentGame?.currentPhase === 'settle' || currentGame?.currentPhase === 'daySettle') {
            break;
          }
        }

        const finalGame = executor.getGame();
        expect(finalGame?.status).toBe('finished');
        expect(finalGame?.winner).toBe('good');
      }
    });
  });
});
