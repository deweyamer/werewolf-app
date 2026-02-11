import { describe, it, expect, beforeEach } from 'vitest';
import { GameFlowEngine } from '../../../game/flow/GameFlowEngine.js';
import { VotingSystem } from '../../../game/VotingSystem.js';
import { createMockGame, createMockPlayer } from '../../helpers/GameTestHelper.js';
import { Game } from '../../../../../shared/src/types.js';

/**
 * GameFlowEngine 单元测试
 *
 * 测试策略：
 * - 构造 mock Game + scriptPhases，注入真实 VotingSystem
 * - SkillResolver 由 GameFlowEngine 内部创建（无需 mock）
 * - 测试阶段推进、夜间/白天结算、胜利判定
 */
describe('GameFlowEngine', () => {
  let engine: GameFlowEngine;
  let votingSystem: VotingSystem;
  let game: Game;

  // Minimal script phases for testing
  const scriptPhases = [
    { id: 'lobby', order: 0, isNightPhase: false, description: '等待开始' },
    { id: 'fear', order: 1, isNightPhase: true, description: '噩梦之影恐惧' },
    { id: 'wolf', order: 2, isNightPhase: true, description: '狼人行动' },
    { id: 'witch', order: 3, isNightPhase: true, description: '女巫行动' },
    { id: 'seer', order: 4, isNightPhase: true, description: '预言家查验' },
    { id: 'settle', order: 5, isNightPhase: false, description: '夜间结算' },
    { id: 'sheriffElection', order: 6, isNightPhase: false, description: '警长竞选' },
    { id: 'discussion', order: 7, isNightPhase: false, description: '讨论发言' },
    { id: 'vote', order: 8, isNightPhase: false, description: '投票阶段' },
    { id: 'daySettle', order: 9, isNightPhase: false, description: '白天结算' },
    { id: 'finished', order: 10, isNightPhase: false, description: '游戏结束' },
  ];

  function createStandardGame(): Game {
    const players = [
      createMockPlayer(1, 'wolf', 'wolf'),
      createMockPlayer(2, 'wolf', 'wolf'),
      createMockPlayer(3, 'wolf', 'wolf'),
      createMockPlayer(4, 'wolf', 'wolf'),
      createMockPlayer(5, 'seer', 'good'),
      createMockPlayer(6, 'witch', 'good'),
      createMockPlayer(7, 'hunter', 'good'),
      createMockPlayer(8, 'guard', 'good'),
      createMockPlayer(9, 'villager', 'good'),
      createMockPlayer(10, 'villager', 'good'),
      createMockPlayer(11, 'villager', 'good'),
      createMockPlayer(12, 'villager', 'good'),
    ];
    return createMockGame({
      players,
      nightActions: {} as any,
      currentRound: 1,
    });
  }

  beforeEach(() => {
    votingSystem = new VotingSystem();
    engine = new GameFlowEngine(votingSystem);
    game = createStandardGame();
  });

  // ─────────────────────────────────────────────
  // advancePhase
  // ─────────────────────────────────────────────
  describe('advancePhase', () => {
    it('应该推进到下一阶段', async () => {
      game.currentPhase = 'wolf';
      const result = await engine.advancePhase(game, scriptPhases);

      expect(result.finished).toBe(false);
      expect(result.phase).toBe('witch');
      expect(game.currentPhase).toBe('witch');
    });

    it('settle 阶段应该结算夜间效果并清空 nightActions', async () => {
      game.currentPhase = 'seer';
      game.nightActions = { wolfKill: 10 } as any;

      const result = await engine.advancePhase(game, scriptPhases);

      // Should advance to settle and process night settlement
      expect(game.nightActions).toEqual({});
      // Player 10 should be dead (wolf kill with no protection)
      const player10 = game.players.find(p => p.playerId === 10);
      expect(player10?.alive).toBe(false);
    });

    it('settle 阶段无狼刀时应该平安夜', async () => {
      game.currentPhase = 'seer';
      game.nightActions = {} as any;

      await engine.advancePhase(game, scriptPhases);

      // All players should still be alive
      expect(game.players.every(p => p.alive)).toBe(true);
    });

    it('第1回合 settle 后应该自动进入警长竞选', async () => {
      game.currentPhase = 'seer';
      game.currentRound = 1;
      game.sheriffElectionDone = false;
      game.nightActions = {} as any;

      const result = await engine.advancePhase(game, scriptPhases);

      expect(result.phase).toBe('sheriffElection');
      expect(game.currentPhase).toBe('sheriffElection');
      expect(game.currentPhaseType).toBe('day');
    });

    it('第1回合 settle 后如果竞选已完成应该跳过警长竞选', async () => {
      game.currentPhase = 'settle';
      game.currentRound = 1;
      game.sheriffElectionDone = true;

      const result = await engine.advancePhase(game, scriptPhases);

      expect(result.phase).toBe('discussion');
      expect(game.currentPhase).toBe('discussion');
    });

    it('到达 finished 阶段时应该进入下一回合', async () => {
      game.currentPhase = 'daySettle';
      game.currentRound = 1;

      const result = await engine.advancePhase(game, scriptPhases);

      // Should wrap to first night phase, incrementing round
      // fear 阶段仅在第1回合执行，第2回合会自动跳过 fear 进入 wolf
      expect(game.currentRound).toBe(2);
      expect(game.currentPhase).toBe('wolf');
      expect(game.currentPhaseType).toBe('night');
    });

    it('无效阶段应该返回错误信息', async () => {
      game.currentPhase = 'nonexistent' as any;
      const result = await engine.advancePhase(game, scriptPhases);

      expect(result.finished).toBe(false);
      expect(result.message).toContain('配置错误');
    });
  });

  // ─────────────────────────────────────────────
  // checkWinner (tested via advancePhase settle)
  // ─────────────────────────────────────────────
  describe('checkWinner (via settle)', () => {
    it('所有狼人死亡 → 好人获胜', async () => {
      game.currentPhase = 'seer';
      game.nightActions = {} as any;

      // Kill all wolves manually
      game.players.forEach(p => {
        if (p.camp === 'wolf') {
          p.alive = false;
          p.outReason = 'wolf_kill';
        }
      });

      const result = await engine.advancePhase(game, scriptPhases);

      expect(result.finished).toBe(true);
      expect(result.winner).toBe('good');
      expect(game.status).toBe('finished');
    });

    it('所有神职死亡（民存活） → 狼人获胜', async () => {
      game.currentPhase = 'seer';
      game.nightActions = {} as any;

      // Kill all god-role players: seer(5), witch(6), hunter(7), guard(8)
      [5, 6, 7, 8].forEach(id => {
        const p = game.players.find(p => p.playerId === id);
        if (p) { p.alive = false; p.outReason = 'wolf_kill'; }
      });

      const result = await engine.advancePhase(game, scriptPhases);

      expect(result.finished).toBe(true);
      expect(result.winner).toBe('wolf');
    });

    it('所有平民死亡（神职存活） → 狼人获胜', async () => {
      game.currentPhase = 'seer';
      game.nightActions = {} as any;

      // Kill all villagers: 9, 10, 11, 12
      [9, 10, 11, 12].forEach(id => {
        const p = game.players.find(p => p.playerId === id);
        if (p) { p.alive = false; p.outReason = 'wolf_kill'; }
      });

      const result = await engine.advancePhase(game, scriptPhases);

      expect(result.finished).toBe(true);
      expect(result.winner).toBe('wolf');
    });

    it('双方都有存活玩家（神民均有存活） → 游戏继续', async () => {
      game.currentPhase = 'seer';
      game.nightActions = {} as any;
      game.sheriffElectionDone = true; // Skip election

      // Kill 1 villager and 1 god — both categories still have survivors
      const villager = game.players.find(p => p.playerId === 9);
      if (villager) { villager.alive = false; villager.outReason = 'wolf_kill'; }
      const seer = game.players.find(p => p.playerId === 5);
      if (seer) { seer.alive = false; seer.outReason = 'wolf_kill'; }

      const result = await engine.advancePhase(game, scriptPhases);

      expect(result.finished).toBe(false);
    });

    it('部分神职死亡但民存活且有神职存活 → 游戏继续', async () => {
      game.currentPhase = 'seer';
      game.nightActions = {} as any;
      game.sheriffElectionDone = true;

      // Kill 3 of 4 god roles, all villagers alive
      [5, 6, 7].forEach(id => {
        const p = game.players.find(p => p.playerId === id);
        if (p) { p.alive = false; p.outReason = 'wolf_kill'; }
      });

      const result = await engine.advancePhase(game, scriptPhases);

      expect(result.finished).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // submitAction
  // ─────────────────────────────────────────────
  describe('submitAction', () => {
    it('死亡玩家不能提交行动', async () => {
      game.players[0].alive = false;

      const result = await engine.submitAction(game, {
        phase: 'wolf',
        playerId: 1,
        actionType: 'action',
        target: 10,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('不存在或已死亡');
    });

    it('被恐惧的玩家不能使用技能', async () => {
      game.players[4].feared = true; // seer (player 5) is feared
      game.currentPhaseType = 'night';

      const result = await engine.submitAction(game, {
        phase: 'seer',
        playerId: 5,
        actionType: 'action',
        target: 1,
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('恐惧');
    });

    it('投票阶段应该走投票系统', async () => {
      game.currentPhase = 'vote';
      game.currentPhaseType = 'day';

      const result = await engine.submitAction(game, {
        phase: 'vote',
        playerId: 5,
        actionType: 'vote',
        target: 1,
      });

      expect(result.success).toBe(true);
      expect(game.exileVote).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────
  // 投票 → daySettle 流程
  // ─────────────────────────────────────────────
  describe('vote → daySettle', () => {
    it('投票放逐应该在白天结算中处理', async () => {
      game.currentPhase = 'vote';
      game.currentPhaseType = 'day';
      game.sheriffElectionDone = true;

      // Set up exile vote
      votingSystem.startExileVote(game);
      // Multiple players vote for player 1 (wolf)
      votingSystem.voteForExile(game, 5, 1);
      votingSystem.voteForExile(game, 6, 1);
      votingSystem.voteForExile(game, 7, 1);
      votingSystem.voteForExile(game, 8, 1);
      votingSystem.voteForExile(game, 9, 1);

      // Advance from vote → daySettle
      const result = await engine.advancePhase(game, scriptPhases);

      // Player 1 should be exiled
      const player1 = game.players.find(p => p.playerId === 1);
      expect(player1?.alive).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // 守卫挡刀测试
  // ─────────────────────────────────────────────
  describe('守卫守护挡狼刀', () => {
    // 包含 guard 阶段的 scriptPhases
    const phasesWithGuard = [
      { id: 'lobby', order: 0, isNightPhase: false, description: '等待开始' },
      { id: 'guard', order: 1, isNightPhase: true, description: '守卫行动' },
      { id: 'wolf', order: 2, isNightPhase: true, description: '狼人行动' },
      { id: 'witch', order: 3, isNightPhase: true, description: '女巫行动' },
      { id: 'seer', order: 4, isNightPhase: true, description: '预言家查验' },
      { id: 'settle', order: 5, isNightPhase: false, description: '夜间结算' },
      { id: 'sheriffElection', order: 6, isNightPhase: false, description: '警长竞选' },
      { id: 'discussion', order: 7, isNightPhase: false, description: '讨论发言' },
      { id: 'vote', order: 8, isNightPhase: false, description: '投票阶段' },
      { id: 'daySettle', order: 9, isNightPhase: false, description: '白天结算' },
      { id: 'finished', order: 10, isNightPhase: false, description: '游戏结束' },
    ];

    it('守卫守护10号 + 狼刀10号 → 10号应该存活', async () => {
      game.currentPhase = 'guard';
      game.currentPhaseType = 'night';

      // 守卫(8号)守护10号
      const guardResult = await engine.submitAction(game, {
        phase: 'guard',
        playerId: 8,
        actionType: 'action',
        target: 10,
      });
      expect(guardResult.success).toBe(true);

      // 推进到狼人阶段
      await engine.advancePhase(game, phasesWithGuard);
      expect(game.currentPhase).toBe('wolf');

      // 狼人(1号)刀10号
      const wolfResult = await engine.submitAction(game, {
        phase: 'wolf',
        playerId: 1,
        actionType: 'action',
        target: 10,
      });
      expect(wolfResult.success).toBe(true);

      // 推进到女巫、预言家阶段
      await engine.advancePhase(game, phasesWithGuard); // wolf → witch
      await engine.advancePhase(game, phasesWithGuard); // witch → seer

      // 推进到 settle，触发夜间结算
      await engine.advancePhase(game, phasesWithGuard); // seer → settle

      // 10号应该存活（被守卫守护，狼刀被挡）
      const player10 = game.players.find(p => p.playerId === 10);
      expect(player10?.alive).toBe(true);
    });

    it('守卫不守护时 + 狼刀10号 → 10号应该死亡', async () => {
      game.currentPhase = 'guard';
      game.currentPhaseType = 'night';

      // 守卫(8号)放弃守护
      const guardResult = await engine.submitAction(game, {
        phase: 'guard',
        playerId: 8,
        actionType: 'skip',
        target: 0,
      });
      expect(guardResult.success).toBe(true);

      // 推进到狼人阶段
      await engine.advancePhase(game, phasesWithGuard);

      // 狼人(1号)刀10号
      await engine.submitAction(game, {
        phase: 'wolf',
        playerId: 1,
        actionType: 'action',
        target: 10,
      });

      // 推进到结算
      await engine.advancePhase(game, phasesWithGuard); // wolf → witch
      await engine.advancePhase(game, phasesWithGuard); // witch → seer
      await engine.advancePhase(game, phasesWithGuard); // seer → settle

      // 10号应该死亡
      const player10 = game.players.find(p => p.playerId === 10);
      expect(player10?.alive).toBe(false);
    });
  });
});
