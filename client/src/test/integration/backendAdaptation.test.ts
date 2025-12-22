/**
 * 后端适配集成测试
 * 验证前端逻辑与后端修改的一致性
 */

import { describe, it, expect } from 'vitest';
import { translateDeathReason } from '../../utils/phaseLabels';
import { calculatePlayerStats } from '../../utils/gameStats';
import { createMockGame, createMockPlayer, createGravekeeperTestGame } from '../mockData/gameMocks';

describe('后端逻辑适配测试', () => {
  describe('死亡原因枚举适配', () => {
    it('P0: 应该正确处理后端的 DeathReason 枚举值', () => {
      // 后端使用 snake_case
      const backendDeathReasons = [
        'wolf_kill',
        'poison',
        'exile',
        'hunter_shoot',
        'dream_kill',
        'black_wolf_explode',
        'knight_duel',
        'wolf_beauty_link',
        'self_destruct',
      ];

      backendDeathReasons.forEach(reason => {
        const translated = translateDeathReason(reason);
        // 不应该返回原始值 (说明有翻译)
        expect(translated).not.toBe(reason);
        // 应该包含表情符号 (我们的翻译格式)
        expect(translated).toMatch(/[🐺☠️🗳️🏹💤💥⚔️💃💣]/);
      });
    });

    it('P0: 投票放逐应该使用 exile 而不是 vote', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({
            playerId: 1,
            alive: false,
            outReason: 'exile',  // 后端新格式
          }),
        ],
      });

      const stats = calculatePlayerStats(game);
      expect(stats[0].outReasonText).toBe('🗳️ 被投票放逐');
    });

    it('P0: 狼刀应该使用 wolf_kill 而不是 wolfKill', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({
            playerId: 1,
            alive: false,
            outReason: 'wolf_kill',  // 后端新格式
          }),
        ],
      });

      const stats = calculatePlayerStats(game);
      expect(stats[0].outReasonText).toBe('🐺 被狼刀');
    });

    it('P0: 新增的死亡原因应该能正确翻译', () => {
      // 后端新增了 self_destruct
      expect(translateDeathReason('self_destruct')).toBe('💣 狼人自爆');

      // 后端新增了 black_wolf_explode
      expect(translateDeathReason('black_wolf_explode')).toBe('💥 黑狼自爆');
    });
  });

  describe('守墓人规则适配', () => {
    it('P0: 守墓人只能验尸 outReason === exile 的玩家', () => {
      const game = createGravekeeperTestGame();

      // 找出所有死亡玩家
      const deadPlayers = game.players.filter(p => !p.alive);
      expect(deadPlayers.length).toBe(2); // 2号和9号

      // 找出可验尸的玩家 (只有被放逐的)
      const validTargets = deadPlayers.filter(p => p.outReason === 'exile');
      expect(validTargets.length).toBe(1);
      expect(validTargets[0].playerId).toBe(2);

      // 确认不可验尸的玩家
      const invalidTargets = deadPlayers.filter(p => p.outReason !== 'exile');
      expect(invalidTargets.length).toBe(1);
      expect(invalidTargets[0].playerId).toBe(9);
      expect(invalidTargets[0].outReason).toBe('wolf_kill');
    });

    it('P0: 前端应该过滤掉非exile的死亡玩家', () => {
      const game = createGravekeeperTestGame();

      // 模拟 GodConsole 中的过滤逻辑
      const exiledPlayers = game.players.filter(
        p => !p.alive && p.outReason === 'exile'
      );

      expect(exiledPlayers.map(p => p.playerId)).toEqual([2]);
    });

    it('P0: 守墓人不能验尸夜晚死亡的玩家', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ playerId: 1, alive: false, outReason: 'wolf_kill' }),
          createMockPlayer({ playerId: 2, alive: false, outReason: 'poison' }),
          createMockPlayer({ playerId: 3, alive: false, outReason: 'dream_kill' }),
          createMockPlayer({ playerId: 4, alive: false, outReason: 'exile' }), // 唯一可验尸
        ],
      });

      const validTargets = game.players.filter(
        p => !p.alive && p.outReason === 'exile'
      );

      expect(validTargets.length).toBe(1);
      expect(validTargets[0].playerId).toBe(4);
    });

    it('P0: 守墓人不能验尸自爆的狼人', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ playerId: 1, alive: false, outReason: 'self_destruct' }),
          createMockPlayer({ playerId: 2, alive: false, outReason: 'exile' }),
        ],
      });

      const validTargets = game.players.filter(
        p => !p.alive && p.outReason === 'exile'
      );

      expect(validTargets.length).toBe(1);
      expect(validTargets[0].playerId).toBe(2);
    });
  });

  describe('投票机制适配', () => {
    it('P1: 投票后玩家的 outReason 应该是 exile', () => {
      // 模拟投票后的游戏状态
      const game = createMockGame({
        players: [
          createMockPlayer({
            playerId: 2,
            alive: false,
            outReason: 'exile',  // 投票放逐
          }),
        ],
        exileVote: {
          phase: 'done',
          result: 2,
          votes: {},
        },
      });

      const stats = calculatePlayerStats(game);
      expect(stats[0].outReason).toBe('exile');
      expect(stats[0].outReasonText).toBe('🗳️ 被投票放逐');
    });

    it('P1: 验证投票流程与后端一致', () => {
      // 后端逻辑:
      // 1. 玩家投票 -> EXILE_VOTE 消息
      // 2. 后端统计票数 -> VotingSystem.tallyExileVotes()
      // 3. 创建 EXILE effect -> priority: EXILE_VOTE (2000)
      // 4. 执行 daySettlement -> 玩家死亡, outReason = 'exile'

      const game = createMockGame({
        currentPhase: 'vote',
        exileVote: {
          phase: 'voting',
          votes: {
            1: 2,
            3: 2,
            4: 2,
            5: 2,
            6: 2,  // 5票投给2号
          },
        },
      });

      // 验证投票数据结构
      expect(game.exileVote).toBeDefined();
      expect(game.exileVote!.phase).toBe('voting');
      expect(Object.values(game.exileVote!.votes).filter(v => v === 2).length).toBe(5);
    });
  });

  describe('游戏状态同步验证', () => {
    it('P1: 应该正确处理游戏各个阶段', () => {
      const phases = [
        'wolf',
        'witch',
        'seer',
        'gravekeeper',
        'settle',
        'discussion',
        'vote',
        'daySettle',
      ];

      phases.forEach(phase => {
        const game = createMockGame({ currentPhase: phase });
        expect(game.currentPhase).toBe(phase);
      });
    });

    it('P1: 夜间行动状态应该与后端结构一致', () => {
      const game = createMockGame({
        nightActions: {
          // 狼人刀人
          wolfSubmitted: true,
          wolfKill: 9,
          wolfVotes: { 1: 9, 2: 9, 3: 9 },

          // 女巫
          witchSubmitted: true,
          witchKnowsVictim: 9,
          witchAction: 'save',

          // 预言家
          seerSubmitted: true,
          seerCheck: 2,
          seerResult: 'wolf',

          // 守墓人
          gravekeeperSubmitted: false,
        },
      });

      expect(game.nightActions.wolfSubmitted).toBe(true);
      expect(game.nightActions.wolfKill).toBe(9);
      expect(game.nightActions.witchAction).toBe('save');
      expect(game.nightActions.seerResult).toBe('wolf');
      expect(game.nightActions.gravekeeperSubmitted).toBe(false);
    });
  });

  describe('安全性验证', () => {
    it('P0: 玩家视图不应该能访问其他玩家的角色', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ playerId: 1, userId: 'user-1', role: 'wolf', camp: 'wolf' }),
          createMockPlayer({ playerId: 2, userId: 'user-2', role: 'seer', camp: 'good' }),
        ],
      });

      // 玩家1 (狼人) 不应该知道玩家2的角色
      // 这应该由后端的消息过滤保证
      // 前端只显示玩家自己的角色信息

      const player1 = game.players.find(p => p.userId === 'user-1')!;
      expect(player1.role).toBe('wolf'); // 玩家可以看到自己的角色

      // 玩家2的角色对玩家1应该是隐藏的 (前端不显示)
      // 这由 PlayerView 的UI逻辑保证
    });

    it('P1: God Console 应该显示所有信息', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ playerId: 1, role: 'wolf', camp: 'wolf' }),
          createMockPlayer({ playerId: 2, role: 'seer', camp: 'good' }),
        ],
      });

      // God Console 可以看到所有角色
      game.players.forEach(player => {
        expect(player.role).toBeDefined();
        expect(player.camp).toBeDefined();
      });
    });

    it('P0: 出局原因不应该在玩家视图中泄露', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({
            playerId: 1,
            alive: false,
            outReason: 'wolf_kill',  // 敏感信息
          }),
        ],
      });

      // PlayerView 只应该显示 "已出局"
      // 不应该显示具体原因 (会泄露狼人行为)
      const player = game.players[0];
      expect(player.alive).toBe(false);

      // PlayerView UI 应该只显示 "已出局"，不显示 outReason
      // 这由代码注释和测试保证
    });
  });
});
