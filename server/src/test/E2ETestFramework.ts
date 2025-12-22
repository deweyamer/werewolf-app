/**
 * 端到端测试框架
 *
 * 设计理念：
 * 1. 不做全笛卡尔积（会爆炸），而是采用分层测试策略
 * 2. 支持关键路径测试（冒烟测试）
 * 3. 支持场景化测试（特定剧情）
 * 4. 提供测试DSL，让测试易读易写
 */

import { ScriptService } from '../services/ScriptService.js';
import { GameService } from '../services/GameService.js';
import { Game, PlayerAction, GamePlayer } from '../../../shared/src/types.js';
import { RoleRegistry } from '../game/roles/RoleRegistry.js';

// ==================== 测试配置 ====================

export interface E2ETestConfig {
  /** 测试名称 */
  name: string;
  /** 剧本ID */
  scriptId: string;
  /** 角色分配：playerId -> roleId */
  roleAssignments: Record<number, string>;
  /** 测试场景：描述这个测试要验证什么 */
  scenario: string;
}

export interface NightAction {
  /** 阶段ID（如 'wolf', 'witch', 'seer'） */
  phase: string;
  /** 行动的玩家ID */
  playerId: number;
  /** 目标玩家ID（可选） */
  target?: number;
  /** 额外数据（如女巫的 actionType） */
  data?: any;
  /** 期望的结果（可选） */
  expected?: {
    success: boolean;
    message?: string;
  };
}

export interface DayAction {
  /** 投票玩家ID */
  playerId: number;
  /** 投给谁 */
  target: number;
}

export interface TestRound {
  /** 回合号 */
  roundNumber: number;
  /** 夜晚行动序列 */
  nightActions: NightAction[];
  /** 白天投票 */
  dayVotes?: DayAction[];
  /** 期望的死亡玩家 */
  expectedDeaths?: number[];
  /** 期望的游戏状态 */
  expectedGameState?: {
    status?: 'running' | 'finished';
    winner?: 'good' | 'wolf' | 'draw';
  };
}

// ==================== 测试执行器 ====================

export class E2ETestExecutor {
  private scriptService: ScriptService;
  private gameService: GameService;
  private game?: Game;

  constructor() {
    this.scriptService = new ScriptService();
    this.gameService = new GameService(this.scriptService);
  }

  async init(): Promise<void> {
    await this.scriptService.init();
    await this.gameService.init();
  }

  /**
   * 创建并初始化游戏
   */
  async setupGame(config: E2ETestConfig): Promise<Game> {
    // 创建游戏
    const game = await this.gameService.createGame('god-user', 'God', config.scriptId);
    if (!game) {
      throw new Error('创建游戏失败');
    }

    // 添加12个玩家
    for (let i = 1; i <= 12; i++) {
      const player = await this.gameService.addPlayer(game.id, `test-user-${i}`, `Test${i}`);
      if (!player) {
        throw new Error(`添加玩家 ${i} 失败`);
      }
    }

    // 分配角色
    const assignments = Object.entries(config.roleAssignments).map(([playerId, roleId]) => ({
      playerId: parseInt(playerId),
      roleId,
    }));

    const assignSuccess = await this.gameService.assignRoles(game.id, assignments);
    if (!assignSuccess) {
      throw new Error('分配角色失败');
    }

    // 开始游戏
    const startSuccess = await this.gameService.startGame(game.id);
    if (!startSuccess) {
      throw new Error('开始游戏失败');
    }

    this.game = this.gameService.getGame(game.id)!;
    return this.game;
  }

  /**
   * 执行一个回合的测试
   */
  async executeRound(round: TestRound): Promise<void> {
    console.log('[DEBUG] executeRound START: round keys:', Object.keys(round));
    console.log('[DEBUG] executeRound START: dayVotes:', round.dayVotes);
    if (!this.game) {
      throw new Error('游戏未初始化，请先调用 setupGame');
    }

    console.log(`\n执行第 ${round.roundNumber} 回合...`);

    // ===== 夜晚阶段 =====
    await this.executeNightPhase(round.nightActions);

    // ===== 夜晚结算 =====
    await this.advanceToPhase('settle');
    await this.gameService.advancePhase(this.game.id);

    // 检查游戏是否结束
    this.game = this.gameService.getGame(this.game.id)!;
    if (this.game.status === 'finished') {
      if (round.expectedGameState?.status === 'finished') {
        console.log(`✓ 游戏结束，获胜方: ${this.game.winner}`);
        if (round.expectedGameState.winner) {
          if (this.game.winner !== round.expectedGameState.winner) {
            throw new Error(`期望获胜方: ${round.expectedGameState.winner}, 实际: ${this.game.winner}`);
          }
        }
      } else {
        throw new Error('游戏意外结束');
      }
      // 验证死亡玩家（游戏结束时）
      if (round.expectedDeaths) {
        this.verifyDeaths(round.expectedDeaths);
      }
      return; // 游戏结束，不继续白天流程
    }

    // ===== 白天阶段 =====
    console.log(`[DEBUG] executeRound: round object keys:`, Object.keys(round));
    console.log(`[DEBUG] executeRound: dayVotes value:`, round.dayVotes);
    console.log(`[DEBUG] executeRound: dayVotes exists? ${!!round.dayVotes}, length: ${round.dayVotes?.length}`);
    if (round.dayVotes) {
      console.log('[DEBUG] executeRound: Calling executeDayPhase');
      await this.executeDayPhase(round.dayVotes);
    } else {
      // 如果没有指定投票，快速跳过白天
      await this.skipDayPhase();
    }

    // 验证死亡玩家（回合结束后，包含夜晚+白天的所有死亡）
    if (round.expectedDeaths) {
      this.verifyDeaths(round.expectedDeaths);
    }

    // 验证游戏状态
    if (round.expectedGameState) {
      this.verifyGameState(round.expectedGameState);
    }
  }

  /**
   * 执行夜晚阶段的所有行动
   */
  private async executeNightPhase(actions: NightAction[]): Promise<void> {
    if (!this.game) return;

    for (const action of actions) {
      await this.advanceToPhase(action.phase);

      const playerAction: PlayerAction = {
        playerId: action.playerId,
        phase: this.game.currentPhase,
        target: action.target,
        timestamp: new Date().toISOString(),
        ...action.data,
      };

      const result = await this.gameService.submitAction(this.game.id, playerAction);

      // 验证期望结果
      if (action.expected) {
        if (result.success !== action.expected.success) {
          throw new Error(
            `玩家 ${action.playerId} 在 ${action.phase} 阶段的行动失败。` +
            `期望 success=${action.expected.success}, 实际 success=${result.success}. ` +
            `消息: ${result.message}`
          );
        }
        if (action.expected.message && !result.message?.includes(action.expected.message)) {
          throw new Error(
            `玩家 ${action.playerId} 的行动消息不符。` +
            `期望包含: "${action.expected.message}", 实际: "${result.message}"`
          );
        }
      } else if (!result.success) {
        // 如果没有指定期望，默认期望成功
        throw new Error(
          `玩家 ${action.playerId} 在 ${action.phase} 阶段的行动失败: ${result.message}`
        );
      }

      console.log(`  ✓ ${action.phase}: 玩家${action.playerId} -> ${action.target || '无目标'}`);

      await this.gameService.advancePhase(this.game.id);
      this.game = this.gameService.getGame(this.game.id)!;
    }
  }

  /**
   * 执行白天阶段（讨论 + 投票）
   */
  private async executeDayPhase(votes: DayAction[]): Promise<void> {
    console.log(`[DEBUG] executeDayPhase called with ${votes.length} votes`);
    if (!this.game) return;

    // 讨论阶段
    await this.advanceToPhase('discussion');
    await this.gameService.advancePhase(this.game.id);

    // 上警阶段（如果有）
    const updatedGame = this.gameService.getGame(this.game.id)!;
    if (updatedGame.currentPhase.includes('sheriff')) {
      await this.gameService.advancePhase(this.game.id);
    }

    // 投票阶段
    await this.advanceToPhase('vote');

    // 刷新游戏状态
    this.game = this.gameService.getGame(this.game!.id)!;
    console.log(`[DEBUG] executeDayPhase: currentPhase after advanceToPhase('vote') = ${this.game.currentPhase}`);

    // 提交投票
    for (const vote of votes) {
      const voteAction: PlayerAction = {
        playerId: vote.playerId,
        phase: this.game!.currentPhase,
        target: vote.target,
        timestamp: new Date().toISOString(),
      };
      console.log(`[DEBUG] Submitting vote: player ${vote.playerId} -> ${vote.target}, phase=${this.game.currentPhase}`);
      await this.gameService.submitAction(this.game!.id, voteAction);
    }

    await this.gameService.advancePhase(this.game!.id);

    // 白天结算
    await this.advanceToPhase('daySettle');
    await this.gameService.advancePhase(this.game!.id);

    this.game = this.gameService.getGame(this.game!.id)!;
  }

  /**
   * 快速跳过白天阶段（不投票，不放逐）
   */
  private async skipDayPhase(): Promise<void> {
    if (!this.game) return;

    await this.advanceToPhase('discussion');
    await this.gameService.advancePhase(this.game.id);

    await this.advanceToPhase('vote');
    await this.gameService.advancePhase(this.game.id);

    await this.advanceToPhase('daySettle');
    await this.gameService.advancePhase(this.game.id);

    this.game = this.gameService.getGame(this.game.id)!;
  }

  /**
   * 推进到指定阶段
   */
  private async advanceToPhase(targetPhase: string, maxIterations: number = 20): Promise<void> {
    if (!this.game) return;

    let iterations = 0;
    while (iterations < maxIterations) {
      this.game = this.gameService.getGame(this.game.id)!;

      if (this.game.currentPhase === targetPhase) {
        return;
      }

      if (this.game.currentPhase.includes(targetPhase)) {
        return;
      }

      await this.gameService.advancePhase(this.game.id);
      iterations++;
    }

    throw new Error(`无法推进到阶段 ${targetPhase}，已尝试 ${maxIterations} 次。当前阶段: ${this.game.currentPhase}`);
  }

  /**
   * 验证死亡玩家
   */
  private verifyDeaths(expectedDeaths: number[]): void {
    if (!this.game) return;

    const actualDeaths = this.game.players.filter(p => !p.alive).map(p => p.playerId);

    for (const expectedDeath of expectedDeaths) {
      if (!actualDeaths.includes(expectedDeath)) {
        throw new Error(`期望玩家 ${expectedDeath} 死亡，但实际未死亡`);
      }
    }

    console.log(`  ✓ 验证死亡玩家: ${expectedDeaths.join(', ')}`);
  }

  /**
   * 验证游戏状态
   */
  private verifyGameState(expected: { status?: string; winner?: string }): void {
    if (!this.game) return;

    if (expected.status && this.game.status !== expected.status) {
      throw new Error(`期望游戏状态: ${expected.status}, 实际: ${this.game.status}`);
    }

    if (expected.winner && this.game.winner !== expected.winner) {
      throw new Error(`期望获胜方: ${expected.winner}, 实际: ${this.game.winner}`);
    }

    console.log(`  ✓ 游戏状态验证通过`);
  }

  /**
   * 获取当前游戏状态
   */
  getGame(): Game | undefined {
    return this.game ? this.gameService.getGame(this.game.id) : undefined;
  }

  /**
   * 获取玩家信息
   */
  getPlayer(playerId: number): GamePlayer | undefined {
    return this.game?.players.find(p => p.playerId === playerId);
  }

  /**
   * 获取指定角色的玩家
   */
  getPlayerByRole(roleId: string): GamePlayer | undefined {
    return this.game?.players.find(p => p.role === roleId);
  }

  /**
   * 获取存活的狼人
   */
  getAliveWolves(): GamePlayer[] {
    if (!this.game) return [];
    return this.game.players.filter(p => {
      if (!p.alive || !p.role) return false;
      const handler = RoleRegistry.getHandler(p.role);
      return handler?.camp === 'wolf';
    });
  }

  /**
   * 获取存活的好人
   */
  getAliveGood(): GamePlayer[] {
    if (!this.game) return [];
    return this.game.players.filter(p => {
      if (!p.alive || !p.role) return false;
      const handler = RoleRegistry.getHandler(p.role);
      return handler?.camp === 'good';
    });
  }
}

// ==================== 测试场景生成器 ====================

/**
 * 生成标准的12人局角色配置
 */
export class ScenarioBuilder {
  /**
   * 基础配置：4狼8好人
   */
  static standard12Player(wolves: string[], gods: string[], villagerCount: number = 4): Record<number, string> {
    if (wolves.length + gods.length + villagerCount !== 12) {
      throw new Error(`角色总数必须为12，当前: ${wolves.length + gods.length + villagerCount}`);
    }

    const roles: Record<number, string> = {};
    let playerId = 1;

    // 狼人
    for (const wolf of wolves) {
      roles[playerId++] = wolf;
    }

    // 神职
    for (const god of gods) {
      roles[playerId++] = god;
    }

    // 平民
    for (let i = 0; i < villagerCount; i++) {
      roles[playerId++] = 'villager';
    }

    return roles;
  }

  /**
   * 摄梦人剧本标准配置
   */
  static dreamerScript(): Record<number, string> {
    return this.standard12Player(
      ['nightmare', 'wolf', 'wolf', 'wolf'],
      ['dreamer', 'seer', 'witch', 'hunter'],
      4
    );
  }

  /**
   * 守墓人石像鬼剧本
   */
  static gravekeeperScript(): Record<number, string> {
    return this.standard12Player(
      ['gargoyle', 'wolf', 'wolf', 'wolf'],
      ['gravekeeper', 'seer', 'witch', 'hunter'],
      4
    );
  }

  /**
   * 骑士狼美人剧本
   */
  static knightBeautyScript(): Record<number, string> {
    return this.standard12Player(
      ['wolf', 'wolf', 'wolf', 'wolf_beauty'],
      ['knight', 'seer', 'witch', 'guard'],
      4
    );
  }
}

// ==================== 预定义测试场景 ====================

export class TestScenarios {
  /**
   * 冒烟测试：标准游戏流程（2个回合）
   */
  static smokeTest(): { config: E2ETestConfig; rounds: TestRound[] } {
    return {
      config: {
        name: '冒烟测试 - 标准流程',
        scriptId: 'dreamer-nightmare',
        roleAssignments: ScenarioBuilder.dreamerScript(),
        scenario: '验证游戏基本流程能正常运行2个回合',
      },
      rounds: [
        {
          roundNumber: 1,
          nightActions: [
            { phase: 'fear', playerId: 1, target: 6 }, // 噩梦恐惧预言家
            { phase: 'dream', playerId: 5, target: 2 }, // 摄梦人梦狼人
            { phase: 'wolf', playerId: 2, target: 9 }, // 狼刀9号
            { phase: 'witch', playerId: 7, data: { actionType: 'none' } }, // 女巫不操作
            { phase: 'seer', playerId: 6, expected: { success: false, message: '恐惧' } }, // 预言家被恐惧
          ],
          expectedDeaths: [9],
        },
        {
          roundNumber: 2,
          nightActions: [
            { phase: 'fear', playerId: 1, target: 8 }, // 恐惧猎人（换个目标）
            { phase: 'dream', playerId: 5, target: 2 }, // 再次梦2号（测试连续梦死）
            { phase: 'wolf', playerId: 2, target: 10 }, // 狼刀10号
            { phase: 'witch', playerId: 7, data: { actionType: 'none' } }, // 女巫不操作
            { phase: 'seer', playerId: 6, target: 2 }, // 预言家查验（第一回合恐惧应该已解除）
          ],
          expectedDeaths: [9, 10],
        },
      ],
    };
  }

  /**
   * 胜利条件测试：狼人获胜
   */
  static wolfWinTest(): { config: E2ETestConfig; rounds: TestRound[] } {
    return {
      config: {
        name: '胜利条件 - 狼人获胜',
        scriptId: 'dreamer-nightmare',
        roleAssignments: ScenarioBuilder.dreamerScript(),
        scenario: '验证当好人全部死亡时，狼人获胜',
      },
      rounds: [
        {
          roundNumber: 1,
          nightActions: [
            { phase: 'dream', playerId: 5, target: 2 },
            { phase: 'wolf', playerId: 2, target: 5 }, // 刀摄梦人
            { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
            { phase: 'seer', playerId: 6, target: 2 },
          ],
          dayVotes: [
            { playerId: 1, target: 6 }, // 投预言家
            { playerId: 2, target: 6 },
            { playerId: 3, target: 6 },
            { playerId: 4, target: 6 },
          ],
          expectedDeaths: [5, 6],
        },
        // ... 继续刀好人直到全灭
      ],
    };
  }

  /**
   * 边界测试：守卫连续守护
   */
  static guardConsecutiveTest(): { config: E2ETestConfig; rounds: TestRound[] } {
    return {
      config: {
        name: '边界测试 - 守卫连续守护',
        scriptId: 'knight-beauty',
        roleAssignments: ScenarioBuilder.knightBeautyScript(),
        scenario: '验证守卫不能连续两晚守护同一人',
      },
      rounds: [
        {
          roundNumber: 1,
          nightActions: [
            { phase: 'guard', playerId: 8, target: 6 }, // 守护6号
            { phase: 'wolf', playerId: 1, target: 9 },
            { phase: 'witch', playerId: 7, data: { actionType: 'none' } },
            { phase: 'seer', playerId: 6, target: 1 },
          ],
          expectedDeaths: [9],
        },
        {
          roundNumber: 2,
          nightActions: [
            { phase: 'guard', playerId: 8, target: 6, expected: { success: false, message: '不能' } }, // 应该失败
            { phase: 'wolf', playerId: 1, target: 10 },
          ],
          expectedDeaths: [9, 10],
        },
      ],
    };
  }
}
