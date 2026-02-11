import { v4 as uuidv4 } from 'uuid';
import { Game, GamePhase, GamePlayer, PlayerAction, ActionLog, PendingDeathTrigger } from '../../../../shared/src/types.js';
import { ROLE_INFO } from '../../../../shared/src/constants.js';
import { SkillResolver } from '../skill/SkillResolver.js';
import { PhaseResult, ActionResult, SettleResult, SkillEffect, SkillEffectType, SkillPriority, SkillTiming, DeathReason } from '../skill/SkillTypes.js';
import { RoleRegistry } from '../roles/RoleRegistry.js';
import { VotingSystem } from '../VotingSystem.js';

/**
 * 游戏流程引擎
 * 负责管理游戏阶段推进、技能结算、胜利判定
 */
export class GameFlowEngine {
  private skillResolver: SkillResolver;
  private votingSystem: VotingSystem;

  constructor(votingSystem: VotingSystem) {
    this.skillResolver = new SkillResolver();
    this.votingSystem = votingSystem;
  }

  /**
   * 推进游戏阶段
   */
  async advancePhase(game: Game, scriptPhases: any[]): Promise<PhaseResult> {
    const currentPhaseConfig = scriptPhases.find(p => p.id === game.currentPhase);
    if (!currentPhaseConfig) {
      return { finished: false, message: '当前阶段配置错误' };
    }

    // 自爆跳过投票：跳过 discussion/vote，直接跳到 vote 阶段
    // 这样下次推进时 nextPhaseConfig 是 daySettle，触发正常的白天结算流程
    if (game.skipToNight) {
      game.skipToNight = false;

      // 清空自爆产生的 SELF_DESTRUCT effect（死亡已在 handler 中直接处理）
      this.skillResolver.clear();

      // 记录自爆日志
      const boomPlayer = game.players.find(p => p.outReason === 'self_destruct' && !p.alive);
      if (boomPlayer) {
        const log: ActionLog = {
          id: uuidv4(),
          timestamp: new Date().toISOString(),
          round: game.currentRound,
          phase: 'discussion' as GamePhase,
          actorId: boomPlayer.userId,
          actorPlayerId: boomPlayer.playerId,
          action: 'boom',
          target: boomPlayer.playerId,
          result: `${boomPlayer.playerId}号狼人自爆`,
          visible: 'all',
        };
        game.history.push(log);
      }

      const votePhase = scriptPhases.find(p => p.id === 'vote');
      if (votePhase) {
        game.currentPhase = 'vote';
        game.currentPhaseType = 'day';
        return { finished: false, phase: 'vote', prompt: '狼人自爆，跳过投票，即将进入白天结算' };
      }
    }

    // 找到下一个阶段
    const nextPhaseConfig = scriptPhases.find(p => p.order === currentPhaseConfig.order + 1);
    if (!nextPhaseConfig) {
      // 没有下一阶段，循环回第一个夜间阶段
      const firstNightPhase = scriptPhases.find(p => p.isNightPhase && p.order > 0);
      if (!firstNightPhase) {
        return { finished: false, message: '无法找到下一阶段' };
      }
      game.currentRound++;
      // 清空上一轮的投票状态，为新回合准备
      game.exileVote = undefined;
      game.currentPhase = firstNightPhase.id;
      game.currentPhaseType = 'night';
      return { finished: false, phase: firstNightPhase.id, prompt: firstNightPhase.description };
    }

    // 特殊处理：投票阶段结束，处理投票结果
    if (currentPhaseConfig.id === 'vote' && nextPhaseConfig.id === 'daySettle') {
      // 如果有投票数据，处理放逐
      if (game.exileVote && Object.keys(game.exileVote.votes || {}).length > 0) {
        const tallyResult = this.votingSystem.tallyExileVotes(game);

        // 如果有玩家被投票出局
        if (typeof tallyResult.result === 'number') {
          const exiledPlayerId = tallyResult.result;

          // 创建放逐技能效果
          const exileEffect = {
            id: uuidv4(),
            type: SkillEffectType.KILL,
            priority: SkillPriority.EXILE_VOTE,
            timing: SkillTiming.DAY_ACTION,
            actorId: 0, // 系统
            targetId: exiledPlayerId,
            executed: false,
            blocked: false,
          };

          // 添加到技能结算器
          this.skillResolver.addEffect(exileEffect);
        }
      }
    }

    // 特殊处理：夜间结算
    if (nextPhaseConfig.id === 'settle') {
      // 根据狼人共识目标创建单一狼刀效果
      if (game.nightActions.wolfKill) {
        const wolfKillEffect: SkillEffect = {
          id: uuidv4(),
          type: SkillEffectType.KILL,
          priority: SkillPriority.WOLF_KILL,
          timing: SkillTiming.NIGHT_ACTION,
          actorId: 0, // 系统（狼人集体行动）
          targetId: game.nightActions.wolfKill,
          executed: false,
          blocked: false,
          data: {
            message: `狼人决定刀${game.nightActions.wolfKill}号`,
          },
        };
        this.skillResolver.addEffect(wolfKillEffect);
      }

      const settleResult = await this.skillResolver.resolve(game, 'night');

      // 记录结算日志
      this.recordSettleLog(game, settleResult.messages, settleResult.deaths);

      // 处理死亡触发技能和警长死亡
      for (const deadPlayerId of settleResult.deaths) {
        const deadPlayer = game.players.find(p => p.playerId === deadPlayerId);
        if (!deadPlayer) continue;

        // 处理警长死亡
        if (deadPlayer.isSheriff) {
          this.votingSystem.handleSheriffDeath(game, deadPlayerId, 'night_death');
        }

        // 处理死亡触发技能（如猎人开枪、黑狼王爆炸）
        await this.processDeathTrigger(game, deadPlayer, settleResult);
      }

      // 将待处理效果存储到 game 对象，供前端显示
      this.storePendingDeathTriggers(game, settleResult);

      // 保存本回合夜间操作到历史记录
      this.saveRoundHistory(game, settleResult.deaths, settleResult.messages.join('\n'));

      // 清空夜间操作（为下一回合准备）
      game.nightActions = {};

      // 清空技能结算器
      this.skillResolver.clear();

      // 检查游戏是否结束
      const winner = this.checkWinner(game);
      if (winner) {
        game.status = 'finished';
        game.currentPhase = 'finished';
        game.winner = winner;
        game.finishedAt = new Date().toISOString();
        return { finished: true, winner, message: `游戏结束，${winner === 'wolf' ? '狼人' : '好人'}获胜` };
      }

      // 第1回合夜间结算后，自动启动警长竞选
      if (game.currentRound === 1 && !game.sheriffElectionDone) {
        this.votingSystem.startSheriffElection(game);
        game.currentPhase = 'sheriffElection';
        game.currentPhaseType = 'day';
        return { finished: false, phase: 'sheriffElection', prompt: '警长竞选开始，请选择是否上警' };
      }
    }

    // 特殊处理：白天结算
    if (nextPhaseConfig.id === 'daySettle') {
      const settleResult = await this.skillResolver.resolve(game, 'day');

      // 记录结算日志
      this.recordSettleLog(game, settleResult.messages, settleResult.deaths);

      // 处理死亡触发技能和警长死亡
      for (const deadPlayerId of settleResult.deaths) {
        const deadPlayer = game.players.find(p => p.playerId === deadPlayerId);
        if (!deadPlayer) continue;

        // 处理警长死亡
        if (deadPlayer.isSheriff) {
          this.votingSystem.handleSheriffDeath(game, deadPlayerId, 'day_death');
        }

        // 处理死亡触发技能（如猎人开枪、黑狼王爆炸）
        await this.processDeathTrigger(game, deadPlayer, settleResult);
      }

      // 将待处理效果存储到 game 对象，供前端显示
      this.storePendingDeathTriggers(game, settleResult);

      // 清除恐惧状态（恐惧持续完整一个白天+夜晚回合，在白天结算后清除）
      game.players.forEach(p => {
        if (p.feared) {
          p.feared = false;
        }
      });

      // 更新本回合历史记录的放逐投票信息
      this.updateRoundHistoryWithExileVote(game, settleResult.deaths);

      // 清空技能结算器
      this.skillResolver.clear();

      // 检查游戏是否结束
      const winner = this.checkWinner(game);
      if (winner) {
        game.status = 'finished';
        game.currentPhase = 'finished';
        game.winner = winner;
        game.finishedAt = new Date().toISOString();
        return { finished: true, winner, message: `游戏结束，${winner === 'wolf' ? '狼人' : '好人'}获胜` };
      }
    }

    // 特殊处理：警长竞选（仅第一轮）
    if (nextPhaseConfig.id === 'sheriffElection' && game.sheriffElectionDone) {
      // 跳过警长竞选，直接进入讨论阶段
      const discussionPhase = scriptPhases.find(p => p.id === 'discussion');
      if (discussionPhase) {
        game.currentPhase = 'discussion';
        game.currentPhaseType = 'day';
        return { finished: false, phase: 'discussion', prompt: '进入讨论发言阶段' };
      }
    }

    // 特殊处理：不应该进入'finished'阶段（游戏结束应该通过胜利判定触发）
    if (nextPhaseConfig.id === 'finished') {
      // 游戏未结束，进入下一回合的夜晚
      const firstNightPhase = scriptPhases.find(p => p.isNightPhase && p.order > 0);
      if (firstNightPhase) {
        game.currentRound++;
        // 清空上一轮的投票状态，为新回合准备
        game.exileVote = undefined;
        game.currentPhase = firstNightPhase.id;
        game.currentPhaseType = 'night';
        return { finished: false, phase: firstNightPhase.id, prompt: `第${game.currentRound}回合夜晚开始` };
      }
    }

    // 更新游戏阶段
    game.currentPhase = nextPhaseConfig.id;
    game.currentPhaseType = this.getPhaseType(nextPhaseConfig);

    // 进入投票阶段时，初始化放逐投票
    if (nextPhaseConfig.id === 'vote' && !game.exileVote) {
      this.votingSystem.startExileVote(game);
    }

    // 进入女巫阶段时，提前设置被刀信息（仅当女巫有解药时）
    if (nextPhaseConfig.id === 'witch') {
      const witch = game.players.find(p => p.role === 'witch' && p.alive);
      if (witch && witch.abilities.antidote && game.nightActions.wolfKill) {
        game.nightActions.witchKnowsVictim = game.nightActions.wolfKill;
      }
    }

    return {
      finished: false,
      phase: nextPhaseConfig.id,
      prompt: nextPhaseConfig.description,
    };
  }

  /**
   * 提交玩家行动（转换为技能效果）
   */
  async submitAction(game: Game, action: PlayerAction): Promise<ActionResult> {
    const player = game.players.find(p => p.playerId === action.playerId);
    if (!player || !player.alive) {
      return { success: false, message: '玩家不存在或已死亡' };
    }

    // 特殊处理：投票阶段
    if (game.currentPhase === 'vote' && action.target !== undefined) {
      // 初始化投票系统
      if (!game.exileVote) {
        this.votingSystem.startExileVote(game);
      }

      // 提交投票
      const voteResult = this.votingSystem.voteForExile(game, action.playerId, action.target);
      if (!voteResult) {
        return { success: false, message: '投票失败' };
      }

      return { success: true, message: '投票成功' };
    }

    // 检查玩家是否被恐惧
    if (player.feared && action.phase !== 'fear') {
      return { success: false, message: '你被恐惧了，无法使用技能' };
    }

    // 获取角色Handler
    const handler = RoleRegistry.getHandler(player.role);
    if (!handler) {
      return { success: false, message: '角色Handler不存在' };
    }

    let effect = null;
    let responseData: any = {};

    // 根据阶段类型调用不同的Handler方法
    if (game.currentPhaseType === 'night') {
      const result = await handler.handleNightAction(game, action);
      if (!result.success) {
        return { success: false, message: result.message };
      }
      effect = result.effect;
      responseData = result.data || {};
    } else if (game.currentPhaseType === 'day') {
      const result = await handler.handleDayAction(game, action);
      if (!result.success) {
        return { success: false, message: result.message };
      }
      effect = result.effect;
      responseData = result.data || {};
    } else {
      return { success: false, message: '当前阶段不允许操作' };
    }

    // 如果有技能效果，添加到结算器
    if (effect) {
      this.skillResolver.addEffect(effect);
    }

    // 自爆：标记跳过白天
    if (responseData.skipToNight) {
      game.skipToNight = true;
    }

    // 记录操作日志
    const log: ActionLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      round: game.currentRound,
      phase: action.phase,
      actorId: player.userId,
      actorPlayerId: player.playerId,
      action: action.actionType,
      target: action.target,
      result: `${player.playerId}号完成操作`,
      visible: 'god',
    };
    game.history.push(log);

    return {
      success: true,
      message: '操作成功',
      data: responseData,
    };
  }

  /**
   * 记录结算日志
   */
  private recordSettleLog(game: Game, messages: string[], deaths: number[]): void {
    let resultMessage = '';

    if (deaths.length > 0) {
      resultMessage = `昨晚死亡：${deaths.join('号、')}号`;
    } else {
      resultMessage = '昨晚平安夜';
    }

    // 添加详细消息
    if (messages.length > 0) {
      resultMessage += '\n' + messages.join('\n');
    }

    const log: ActionLog = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      round: game.currentRound,
      phase: 'settle',
      actorId: 'system',
      actorPlayerId: 0,
      action: 'settle',
      result: resultMessage,
      visible: 'all',
    };

    game.history.push(log);
  }

  /**
   * 检查胜利条件
   * 好人胜利：所有狼人死亡
   * 狼人胜利：所有神职死亡 或 所有平民死亡
   */
  private checkWinner(game: Game): 'wolf' | 'good' | null {
    const alivePlayers = game.players.filter(p => p.alive);
    const aliveWolves = alivePlayers.filter(p => p.camp === 'wolf').length;

    // 好人胜利：所有狼人死亡
    if (aliveWolves === 0) return 'good';

    // 狼人胜利：所有神职死亡 或 所有平民死亡
    const totalGods = game.players.filter(p => ROLE_INFO[p.role]?.type === 'god').length;
    const totalCivilians = game.players.filter(p => ROLE_INFO[p.role]?.type === 'civilian').length;
    const aliveGods = alivePlayers.filter(p => ROLE_INFO[p.role]?.type === 'god').length;
    const aliveCivilians = alivePlayers.filter(p => ROLE_INFO[p.role]?.type === 'civilian').length;

    if (totalGods > 0 && aliveGods === 0) return 'wolf';
    if (totalCivilians > 0 && aliveCivilians === 0) return 'wolf';

    return null;
  }

  /**
   * 获取阶段类型
   */
  private getPhaseType(phaseConfig: any): 'night' | 'day' | 'transition' {
    if (phaseConfig.isNightPhase) return 'night';
    if (['settle', 'daySettle', 'lobby', 'finished'].includes(phaseConfig.id)) {
      return 'transition';
    }
    return 'day';
  }

  /**
   * 处理死亡触发技能（如猎人开枪、黑狼王爆炸）
   */
  private async processDeathTrigger(game: Game, deadPlayer: GamePlayer, settleResult: SettleResult): Promise<void> {
    const handler = RoleRegistry.getHandler(deadPlayer.role);
    if (!handler || !handler.hasDeathTrigger) return;

    const deathReason = deadPlayer.outReason || 'unknown';
    const pendingEffect = await handler.onDeath(game, deadPlayer, deathReason);

    if (pendingEffect) {
      settleResult.pendingEffects.push(pendingEffect);
    }
  }

  /**
   * 将待处理死亡触发效果存储到 game 对象，供前端显示和上帝操作
   */
  private storePendingDeathTriggers(game: Game, settleResult: SettleResult): void {
    if (settleResult.pendingEffects.length === 0) return;

    const triggers: PendingDeathTrigger[] = settleResult.pendingEffects.map(effect => {
      const actor = game.players.find(p => p.playerId === effect.actorId);
      const isHunter = effect.type === SkillEffectType.KILL && effect.priority === SkillPriority.HUNTER_SHOOT;
      return {
        id: effect.id,
        type: isHunter ? 'hunter_shoot' as const : 'black_wolf_explode' as const,
        actorId: effect.actorId,
        actorRole: actor?.role || 'unknown',
        message: effect.data?.message || '',
        resolved: false,
      };
    });

    game.pendingDeathTriggers = [...(game.pendingDeathTriggers || []), ...triggers];
  }

  /**
   * 获取技能结算器（供测试使用）
   */
  getSkillResolver(): SkillResolver {
    return this.skillResolver;
  }

  /**
   * 保存回合历史记录（夜间结算时调用）
   */
  private saveRoundHistory(game: Game, deaths: number[], settlementMessage: string): void {
    if (!game.roundHistory) {
      game.roundHistory = [];
    }

    // 深拷贝夜间操作
    const nightActionsCopy = JSON.parse(JSON.stringify(game.nightActions));

    const entry = {
      round: game.currentRound,
      nightActions: nightActionsCopy,
      deaths: deaths,
      settlementMessage: settlementMessage,
    };

    // 查找是否已有该回合的记录
    const existingIndex = game.roundHistory.findIndex(h => h.round === game.currentRound);
    if (existingIndex >= 0) {
      // 更新现有记录
      game.roundHistory[existingIndex] = { ...game.roundHistory[existingIndex], ...entry };
    } else {
      // 新增记录
      game.roundHistory.push(entry);
    }
  }

  /**
   * 更新回合历史记录的放逐投票信息（白天结算时调用）
   */
  private updateRoundHistoryWithExileVote(game: Game, dayDeaths: number[]): void {
    if (!game.roundHistory) {
      game.roundHistory = [];
    }

    // 查找当前回合的记录
    const existingIndex = game.roundHistory.findIndex(h => h.round === game.currentRound);

    if (existingIndex >= 0) {
      // 更新现有记录，添加放逐投票信息
      if (game.exileVote) {
        game.roundHistory[existingIndex].exileVote = JSON.parse(JSON.stringify(game.exileVote));
      }
      // 合并白天死亡的玩家
      game.roundHistory[existingIndex].deaths = [
        ...game.roundHistory[existingIndex].deaths,
        ...dayDeaths,
      ];
    } else {
      // 如果不存在（不应该发生），创建新记录
      game.roundHistory.push({
        round: game.currentRound,
        nightActions: {},
        exileVote: game.exileVote ? JSON.parse(JSON.stringify(game.exileVote)) : undefined,
        deaths: dayDeaths,
      });
    }
  }
}
