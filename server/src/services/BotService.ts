/**
 * 机器人决策服务
 *
 * 为测试模式提供自动玩家决策逻辑
 * 策略以简单随机为主，目的是测试游戏流程而非AI对战
 */

import { Game, GamePlayer, PlayerAction, GamePhase } from '../../../shared/src/types.js';
import { GameService } from './GameService.js';
import { RoleRegistry } from '../game/roles/RoleRegistry.js';

export class BotService {
  private gameService: GameService;

  constructor(gameService: GameService) {
    this.gameService = gameService;
  }

  /**
   * 为当前阶段执行所有机器人行动
   */
  async executeBotActionsForPhase(game: Game, phase: GamePhase): Promise<void> {
    console.log(`[Bot] 执行机器人行动: 阶段=${phase}, 回合=${game.currentRound}`);

    // 获取需要在当前阶段行动的机器人玩家
    const botsToAct = this.getBotsForPhase(game, phase);

    for (const bot of botsToAct) {
      const action = this.generateBotDecision(bot, phase, game);
      if (action) {
        console.log(`[Bot] ${bot.username}(${bot.role}) 决策: ${JSON.stringify(action)}`);
        await this.gameService.submitAction(game.id, action);
      }
    }
  }

  /**
   * 获取需要在当前阶段行动的机器人
   */
  private getBotsForPhase(game: Game, phase: GamePhase): GamePlayer[] {
    return game.players.filter(p => {
      if (!p.isBot || !p.alive) return false;

      // 根据阶段确定哪些角色需要行动
      switch (phase) {
        case 'fear':
          return p.role === 'nightmare';
        case 'dream':
          return p.role === 'dreamer';
        case 'gargoyle':
          return p.role === 'gargoyle';
        case 'guard':
          return p.role === 'guard';
        case 'wolf':
          // 所有狼人都可以投票刀人，但只需要一个代表提交
          const handler = RoleRegistry.getHandler(p.role);
          return handler?.camp === 'wolf';
        case 'wolf_beauty':
          return p.role === 'wolf_beauty';
        case 'witch':
          return p.role === 'witch';
        case 'seer':
          return p.role === 'seer';
        case 'gravekeeper':
          return p.role === 'gravekeeper';
        case 'vote':
          return true; // 所有存活玩家都投票
        default:
          return false;
      }
    });
  }

  /**
   * 生成单个机器人的决策
   */
  private generateBotDecision(player: GamePlayer, phase: GamePhase, game: Game): PlayerAction | null {
    // 检查玩家是否被恐惧（恐惧状态下无法行动）
    if (player.feared && phase !== 'vote') {
      console.log(`[Bot] ${player.username} 被恐惧，跳过行动`);
      return null;
    }

    switch (phase) {
      case 'fear':
        return this.fearDecision(player, game);
      case 'dream':
        return this.dreamDecision(player, game);
      case 'gargoyle':
        return this.gargoyleDecision(player, game);
      case 'guard':
        return this.guardDecision(player, game);
      case 'wolf':
        return this.wolfDecision(player, game);
      case 'wolf_beauty':
        return this.wolfBeautyDecision(player, game);
      case 'witch':
        return this.witchDecision(player, game);
      case 'seer':
        return this.seerDecision(player, game);
      case 'gravekeeper':
        return this.gravekeeperDecision(player, game);
      case 'vote':
        return this.voteDecision(player, game, phase);
      default:
        return null;
    }
  }

  /**
   * 噩梦之影决策：随机恐惧一个好人
   */
  private fearDecision(player: GamePlayer, game: Game): PlayerAction {
    const targets = game.players.filter(p => {
      if (!p.alive || p.playerId === player.playerId) return false;
      const handler = RoleRegistry.getHandler(p.role);
      return handler?.camp === 'good';
    });

    const target = this.randomPick(targets);
    console.log(`[Bot] 噩梦之影(${player.playerId}号) 恐惧 ${target?.playerId || 0}号`);

    return {
      phase: 'fear',
      playerId: player.playerId,
      actionType: 'action',
      target: target?.playerId || 0,
    };
  }

  /**
   * 摄梦人决策：随机选择一个玩家摄梦（避免连续梦同一人导致梦死）
   */
  private dreamDecision(player: GamePlayer, game: Game): PlayerAction {
    const lastTarget = player.abilities?.lastDreamTarget;
    const targets = game.players.filter(p => {
      if (!p.alive || p.playerId === player.playerId) return false;
      // 避免连续梦同一人
      if (p.playerId === lastTarget) return false;
      return true;
    });

    const target = this.randomPick(targets);
    console.log(`[Bot] 摄梦人(${player.playerId}号) 摄梦 ${target?.playerId || 0}号`);

    return {
      phase: 'dream',
      playerId: player.playerId,
      actionType: 'action',
      target: target?.playerId || 0,
    };
  }

  /**
   * 石像鬼决策：随机查验一个玩家
   */
  private gargoyleDecision(player: GamePlayer, game: Game): PlayerAction {
    const targets = game.players.filter(p => p.alive && p.playerId !== player.playerId);
    const target = this.randomPick(targets);
    console.log(`[Bot] 石像鬼(${player.playerId}号) 查验 ${target?.playerId || 0}号`);

    return {
      phase: 'gargoyle',
      playerId: player.playerId,
      actionType: 'action',
      target: target?.playerId || 0,
    };
  }

  /**
   * 守卫决策：随机守护一个玩家（不能连续守同一人）
   */
  private guardDecision(player: GamePlayer, game: Game): PlayerAction | null {
    const lastTarget = player.abilities?.lastGuardTarget;
    const targets = game.players.filter(p => {
      if (!p.alive) return false;
      // 不能连续守护同一人（lastGuardTarget 为 0 表示空手，不排除任何人）
      if (lastTarget && p.playerId === lastTarget) return false;
      return true;
    });

    const target = this.randomPick(targets);
    if (!target) {
      console.log(`[Bot] 守卫(${player.playerId}号) 无可用守护目标`);
      return null;
    }
    console.log(`[Bot] 守卫(${player.playerId}号) 守护 ${target.playerId}号`);

    return {
      phase: 'guard',
      playerId: player.playerId,
      actionType: 'action',
      target: target.playerId,
    };
  }

  /**
   * 狼人决策：选择一个好人刀
   * 注意：只让一个狼人提交行动，避免重复
   */
  private wolfDecision(player: GamePlayer, game: Game): PlayerAction | null {
    // 检查是否已有狼人提交
    if (game.nightActions?.wolfKill !== undefined) {
      return null;
    }

    const targets = game.players.filter(p => {
      if (!p.alive) return false;
      const handler = RoleRegistry.getHandler(p.role);
      return handler?.camp === 'good';
    });

    const target = this.randomPick(targets);
    console.log(`[Bot] 狼人(${player.playerId}号) 刀 ${target?.playerId || 0}号`);

    return {
      phase: 'wolf',
      playerId: player.playerId,
      actionType: 'action',
      target: target?.playerId || 0,
    };
  }

  /**
   * 狼美人决策：随机魅惑一个好人
   */
  private wolfBeautyDecision(player: GamePlayer, game: Game): PlayerAction {
    const targets = game.players.filter(p => {
      if (!p.alive || p.playerId === player.playerId) return false;
      const handler = RoleRegistry.getHandler(p.role);
      return handler?.camp === 'good';
    });

    const target = this.randomPick(targets);
    console.log(`[Bot] 狼美人(${player.playerId}号) 魅惑 ${target?.playerId || 0}号`);

    return {
      phase: 'wolf_beauty',
      playerId: player.playerId,
      actionType: 'action',
      target: target?.playerId || 0,
    };
  }

  /**
   * 女巫决策：
   * - 第一晚如果有人被刀，50%概率救人
   * - 之后不主动使用毒药（太复杂）
   */
  private witchDecision(player: GamePlayer, game: Game): PlayerAction {
    const victim = game.nightActions?.wolfKill;
    const hasAntidote = player.abilities?.antidote !== false;

    // 如果有人被刀且有解药，50%概率救人
    if (victim && hasAntidote && Math.random() > 0.5) {
      console.log(`[Bot] 女巫(${player.playerId}号) 使用解药救 ${victim}号`);
      return {
        phase: 'witch',
        playerId: player.playerId,
        actionType: 'save',
        target: victim,
      };
    }

    // 不使用药水
    console.log(`[Bot] 女巫(${player.playerId}号) 不使用药水`);
    return {
      phase: 'witch',
      playerId: player.playerId,
      actionType: 'none',
    };
  }

  /**
   * 预言家决策：随机查验一个玩家
   */
  private seerDecision(player: GamePlayer, game: Game): PlayerAction {
    // 优先查验未查验过的玩家
    const targets = game.players.filter(p => {
      if (!p.alive || p.playerId === player.playerId) return false;
      return true;
    });

    const target = this.randomPick(targets);
    console.log(`[Bot] 预言家(${player.playerId}号) 查验 ${target?.playerId || 0}号`);

    return {
      phase: 'seer',
      playerId: player.playerId,
      actionType: 'action',
      target: target?.playerId || 0,
    };
  }

  /**
   * 守墓人决策：自动获取上轮投票出局者阵营，无需选择目标
   */
  private gravekeeperDecision(player: GamePlayer, game: Game): PlayerAction {
    console.log(`[Bot] 守墓人(${player.playerId}号) 自动验尸`);

    return {
      phase: 'gravekeeper',
      playerId: player.playerId,
      actionType: 'check',
      target: 0,
    };
  }

  /**
   * 投票决策：随机投票给一个存活玩家
   */
  private voteDecision(player: GamePlayer, game: Game, phase: GamePhase): PlayerAction {
    // 随机投票给一个存活玩家（不投自己）
    const targets = game.players.filter(p => p.alive && p.playerId !== player.playerId);
    const target = this.randomPick(targets);

    console.log(`[Bot] ${player.username}(${player.playerId}号) 投票给 ${target?.playerId || 0}号`);

    return {
      phase,
      playerId: player.playerId,
      actionType: 'action',
      target: target?.playerId || 0,
    };
  }

  /**
   * 从数组中随机选择一个元素
   */
  private randomPick<T>(arr: T[]): T | undefined {
    if (arr.length === 0) return undefined;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ================= 警长竞选相关 =================

  /**
   * 执行机器人警长竞选上警决策
   * 每个机器人有 40% 概率上警
   */
  async executeBotSheriffSignup(game: Game): Promise<void> {
    if (!game.hasBot || !game.sheriffElection || game.sheriffElection.phase !== 'signup') {
      return;
    }

    console.log('[Bot] 执行机器人上警决策');

    const bots = game.players.filter(p => p.isBot && p.alive);
    for (const bot of bots) {
      const runForSheriff = Math.random() < 0.4; // 40% 概率上警
      console.log(`[Bot] ${bot.username}(${bot.playerId}号) ${runForSheriff ? '上警' : '不上警'}`);
      await this.gameService.sheriffSignup(game.id, bot.playerId, runForSheriff);
    }
  }

  /**
   * 执行机器人警长竞选退水决策
   * 上警的机器人有 20% 概率退水
   */
  async executeBotSheriffWithdraw(game: Game): Promise<void> {
    if (!game.hasBot || !game.sheriffElection || game.sheriffElection.phase !== 'campaign') {
      return;
    }

    console.log('[Bot] 执行机器人退水决策');

    const botCandidates = game.sheriffElection.candidates.filter(playerId => {
      const player = game.players.find(p => p.playerId === playerId);
      return player?.isBot;
    });

    for (const playerId of botCandidates) {
      const player = game.players.find(p => p.playerId === playerId);
      if (player && Math.random() < 0.2) { // 20% 概率退水
        console.log(`[Bot] ${player.username}(${playerId}号) 退水`);
        await this.gameService.sheriffWithdraw(game.id, playerId);
      }
    }
  }

  /**
   * 执行机器人警长投票决策
   * 随机投给一个候选人，10% 概率弃票
   */
  async executeBotSheriffVote(game: Game): Promise<void> {
    if (!game.hasBot || !game.sheriffElection || game.sheriffElection.phase !== 'voting') {
      return;
    }

    console.log('[Bot] 执行机器人警长投票决策');

    // 找出可以投票的机器人（存活、不是候选人）
    const botVoters = game.players.filter(p => {
      if (!p.isBot || !p.alive) return false;
      // 候选人不能投票
      return !game.sheriffElection!.candidates.includes(p.playerId);
    });

    const candidates = game.sheriffElection.candidates;

    for (const bot of botVoters) {
      // 已经投过票的跳过
      if (game.sheriffElection.votes[bot.playerId] !== undefined) {
        continue;
      }

      let vote: number | 'skip';
      if (Math.random() < 0.1 || candidates.length === 0) {
        // 10% 概率弃票，或者没有候选人时弃票
        vote = 'skip';
        console.log(`[Bot] ${bot.username}(${bot.playerId}号) 警长投票: 弃票`);
      } else {
        // 随机投给一个候选人
        const targetId = candidates[Math.floor(Math.random() * candidates.length)];
        vote = targetId;
        console.log(`[Bot] ${bot.username}(${bot.playerId}号) 警长投票: ${targetId}号`);
      }

      await this.gameService.voteForSheriff(game.id, bot.playerId, vote);
    }
  }

  /**
   * 执行机器人放逐投票决策
   * 随机投给一个存活玩家，10% 概率弃票
   */
  async executeBotExileVote(game: Game): Promise<void> {
    if (!game.hasBot || !game.exileVote || game.exileVote.phase !== 'voting') {
      return;
    }

    console.log('[Bot] 执行机器人放逐投票决策');

    const bots = game.players.filter(p => p.isBot && p.alive);
    const aliveTargets = game.players.filter(p => p.alive);

    for (const bot of bots) {
      // 已经投过票的跳过
      if (game.exileVote.votes[bot.playerId] !== undefined) {
        continue;
      }

      let vote: number | 'skip';
      if (Math.random() < 0.1) {
        // 10% 概率弃票
        vote = 'skip';
        console.log(`[Bot] ${bot.username}(${bot.playerId}号) 放逐投票: 弃票`);
      } else {
        // 随机投给一个存活玩家（不投自己）
        const targets = aliveTargets.filter(p => p.playerId !== bot.playerId);
        if (targets.length > 0) {
          const target = targets[Math.floor(Math.random() * targets.length)];
          vote = target.playerId;
          console.log(`[Bot] ${bot.username}(${bot.playerId}号) 放逐投票: ${target.playerId}号`);
        } else {
          vote = 'skip';
          console.log(`[Bot] ${bot.username}(${bot.playerId}号) 放逐投票: 弃票(无目标)`);
        }
      }

      await this.gameService.voteForExile(game.id, bot.playerId, vote);
    }
  }
}
