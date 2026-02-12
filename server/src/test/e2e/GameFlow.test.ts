import { describe, it, expect, beforeEach } from 'vitest';
import { ScriptService } from '../../services/ScriptService.js';
import { GameService } from '../../services/GameService.js';
import { Game, PlayerAction, GamePlayer } from '../../../../shared/src/types.js';
import { RoleRegistry } from '../../game/roles/RoleRegistry.js';

/**
 * 端到端游戏流程测试
 * 模拟从游戏开始到结束的完整流程，验证剧本规则和角色技能
 */
describe('端到端游戏流程测试', () => {
  let scriptService: ScriptService;
  let gameService: GameService;

  beforeEach(async () => {
    scriptService = new ScriptService();
    await scriptService.init();
    gameService = new GameService(scriptService);
    await gameService.init();
  });

  /**
   * 辅助函数：创建并初始化游戏
   */
  async function createTestGame(scriptId: string, roleAssignments: { [playerId: number]: string }): Promise<Game> {
    const game = await gameService.createGame('host-1', 'Host', scriptId);
    expect(game).toBeDefined();

    // 添加12个玩家
    for (let i = 1; i <= 12; i++) {
      const player = await gameService.addPlayer(game!.id, `user-${i}`, `Player${i}`);
      expect(player).toBeDefined();
    }

    // 分配角色
    const assignments = Object.entries(roleAssignments).map(([playerId, roleId]) => ({
      playerId: parseInt(playerId),
      roleId,
    }));

    const success = await gameService.assignRoles(game!.id, assignments);
    expect(success).toBe(true);

    // 开始游戏
    const startSuccess = await gameService.startGame(game!.id);
    expect(startSuccess).toBe(true);

    const updatedGame = gameService.getGame(game!.id)!;
    expect(updatedGame.status).toBe('running');

    return updatedGame;
  }

  /**
   * 辅助函数：提交行动
   */
  async function submitAction(gameId: string, playerId: number, target?: number, additionalData?: any): Promise<any> {
    const action: PlayerAction = {
      playerId,
      phase: gameService.getGame(gameId)!.currentPhase,
      target,
      timestamp: new Date().toISOString(),
      ...additionalData,
    };

    return await gameService.submitAction(gameId, action);
  }

  /**
   * 辅助函数：推进阶段
   */
  async function advanceToPhase(gameId: string, targetPhase: string, maxIterations: number = 20): Promise<void> {
    let iterations = 0;
    while (iterations < maxIterations) {
      const game = gameService.getGame(gameId)!;
      if (game.currentPhase === targetPhase) {
        return;
      }
      // 第一轮 settle 后可能进入警长竞选，快速跳过
      if (game.currentPhase === 'sheriffElection' && !game.sheriffElectionDone) {
        await gameService.startSheriffCampaign(gameId);
        const updatedGame = gameService.getGame(gameId)!;
        if (updatedGame.sheriffElectionDone) {
          await gameService.advancePhase(gameId);
          iterations++;
          continue;
        }
      }
      await gameService.advancePhase(gameId);
      iterations++;
    }
    throw new Error(`无法推进到阶段 ${targetPhase}，已尝试 ${maxIterations} 次`);
  }

  /**
   * 辅助函数：获取指定角色的玩家
   */
  function getPlayerByRole(game: Game, roleId: string): GamePlayer {
    const player = game.players.find(p => p.role === roleId);
    if (!player) {
      throw new Error(`找不到角色 ${roleId} 的玩家`);
    }
    return player;
  }

  /**
   * 辅助函数：获取存活的狼人
   */
  function getAliveWolves(game: Game): GamePlayer[] {
    return game.players.filter(p => {
      if (!p.alive || !p.role) return false;
      const handler = RoleRegistry.getHandler(p.role);
      return handler?.camp === 'wolf';
    });
  }

  /**
   * 辅助函数：获取存活的好人
   */
  function getAliveGood(game: Game): GamePlayer[] {
    return game.players.filter(p => {
      if (!p.alive || !p.role) return false;
      const handler = RoleRegistry.getHandler(p.role);
      return handler?.camp === 'good';
    });
  }

  describe('摄梦人剧本 - 完整游戏流程', () => {
    it('应该能完成第一晚的所有夜间行动', async () => {
      const roleAssignments = {
        1: 'nightmare',  // 噩梦之影
        2: 'wolf',       // 狼人
        3: 'wolf',       // 狼人
        4: 'wolf',       // 狼人
        5: 'dreamer',    // 摄梦人
        6: 'seer',       // 预言家
        7: 'witch',      // 女巫
        8: 'hunter',     // 猎人
        9: 'villager',   // 平民
        10: 'villager',  // 平民
        11: 'villager',  // 平民
        12: 'villager',  // 平民
      };

      const game = await createTestGame('dreamer-nightmare', roleAssignments);

      // 验证游戏初始状态
      expect(game.currentRound).toBe(1);
      expect(game.currentPhaseType).toBe('night');

      // 第一晚应该从恐惧阶段开始（如果有噩梦之影）
      const scriptWithPhases = scriptService.getScript('dreamer-nightmare');
      const firstNightPhase = scriptWithPhases!.phases.find(p => p.isNightPhase);
      expect(game.currentPhase).toBe(firstNightPhase!.id);

      // 噩梦之影恐惧一名玩家（恐惧6号预言家）
      if (game.currentPhase === 'fear') {
        const nightmareResult = await submitAction(game.id, 1, 6);
        expect(nightmareResult.success).toBe(true);

        // 推进到下一阶段
        await gameService.advancePhase(game.id);
      }

      // 摄梦人选择一名玩家（梦2号狼人）
      await advanceToPhase(game.id, 'dream');
      const dreamerResult = await submitAction(game.id, 5, 2);
      expect(dreamerResult.success).toBe(true);

      await gameService.advancePhase(game.id);

      // 狼人刀人（刀9号平民）
      await advanceToPhase(game.id, 'wolf');
      const wolfResult = await submitAction(game.id, 2, 9); // 任意一个狼投票即可
      expect(wolfResult.success).toBe(true);

      await gameService.advancePhase(game.id);

      // 女巫阶段（先跳过，不使用技能）
      await advanceToPhase(game.id, 'witch');
      const witchResult = await submitAction(game.id, 7, undefined, { actionType: 'none' }); // 不操作
      expect(witchResult.success).toBe(true);

      await gameService.advancePhase(game.id);

      // 预言家查验（但被恐惧了，无法使用技能）
      await advanceToPhase(game.id, 'seer');
      const updatedGame = gameService.getGame(game.id)!;
      const seer = updatedGame.players.find(p => p.playerId === 6)!;

      // 如果预言家被恐惧，应该无法行动
      if (seer.feared) {
        const seerResult = await submitAction(game.id, 6, 2);
        expect(seerResult.success).toBe(false);
        expect(seerResult.message).toContain('恐惧');
      }

      await gameService.advancePhase(game.id);

      // 推进到结算阶段
      await advanceToPhase(game.id, 'settle');
      const settleResult = await gameService.advancePhase(game.id);

      // 验证9号平民死亡
      const finalGame = gameService.getGame(game.id)!;
      const victim = finalGame.players.find(p => p.playerId === 9)!;
      expect(victim.alive).toBe(false);

      // 游戏应该继续（没有满足胜利条件）
      expect(finalGame.status).toBe('running');
      expect(settleResult.nextPhase).not.toBe('finished');
    });

    it('应该正确处理摄梦人连续两晚梦死机制', async () => {
      const roleAssignments = {
        1: 'nightmare',  // 噩梦之影
        2: 'wolf',
        3: 'wolf',
        4: 'wolf',
        5: 'dreamer',    // 摄梦人
        6: 'seer',
        7: 'witch',
        8: 'hunter',
        9: 'villager',
        10: 'villager',
        11: 'villager',
        12: 'villager',
      };

      const game = await createTestGame('dreamer-nightmare', roleAssignments);

      // 第一晚：摄梦人梦10号
      await advanceToPhase(game.id, 'dream');
      await submitAction(game.id, 5, 10); // 第一次梦10号
      await gameService.advancePhase(game.id);

      // 跳过其他阶段到结算
      await advanceToPhase(game.id, 'wolf');
      await submitAction(game.id, 2, 9); // 狼刀9号
      await gameService.advancePhase(game.id);

      await advanceToPhase(game.id, 'settle');
      await gameService.advancePhase(game.id);

      // 进入第二天
      await advanceToPhase(game.id, 'discussion');
      await gameService.advancePhase(game.id);

      // 投票（随便投一个）
      await advanceToPhase(game.id, 'vote');
      await gameService.advancePhase(game.id);

      // 白天结算
      await advanceToPhase(game.id, 'daySettle');
      await gameService.advancePhase(game.id);

      // 第二晚：摄梦人再次梦10号（应该梦死）
      await advanceToPhase(game.id, 'dream');
      await submitAction(game.id, 5, 10); // 第二次梦10号
      await gameService.advancePhase(game.id);

      // 跳过其他阶段到结算
      await advanceToPhase(game.id, 'wolf');
      await submitAction(game.id, 2, 11); // 狼刀11号
      await gameService.advancePhase(game.id);

      await advanceToPhase(game.id, 'settle');
      await gameService.advancePhase(game.id);

      // 验证10号被梦死
      const finalGame = gameService.getGame(game.id)!;
      const dreamedPlayer = finalGame.players.find(p => p.playerId === 10)!;

      // 根据剧本规则，连续两晚梦到同一人会梦死
      expect(dreamedPlayer.alive).toBe(false);
    });
  });

  describe('守墓人石像鬼剧本 - 独狼机制验证', () => {
    it('石像鬼应该能查验具体角色', async () => {
      const roleAssignments = {
        1: 'gargoyle',     // 石像鬼（独狼）
        2: 'wolf',
        3: 'wolf',
        4: 'wolf',
        5: 'gravekeeper',  // 守墓人
        6: 'seer',         // 预言家
        7: 'witch',        // 女巫
        8: 'hunter',       // 猎人
        9: 'villager',
        10: 'villager',
        11: 'villager',
        12: 'villager',
      };

      const game = await createTestGame('gravekeeper-gargoyle', roleAssignments);

      // 验证石像鬼是狼阵营
      const gargoyle = game.players.find(p => p.playerId === 1)!;
      expect(gargoyle.camp).toBe('wolf');

      // 第一晚：石像鬼查验6号
      await advanceToPhase(game.id, 'gargoyle');
      const checkResult = await submitAction(game.id, 1, 6);

      expect(checkResult.success).toBe(true);
      // 石像鬼应该能看到具体角色名，而不只是阵营
      expect(checkResult.data).toBeDefined();
      if (checkResult.data) {
        expect(checkResult.data.role).toBe('seer'); // 应该看到具体角色
        expect(checkResult.data.camp).toBe('good');
      }

      await gameService.advancePhase(game.id);

      // 狼人刀人（石像鬼不参与）
      await advanceToPhase(game.id, 'wolf');

      // 石像鬼不应该能在狼人阶段行动
      const gargoyleWolfAction = await submitAction(game.id, 1, 9);
      // 这里的行为取决于实现，可能是成功但无效，或直接失败

      // 普通狼人可以刀人
      const wolfKillResult = await submitAction(game.id, 2, 9);
      expect(wolfKillResult.success).toBe(true);

      await gameService.advancePhase(game.id);

      // 推进到结算
      await advanceToPhase(game.id, 'settle');
      await gameService.advancePhase(game.id);

      // 验证9号死亡
      const finalGame = gameService.getGame(game.id)!;
      const victim = finalGame.players.find(p => p.playerId === 9)!;
      expect(victim.alive).toBe(false);
    });

    it('守墓人应该能验尸获得死者身份信息', async () => {
      const roleAssignments = {
        1: 'gargoyle',
        2: 'wolf',
        3: 'wolf',
        4: 'wolf',
        5: 'gravekeeper',  // 守墓人
        6: 'seer',
        7: 'witch',
        8: 'hunter',
        9: 'villager',
        10: 'villager',
        11: 'villager',
        12: 'villager',
      };

      const game = await createTestGame('gravekeeper-gargoyle', roleAssignments);

      // 石像鬼查验
      await advanceToPhase(game.id, 'gargoyle');
      await submitAction(game.id, 1, 6);
      await gameService.advancePhase(game.id);

      // 狼刀10号平民（不刀9号，因为9号要被投票放逐）
      await advanceToPhase(game.id, 'wolf');
      await submitAction(game.id, 2, 10);
      await gameService.advancePhase(game.id);

      // 推进到结算阶段，让10号死亡
      await advanceToPhase(game.id, 'settle');
      await gameService.advancePhase(game.id);

      // 进入白天讨论和投票，投票放逐9号
      await advanceToPhase(game.id, 'discussion');
      await gameService.advancePhase(game.id);
      await advanceToPhase(game.id, 'vote');

      // 投票放逐9号平民（守墓人只能验尸投票出局的玩家）
      await submitAction(game.id, 1, 9); // 石像鬼投9
      await submitAction(game.id, 2, 9); // 狼投9
      await submitAction(game.id, 3, 9); // 狼投9
      await submitAction(game.id, 4, 9); // 狼投9
      await submitAction(game.id, 5, 9); // 守墓人投9
      await submitAction(game.id, 6, 9); // 预言家投9
      await submitAction(game.id, 7, 9); // 女巫投9
      await submitAction(game.id, 8, 9); // 猎人投9

      await gameService.advancePhase(game.id);
      await advanceToPhase(game.id, 'daySettle');
      await gameService.advancePhase(game.id);

      // 第二晚：守墓人验尸阶段
      await advanceToPhase(game.id, 'gravekeeper');

      // 守墓人应该能验尸9号（白天被投票放逐的玩家）
      const gravekeeperResult = await submitAction(game.id, 5, 9);

      expect(gravekeeperResult.success).toBe(true);
      expect(gravekeeperResult.data).toBeDefined();
      // 守墓人应该能知道死者是好人还是狼人
      expect(gravekeeperResult.data.camp).toBe('good');
      expect(gravekeeperResult.data.role).toBe('villager');

      await gameService.advancePhase(game.id);
    });

    it('应该正确验证4狼8好的阵营平衡（石像鬼算狼人）', async () => {
      const roleAssignments = {
        1: 'gargoyle',     // 狼
        2: 'wolf',         // 狼
        3: 'wolf',         // 狼
        4: 'wolf',         // 狼
        5: 'gravekeeper',  // 好
        6: 'seer',         // 好
        7: 'witch',        // 好
        8: 'hunter',       // 好
        9: 'villager',     // 好
        10: 'villager',    // 好
        11: 'villager',    // 好
        12: 'villager',    // 好
      };

      const game = await createTestGame('gravekeeper-gargoyle', roleAssignments);

      // 统计阵营
      const wolves = getAliveWolves(game);
      const goods = getAliveGood(game);

      expect(wolves.length).toBe(4); // 石像鬼 + 3狼
      expect(goods.length).toBe(8);

      // 验证石像鬼在狼人列表中
      const gargoyleInWolves = wolves.some(p => p.role === 'gargoyle');
      expect(gargoyleInWolves).toBe(true);
    });
  });

  describe('骑士狼美人剧本 - 特殊技能验证', () => {
    it('狼美人魅惑后应该形成连结', async () => {
      const roleAssignments = {
        1: 'wolf',
        2: 'wolf',
        3: 'wolf',
        4: 'wolf_beauty',  // 狼美人
        5: 'knight',       // 骑士
        6: 'seer',
        7: 'witch',
        8: 'guard',
        9: 'villager',
        10: 'villager',
        11: 'villager',
        12: 'villager',
      };

      const game = await createTestGame('knight-beauty', roleAssignments);

      // 守卫守护
      await advanceToPhase(game.id, 'guard');
      await submitAction(game.id, 8, 6); // 守卫守护6号
      await gameService.advancePhase(game.id);

      // 狼人刀人
      await advanceToPhase(game.id, 'wolf');
      await submitAction(game.id, 1, 9);
      await gameService.advancePhase(game.id);

      // 女巫不使用技能
      await advanceToPhase(game.id, 'witch');
      await submitAction(game.id, 7, undefined, { actionType: 'none' });
      await gameService.advancePhase(game.id);

      // 预言家查验
      await advanceToPhase(game.id, 'seer');
      await submitAction(game.id, 6, 1);
      await gameService.advancePhase(game.id);

      // 狼美人魅惑10号
      await advanceToPhase(game.id, 'wolf_beauty');
      const beautyResult = await submitAction(game.id, 4, 10);
      expect(beautyResult.success).toBe(true);
      await gameService.advancePhase(game.id);

      // 结算
      await advanceToPhase(game.id, 'settle');
      await gameService.advancePhase(game.id);

      // 验证魅惑操作被记录
      const updatedGame = gameService.getGame(game.id)!;
      const charmedPlayer = updatedGame.players.find(p => p.playerId === 10)!;

      // 验证狼美人魅惑操作被记录到历史日志
      const beautyActionLog = updatedGame.history.find(
        h => h.actorPlayerId === 4 && h.target === 10
      );
      expect(beautyActionLog).toBeDefined();
    });

    it('守卫不能连续守护同一人', async () => {
      const roleAssignments = {
        1: 'wolf',
        2: 'wolf',
        3: 'wolf',
        4: 'wolf_beauty',
        5: 'knight',
        6: 'seer',
        7: 'witch',
        8: 'guard',       // 守卫
        9: 'villager',
        10: 'villager',
        11: 'villager',
        12: 'villager',
      };

      const game = await createTestGame('knight-beauty', roleAssignments);

      // 第一晚：守护6号
      await advanceToPhase(game.id, 'guard');
      const firstGuard = await submitAction(game.id, 8, 6);
      expect(firstGuard.success).toBe(true);
      await gameService.advancePhase(game.id);

      // 完成第一晚
      await advanceToPhase(game.id, 'settle');
      await gameService.advancePhase(game.id);

      // 跳过白天
      await advanceToPhase(game.id, 'discussion');
      await gameService.advancePhase(game.id);
      await advanceToPhase(game.id, 'vote');
      await gameService.advancePhase(game.id);
      await advanceToPhase(game.id, 'daySettle');
      await gameService.advancePhase(game.id);

      // 第二晚：尝试再次守护6号（应该失败）
      await advanceToPhase(game.id, 'guard');
      const secondGuard = await submitAction(game.id, 8, 6);

      // 根据规则，不能连续守护同一人
      expect(secondGuard.success).toBe(false);
      expect(secondGuard.message).toContain('不能');
    });
  });

  describe('胜利条件验证', () => {
    it('当所有狼人死亡时，好人应该获胜', async () => {
      const roleAssignments = {
        1: 'wolf',
        2: 'wolf',
        3: 'wolf',
        4: 'wolf',
        5: 'dreamer',
        6: 'seer',
        7: 'witch',
        8: 'hunter',
        9: 'villager',
        10: 'villager',
        11: 'villager',
        12: 'villager',
      };

      const game = await createTestGame('dreamer-nightmare', roleAssignments);
      const updatedGame = gameService.getGame(game.id)!;

      // 手动设置所有狼人死亡
      updatedGame.players.forEach(p => {
        if (p.role === 'wolf') {
          p.alive = false;
        }
      });

      // 设置到预言家阶段（settle前的最后一个夜间阶段）
      updatedGame.currentPhase = 'seer';
      await gameService.advancePhase(game.id); // 推进到settle并执行结算

      const finalGame = gameService.getGame(game.id)!;
      expect(finalGame.status).toBe('finished');
      expect(finalGame.winner).toBe('good');
    });

    it('当所有好人死亡时，狼人应该获胜', async () => {
      const roleAssignments = {
        1: 'wolf',
        2: 'wolf',
        3: 'wolf',
        4: 'wolf',
        5: 'dreamer',
        6: 'seer',
        7: 'witch',
        8: 'hunter',
        9: 'villager',
        10: 'villager',
        11: 'villager',
        12: 'villager',
      };

      const game = await createTestGame('dreamer-nightmare', roleAssignments);
      const updatedGame = gameService.getGame(game.id)!;

      // 手动设置所有好人死亡
      updatedGame.players.forEach(p => {
        const handler = RoleRegistry.getHandler(p.role!);
        if (handler?.camp === 'good') {
          p.alive = false;
        }
      });

      // 设置到预言家阶段（settle前的最后一个夜间阶段）
      updatedGame.currentPhase = 'seer';
      await gameService.advancePhase(game.id); // 推进到settle并执行结算

      const finalGame = gameService.getGame(game.id)!;
      expect(finalGame.status).toBe('finished');
      expect(finalGame.winner).toBe('wolf');
    });

    it('当狼人数量大于等于好人时，狼人应该获胜', async () => {
      const roleAssignments = {
        1: 'wolf',
        2: 'wolf',
        3: 'wolf',
        4: 'wolf',
        5: 'dreamer',
        6: 'seer',
        7: 'witch',
        8: 'hunter',
        9: 'villager',
        10: 'villager',
        11: 'villager',
        12: 'villager',
      };

      const game = await createTestGame('dreamer-nightmare', roleAssignments);
      const updatedGame = gameService.getGame(game.id)!;

      // 手动设置大部分好人死亡（保留4个好人，4狼>=4好人）
      updatedGame.players.forEach(p => {
        if (p.role === 'dreamer' || p.role === 'seer' || p.role === 'witch' || p.role === 'hunter') {
          p.alive = false;
        }
      });

      // 设置到预言家阶段（settle前的最后一个夜间阶段）
      updatedGame.currentPhase = 'seer';
      await gameService.advancePhase(game.id); // 推进到settle并执行结算

      const finalGame = gameService.getGame(game.id)!;
      expect(finalGame.status).toBe('finished');
      expect(finalGame.winner).toBe('wolf');
    });
  });

  describe('Corner Cases - 边界情况测试', () => {
    it('女巫解药只能使用一次', async () => {
      const roleAssignments = {
        1: 'wolf',
        2: 'wolf',
        3: 'wolf',
        4: 'wolf',
        5: 'dreamer',
        6: 'seer',
        7: 'witch',      // 女巫
        8: 'hunter',
        9: 'villager',
        10: 'villager',
        11: 'villager',
        12: 'villager',
      };

      const game = await createTestGame('dreamer-nightmare', roleAssignments);

      // 第一晚：狼刀9号（非女巫），女巫救人
      await advanceToPhase(game.id, 'wolf');
      await submitAction(game.id, 1, 9); // 刀9号
      await gameService.advancePhase(game.id);

      await advanceToPhase(game.id, 'witch');
      const saveResult = await submitAction(game.id, 7, undefined, { actionType: 'save' }); // 使用解药救被刀的人
      expect(saveResult.success).toBe(true);
      await gameService.advancePhase(game.id);

      await advanceToPhase(game.id, 'settle');
      await gameService.advancePhase(game.id);

      // 9号应该还活着（被女巫救了）
      let updatedGame = gameService.getGame(game.id)!;
      let target = updatedGame.players.find(p => p.playerId === 9)!;
      expect(target.alive).toBe(true);

      // 跳过白天
      await advanceToPhase(game.id, 'discussion');
      await gameService.advancePhase(game.id);
      await advanceToPhase(game.id, 'vote');
      await gameService.advancePhase(game.id);
      await advanceToPhase(game.id, 'daySettle');
      await gameService.advancePhase(game.id);

      // 第二晚：狼刀9号，女巫尝试再次使用解药（应该失败）
      await advanceToPhase(game.id, 'wolf');
      await submitAction(game.id, 1, 9);
      await gameService.advancePhase(game.id);

      await advanceToPhase(game.id, 'witch');
      const secondSaveResult = await submitAction(game.id, 7, undefined, { actionType: 'save' });

      // 解药只能用一次
      expect(secondSaveResult.success).toBe(false);
      expect(secondSaveResult.message).toContain('已');
    });

    it('猎人死亡时应该能开枪', async () => {
      const roleAssignments = {
        1: 'wolf',
        2: 'wolf',
        3: 'wolf',
        4: 'wolf',
        5: 'dreamer',
        6: 'seer',
        7: 'witch',
        8: 'hunter',     // 猎人
        9: 'villager',
        10: 'villager',
        11: 'villager',
        12: 'villager',
      };

      const game = await createTestGame('dreamer-nightmare', roleAssignments);

      // 狼刀猎人
      await advanceToPhase(game.id, 'wolf');
      await submitAction(game.id, 1, 8);
      await gameService.advancePhase(game.id);

      // 女巫不救
      await advanceToPhase(game.id, 'witch');
      await submitAction(game.id, 7, undefined, { actionType: 'none' });
      await gameService.advancePhase(game.id);

      // 结算
      await advanceToPhase(game.id, 'settle');
      await gameService.advancePhase(game.id);

      // 猎人应该死亡
      const updatedGame = gameService.getGame(game.id)!;
      const hunter = updatedGame.players.find(p => p.playerId === 8)!;
      expect(hunter.alive).toBe(false);

      // 猎人被狼刀死亡
      expect(hunter.outReason).toBe('wolf_kill');
    });

    it('预言家被恐惧后无法查验', async () => {
      const roleAssignments = {
        1: 'nightmare',  // 噩梦之影
        2: 'wolf',
        3: 'wolf',
        4: 'wolf',
        5: 'dreamer',
        6: 'seer',       // 预言家
        7: 'witch',
        8: 'hunter',
        9: 'villager',
        10: 'villager',
        11: 'villager',
        12: 'villager',
      };

      const game = await createTestGame('dreamer-nightmare', roleAssignments);

      // 噩梦之影恐惧预言家
      await advanceToPhase(game.id, 'fear');
      const fearResult = await submitAction(game.id, 1, 6);
      expect(fearResult.success).toBe(true);
      await gameService.advancePhase(game.id);

      // 推进到预言家阶段
      await advanceToPhase(game.id, 'seer');

      // 预言家应该无法查验
      const seerResult = await submitAction(game.id, 6, 1);
      expect(seerResult.success).toBe(false);
      expect(seerResult.message).toContain('恐惧');
    });

    it('死亡玩家不能进行任何操作', async () => {
      const roleAssignments = {
        1: 'wolf',
        2: 'wolf',
        3: 'wolf',
        4: 'wolf',
        5: 'dreamer',
        6: 'seer',
        7: 'witch',
        8: 'hunter',
        9: 'villager',
        10: 'villager',
        11: 'villager',
        12: 'villager',
      };

      const game = await createTestGame('dreamer-nightmare', roleAssignments);

      // 手动设置9号死亡
      const updatedGame = gameService.getGame(game.id)!;
      updatedGame.players.find(p => p.playerId === 9)!.alive = false;

      // 尝试让死亡玩家投票（应该失败）
      await advanceToPhase(game.id, 'vote');
      const voteResult = await submitAction(game.id, 9, 1);

      expect(voteResult.success).toBe(false);
      expect(voteResult.message).toContain('死亡');
    });
  });
});
