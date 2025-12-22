import { describe, it, expect } from 'vitest';
import {
  calculateGameOverview,
  calculatePlayerStats,
  extractNightActionsSummary,
  getRoleStatusText,
} from './gameStats';
import {
  createMockFullGame,
  createGravekeeperTestGame,
  createFinishedGameGoodWin,
} from '../test/mockData/gameMocks';

describe('gameStats utils', () => {
  describe('calculateGameOverview', () => {
    it('应该正确计算游戏概览统计', () => {
      const game = createMockFullGame();
      const overview = calculateGameOverview(game);

      expect(overview.gameId).toBe(game.id);
      expect(overview.roomCode).toBe(game.roomCode);
      expect(overview.currentRound).toBe(2);
      expect(overview.currentPhase).toBe('gravekeeper');
      expect(overview.totalPlayers).toBe(12);

      // 存活狼人: 1, 3, 4 (2号已死)
      expect(overview.aliveWolves).toBe(3);
      // 存活好人: 8人 (9号已死)
      expect(overview.aliveGoods).toBe(7);
      // 已死狼人: 2号
      expect(overview.deadWolves).toBe(1);
      // 已死好人: 9号
      expect(overview.deadGoods).toBe(1);
    });

    it('应该正确计算已结束游戏的时长', () => {
      const game = createFinishedGameGoodWin();
      const overview = calculateGameOverview(game);

      expect(overview.status).toBe('finished');
      expect(overview.winner).toBe('good');
      expect(overview.duration).toBeDefined();
      // startedAt: 00:05, finishedAt: 01:00, duration = 55分钟
      expect(overview.duration).toBe('55分钟');
    });
  });

  describe('calculatePlayerStats', () => {
    it('应该正确计算玩家统计', () => {
      const game = createMockFullGame();
      const stats = calculatePlayerStats(game);

      expect(stats).toHaveLength(12);

      // 检查第2号玩家 (已被放逐)
      const player2 = stats.find(p => p.playerId === 2);
      expect(player2).toBeDefined();
      expect(player2!.alive).toBe(false);
      expect(player2!.outReason).toBe('exile');
      expect(player2!.outReasonText).toBe('🗳️ 被投票放逐');
      expect(player2!.camp).toBe('wolf');

      // 检查第6号玩家 (预言家警长)
      const player6 = stats.find(p => p.playerId === 6);
      expect(player6).toBeDefined();
      expect(player6!.isSheriff).toBe(true);
      expect(player6!.role).toBe('seer');
      expect(player6!.roleName).toBe('预言家');
    });

    it('应该正确翻译各种死亡原因', () => {
      const game = createGravekeeperTestGame();
      const stats = calculatePlayerStats(game);

      // 2号被放逐
      const player2 = stats.find(p => p.playerId === 2);
      expect(player2!.outReasonText).toBe('🗳️ 被投票放逐');

      // 9号被狼刀
      const player9 = stats.find(p => p.playerId === 9);
      expect(player9!.outReasonText).toBe('🐺 被狼刀');
    });
  });

  describe('extractNightActionsSummary', () => {
    it('应该正确提取夜间行动摘要', () => {
      const game = createMockFullGame();
      const summary = extractNightActionsSummary(game);

      // 狼人行动
      expect(summary.wolf).toBeDefined();
      expect(summary.wolf!.submitted).toBe(true);
      expect(summary.wolf!.targetId).toBe(10);
      expect(summary.wolf!.voters).toEqual([1, 3, 4]);

      // 守墓人行动
      expect(summary.gravekeeper).toBeDefined();
      expect(summary.gravekeeper!.submitted).toBe(false);
      expect(summary.gravekeeper!.actorId).toBe(5);
    });

    it('应该处理女巫行动信息', () => {
      const game = createMockFullGame();
      game.nightActions.witchSubmitted = true;
      game.nightActions.witchKnowsVictim = 10;
      game.nightActions.witchAction = 'save';

      const summary = extractNightActionsSummary(game);

      expect(summary.witch).toBeDefined();
      expect(summary.witch!.victimId).toBe(10);
      expect(summary.witch!.action).toBe('save');
      expect(summary.witch!.submitted).toBe(true);
    });
  });

  describe('getRoleStatusText', () => {
    it('应该显示已出局玩家', () => {
      const player = {
        playerId: 1,
        userId: 'test',
        username: 'test',
        alive: false,
        role: 'wolf',
        camp: 'wolf' as const,
        isSheriff: false,
        abilities: {},
      };

      expect(getRoleStatusText(player)).toBe('已出局');
    });

    it('应该显示警长状态', () => {
      const player = {
        playerId: 1,
        userId: 'test',
        username: 'test',
        alive: true,
        role: 'seer',
        camp: 'good' as const,
        isSheriff: true,
        abilities: {},
      };

      expect(getRoleStatusText(player)).toContain('警长');
    });

    it('应该显示女巫技能状态', () => {
      const witchWithBothPotions = {
        playerId: 1,
        userId: 'test',
        username: 'test',
        alive: true,
        role: 'witch',
        camp: 'good' as const,
        isSheriff: false,
        abilities: {
          antidote: true,
          poison: true,
        },
      };

      const status = getRoleStatusText(witchWithBothPotions);
      expect(status).toContain('有解药');
      expect(status).toContain('有毒药');
    });

    it('应该显示守卫守护记录', () => {
      const guard = {
        playerId: 1,
        userId: 'test',
        username: 'test',
        alive: true,
        role: 'guard',
        camp: 'good' as const,
        isSheriff: false,
        abilities: {
          lastGuardTarget: 5,
        },
      };

      expect(getRoleStatusText(guard)).toContain('上晚守护5号');
    });

    it('应该显示摄梦人梦游记录', () => {
      const dreamer = {
        playerId: 1,
        userId: 'test',
        username: 'test',
        alive: true,
        role: 'dreamer',
        camp: 'good' as const,
        isSheriff: false,
        abilities: {
          lastDreamTarget: 3,
        },
      };

      expect(getRoleStatusText(dreamer)).toContain('上晚梦游3号');
    });

    it('应该返回正常如果没有特殊状态', () => {
      const player = {
        playerId: 1,
        userId: 'test',
        username: 'test',
        alive: true,
        role: 'villager',
        camp: 'good' as const,
        isSheriff: false,
        abilities: {},
      };

      expect(getRoleStatusText(player)).toBe('正常');
    });
  });

  describe('守墓人规则验证', () => {
    it('应该只允许验尸被放逐的玩家', () => {
      const game = createGravekeeperTestGame();
      const stats = calculatePlayerStats(game);

      // 找出被放逐的玩家
      const exiledPlayers = stats.filter(p => !p.alive && p.outReason === 'exile');
      expect(exiledPlayers).toHaveLength(1);
      expect(exiledPlayers[0].playerId).toBe(2);

      // 找出被狼刀的玩家
      const killedPlayers = stats.filter(p => !p.alive && p.outReason === 'wolf_kill');
      expect(killedPlayers).toHaveLength(1);
      expect(killedPlayers[0].playerId).toBe(9);

      // 验证守墓人只能看到被放逐的玩家
      const validTargets = stats.filter(p => !p.alive && p.outReason === 'exile');
      expect(validTargets.map(p => p.playerId)).toEqual([2]);
    });
  });
});
