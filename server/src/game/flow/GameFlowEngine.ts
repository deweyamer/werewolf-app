import { v4 as uuidv4 } from 'uuid';
import { Game, GamePhase, PlayerAction, ActionLog } from '../../../../shared/src/types.js';
import { SkillResolver } from '../skill/SkillResolver.js';
import { PhaseResult, ActionResult } from '../skill/SkillTypes.js';
import { RoleRegistry } from '../roles/RoleRegistry.js';

/**
 * 游戏流程引擎
 * 负责管理游戏阶段推进、技能结算、胜利判定
 */
export class GameFlowEngine {
  private skillResolver: SkillResolver;

  constructor() {
    this.skillResolver = new SkillResolver();
  }

  /**
   * 推进游戏阶段
   */
  async advancePhase(game: Game, scriptPhases: any[]): Promise<PhaseResult> {
    const currentPhaseConfig = scriptPhases.find(p => p.id === game.currentPhase);
    if (!currentPhaseConfig) {
      return { finished: false, message: '当前阶段配置错误' };
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
      game.currentPhase = firstNightPhase.id;
      game.currentPhaseType = 'night';
      return { finished: false, phase: firstNightPhase.id, prompt: firstNightPhase.description };
    }

    // 特殊处理：夜间结算
    if (nextPhaseConfig.id === 'settle') {
      const settleResult = await this.skillResolver.resolve(game, 'night');

      // 记录结算日志
      this.recordSettleLog(game, settleResult.messages, settleResult.deaths);

      // 清空夜间操作
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
    }

    // 特殊处理：白天结算
    if (nextPhaseConfig.id === 'daySettle') {
      const settleResult = await this.skillResolver.resolve(game, 'day');

      // 记录结算日志
      this.recordSettleLog(game, settleResult.messages, settleResult.deaths);

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
      // 跳过警长竞选，直接进入下一阶段
      const votePhase = scriptPhases.find(p => p.id === 'vote');
      if (votePhase) {
        game.currentPhase = 'vote';
        game.currentPhaseType = 'day';
        return { finished: false, phase: 'vote', prompt: '进入投票放逐阶段' };
      }
    }

    // 更新游戏阶段
    game.currentPhase = nextPhaseConfig.id;
    game.currentPhaseType = this.getPhaseType(nextPhaseConfig);

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
   */
  private checkWinner(game: Game): 'wolf' | 'good' | null {
    const aliveWolves = game.players.filter(p => p.alive && p.camp === 'wolf').length;
    const aliveGoods = game.players.filter(p => p.alive && p.camp === 'good').length;

    if (aliveWolves === 0) return 'good';
    if (aliveWolves >= aliveGoods) return 'wolf';
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
   * 获取技能结算器（供测试使用）
   */
  getSkillResolver(): SkillResolver {
    return this.skillResolver;
  }
}
