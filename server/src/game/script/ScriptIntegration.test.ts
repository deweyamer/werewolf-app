import { describe, it, expect, beforeEach } from 'vitest';
import { ScriptPresets } from './ScriptPresets.js';
import { ScriptService } from '../../services/ScriptService.js';
import { GameService } from '../../services/GameService.js';
import { Game } from '../../../../shared/src/types.js';
import { RoleRegistry } from '../roles/RoleRegistry.js';

/**
 * 剧本集成测试
 * 测试从创建游戏、分配角色到游戏结束的完整流程
 */
describe('剧本集成测试', () => {
  let scriptService: ScriptService;
  let gameService: GameService;

  beforeEach(async () => {
    scriptService = new ScriptService();
    await scriptService.init();
    gameService = new GameService(scriptService);
    await gameService.init();
  });

  /**
   * 辅助函数：创建游戏并添加玩家
   */
  async function setupGame(scriptId: string, playerCount: number): Promise<Game> {
    const game = await gameService.createGame('host-1', 'Host', scriptId);
    expect(game).toBeDefined();

    // 添加所有玩家（包括主机）
    for (let i = 1; i <= playerCount; i++) {
      const player = await gameService.addPlayer(game!.id, `user-${i}`, `Player${i}`);
      expect(player).toBeDefined();
    }

    const updatedGame = gameService.getGame(game!.id);
    expect(updatedGame).toBeDefined();
    expect(updatedGame!.players.length).toBe(playerCount);

    return updatedGame!;
  }

  /**
   * 辅助函数：根据剧本配置随机分配角色
   */
  async function assignRolesFromScript(game: Game): Promise<void> {
    const scriptWithPhases = scriptService.getScript(game.scriptId);
    expect(scriptWithPhases).toBeDefined();

    const { script } = scriptWithPhases!;

    // 构建角色池
    const rolePool: string[] = [];
    for (const [roleId, count] of Object.entries(script.roleComposition)) {
      for (let i = 0; i < count; i++) {
        rolePool.push(roleId);
      }
    }

    // Fisher-Yates 洗牌算法
    for (let i = rolePool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rolePool[i], rolePool[j]] = [rolePool[j], rolePool[i]];
    }

    // 分配角色
    const assignments = game.players.map((player, index) => ({
      playerId: player.playerId,
      roleId: rolePool[index],
    }));

    const success = await gameService.assignRoles(game.id, assignments);
    expect(success).toBe(true);
  }

  /**
   * 辅助函数：验证角色分配是否符合剧本要求
   */
  function validateRoleAssignments(game: Game): void {
    const scriptWithPhases = scriptService.getScript(game.scriptId);
    expect(scriptWithPhases).toBeDefined();

    const { script } = scriptWithPhases!;

    // 统计实际分配的角色
    const actualComposition: { [roleId: string]: number } = {};
    for (const player of game.players) {
      if (!player.role) {
        throw new Error(`Player ${player.playerId} has no role assigned`);
      }
      actualComposition[player.role] = (actualComposition[player.role] || 0) + 1;
    }

    // 验证角色数量匹配
    for (const [roleId, expectedCount] of Object.entries(script.roleComposition)) {
      expect(actualComposition[roleId]).toBe(expectedCount);
    }

    // 验证阵营平衡
    let wolfCount = 0;
    let goodCount = 0;

    for (const player of game.players) {
      const handler = RoleRegistry.getHandler(player.role!);
      if (handler?.camp === 'wolf') {
        wolfCount++;
      } else if (handler?.camp === 'good') {
        goodCount++;
      }
    }

    expect(wolfCount).toBe(4);
    expect(goodCount).toBe(8);
  }

  /**
   * 辅助函数：验证游戏初始状态
   */
  function validateInitialGameState(game: Game): void {
    expect(game.status).toBe('waiting');
    expect(game.currentPhase).toBe('lobby');
    expect(game.players.length).toBe(12);

    // 所有玩家应该活着
    for (const player of game.players) {
      expect(player.alive).toBe(true);
      expect(player.role).toBeDefined();
      expect(player.camp).toBeDefined();
    }
  }

  describe('摄梦人剧本集成测试', () => {
    it('应该能创建游戏并正确分配角色', async () => {
      const game = await setupGame('dreamer-nightmare', 12);
      await assignRolesFromScript(game);

      const updatedGame = gameService.getGame(game.id);
      expect(updatedGame).toBeDefined();

      validateRoleAssignments(updatedGame!);
      validateInitialGameState(updatedGame!);
    });

    it('应该包含摄梦人和噩梦之影', async () => {
      const game = await setupGame('dreamer-nightmare', 12);
      await assignRolesFromScript(game);

      const updatedGame = gameService.getGame(game.id)!;

      const dreamer = updatedGame.players.find(p => p.role === 'dreamer');
      const nightmare = updatedGame.players.find(p => p.role === 'nightmare');

      expect(dreamer).toBeDefined();
      expect(nightmare).toBeDefined();
      expect(dreamer?.camp).toBe('good');
      expect(nightmare?.camp).toBe('wolf');
    });

    it('应该有正确的角色数量', async () => {
      const game = await setupGame('dreamer-nightmare', 12);
      await assignRolesFromScript(game);

      const updatedGame = gameService.getGame(game.id)!;

      const roleCount = {
        nightmare: 0,
        wolf: 0,
        dreamer: 0,
        seer: 0,
        witch: 0,
        hunter: 0,
        villager: 0,
      };

      for (const player of updatedGame.players) {
        if (player.role && player.role in roleCount) {
          roleCount[player.role as keyof typeof roleCount]++;
        }
      }

      expect(roleCount.nightmare).toBe(1);
      expect(roleCount.wolf).toBe(3);
      expect(roleCount.dreamer).toBe(1);
      expect(roleCount.seer).toBe(1);
      expect(roleCount.witch).toBe(1);
      expect(roleCount.hunter).toBe(1);
      expect(roleCount.villager).toBe(4);
    });
  });

  describe('骑士狼美人剧本集成测试', () => {
    it('应该能创建游戏并正确分配角色', async () => {
      const game = await setupGame('knight-beauty', 12);
      await assignRolesFromScript(game);

      const updatedGame = gameService.getGame(game.id);
      expect(updatedGame).toBeDefined();

      validateRoleAssignments(updatedGame!);
      validateInitialGameState(updatedGame!);
    });

    it('应该包含骑士和狼美人', async () => {
      const game = await setupGame('knight-beauty', 12);
      await assignRolesFromScript(game);

      const updatedGame = gameService.getGame(game.id)!;

      const knight = updatedGame.players.find(p => p.role === 'knight');
      const wolfBeauty = updatedGame.players.find(p => p.role === 'wolf_beauty');

      expect(knight).toBeDefined();
      expect(wolfBeauty).toBeDefined();
      expect(knight?.camp).toBe('good');
      expect(wolfBeauty?.camp).toBe('wolf');
    });

    it('应该有正确的角色数量', async () => {
      const game = await setupGame('knight-beauty', 12);
      await assignRolesFromScript(game);

      const updatedGame = gameService.getGame(game.id)!;

      const roleCount = {
        wolf: 0,
        wolf_beauty: 0,
        knight: 0,
        seer: 0,
        witch: 0,
        guard: 0,
        villager: 0,
      };

      for (const player of updatedGame.players) {
        if (player.role && player.role in roleCount) {
          roleCount[player.role as keyof typeof roleCount]++;
        }
      }

      expect(roleCount.wolf).toBe(3);
      expect(roleCount.wolf_beauty).toBe(1);
      expect(roleCount.knight).toBe(1);
      expect(roleCount.seer).toBe(1);
      expect(roleCount.witch).toBe(1);
      expect(roleCount.guard).toBe(1);
      expect(roleCount.villager).toBe(4);
    });
  });

  describe('守墓人石像鬼剧本集成测试', () => {
    it('应该能创建游戏并正确分配角色', async () => {
      const game = await setupGame('gravekeeper-gargoyle', 12);
      await assignRolesFromScript(game);

      const updatedGame = gameService.getGame(game.id);
      expect(updatedGame).toBeDefined();

      validateRoleAssignments(updatedGame!);
      validateInitialGameState(updatedGame!);
    });

    it('应该包含守墓人和石像鬼', async () => {
      const game = await setupGame('gravekeeper-gargoyle', 12);
      await assignRolesFromScript(game);

      const updatedGame = gameService.getGame(game.id)!;

      const gravekeeper = updatedGame.players.find(p => p.role === 'gravekeeper');
      const gargoyle = updatedGame.players.find(p => p.role === 'gargoyle');

      expect(gravekeeper).toBeDefined();
      expect(gargoyle).toBeDefined();
      expect(gravekeeper?.camp).toBe('good');
      expect(gargoyle?.camp).toBe('wolf');
    });

    it('石像鬼应该是狼阵营', async () => {
      const game = await setupGame('gravekeeper-gargoyle', 12);
      await assignRolesFromScript(game);

      const updatedGame = gameService.getGame(game.id)!;
      const gargoyle = updatedGame.players.find(p => p.role === 'gargoyle');

      expect(gargoyle?.camp).toBe('wolf');

      // 验证石像鬼被正确计入狼人数量
      const wolfPlayers = updatedGame.players.filter(p => {
        const handler = RoleRegistry.getHandler(p.role!);
        return handler?.camp === 'wolf';
      });

      expect(wolfPlayers.length).toBe(4);
      expect(wolfPlayers.some(p => p.role === 'gargoyle')).toBe(true);
    });

    it('应该有正确的角色数量', async () => {
      const game = await setupGame('gravekeeper-gargoyle', 12);
      await assignRolesFromScript(game);

      const updatedGame = gameService.getGame(game.id)!;

      const roleCount = {
        wolf: 0,
        gargoyle: 0,
        gravekeeper: 0,
        seer: 0,
        witch: 0,
        hunter: 0,
        villager: 0,
      };

      for (const player of updatedGame.players) {
        if (player.role && player.role in roleCount) {
          roleCount[player.role as keyof typeof roleCount]++;
        }
      }

      expect(roleCount.wolf).toBe(3);
      expect(roleCount.gargoyle).toBe(1);
      expect(roleCount.gravekeeper).toBe(1);
      expect(roleCount.seer).toBe(1);
      expect(roleCount.witch).toBe(1);
      expect(roleCount.hunter).toBe(1);
      expect(roleCount.villager).toBe(4);
    });
  });

  describe('所有剧本通用集成测试', () => {
    const allScripts = [
      { id: 'dreamer-nightmare', name: '摄梦人剧本' },
      { id: 'knight-beauty', name: '骑士狼美人剧本' },
      { id: 'gravekeeper-gargoyle', name: '守墓人石像鬼剧本' },
    ];

    allScripts.forEach(({ id, name }) => {
      it(`${name} - 应该能开始游戏`, async () => {
        const game = await setupGame(id, 12);
        await assignRolesFromScript(game);

        const success = await gameService.startGame(game.id);
        expect(success).toBe(true);

        const updatedGame = gameService.getGame(game.id)!;
        expect(updatedGame.status).toBe('running');
      });

      it(`${name} - 多次随机分配都应该满足要求`, async () => {
        // 测试10次随机分配
        for (let i = 0; i < 10; i++) {
          const game = await setupGame(id, 12);
          await assignRolesFromScript(game);

          const updatedGame = gameService.getGame(game.id)!;
          validateRoleAssignments(updatedGame);
          validateInitialGameState(updatedGame);
        }
      });

      it(`${name} - 每个玩家应该有唯一的playerId`, async () => {
        const game = await setupGame(id, 12);
        await assignRolesFromScript(game);

        const updatedGame = gameService.getGame(game.id)!;
        const playerIds = new Set(updatedGame.players.map(p => p.playerId));
        expect(playerIds.size).toBe(12);
      });

      it(`${name} - 所有玩家应该有角色和阵营`, async () => {
        const game = await setupGame(id, 12);
        await assignRolesFromScript(game);

        const updatedGame = gameService.getGame(game.id)!;

        for (const player of updatedGame.players) {
          expect(player.role).toBeDefined();
          expect(player.role).not.toBe('');
          expect(player.camp).toBeDefined();
          expect(['wolf', 'good']).toContain(player.camp);
        }
      });
    });
  });

  describe('角色分配边界测试', () => {
    it('不应该允许在游戏已开始后分配角色', async () => {
      const game = await setupGame('dreamer-nightmare', 12);
      await assignRolesFromScript(game);
      await gameService.startGame(game.id);

      // 尝试重新分配角色
      const assignments = game.players.map(p => ({
        playerId: p.playerId,
        roleId: 'villager',
      }));

      const success = await gameService.assignRoles(game.id, assignments);
      expect(success).toBe(false);
    });

    it('不应该允许分配不存在的角色', async () => {
      const game = await setupGame('dreamer-nightmare', 12);

      const assignments = game.players.map(p => ({
        playerId: p.playerId,
        roleId: 'nonexistent_role',
      }));

      const success = await gameService.assignRoles(game.id, assignments);
      expect(success).toBe(false);
    });

    it('不应该允许分配剧本中不存在的角色', async () => {
      const game = await setupGame('dreamer-nightmare', 12);

      // 尝试分配骑士（骑士不在摄梦人剧本中）
      const assignments = game.players.map(p => ({
        playerId: p.playerId,
        roleId: 'knight',
      }));

      const success = await gameService.assignRoles(game.id, assignments);
      expect(success).toBe(false);
    });
  });
});
