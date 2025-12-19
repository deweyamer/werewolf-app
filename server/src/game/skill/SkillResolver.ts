import { v4 as uuidv4 } from 'uuid';
import { Game } from '../../../../shared/src/types.js';
import {
  SkillEffect,
  SkillEffectType,
  SkillTiming,
  PlayerState,
  DeathReason,
  EffectOutcome,
  SettleResult,
} from './SkillTypes.js';

/**
 * 技能结算器 - 核心逻辑引擎
 * 负责按优先级执行所有技能效果，处理技能交互和状态管理
 */
export class SkillResolver {
  // 技能效果队列（按优先级排序）
  private effectQueue: SkillEffect[] = [];

  // 玩家状态映射
  private playerStates: Map<number, PlayerState> = new Map();

  /**
   * 添加技能效果到队列
   */
  addEffect(effect: SkillEffect): void {
    this.effectQueue.push(effect);
    this.sortQueue();
  }

  /**
   * 批量添加技能效果
   */
  addEffects(effects: SkillEffect[]): void {
    this.effectQueue.push(...effects);
    this.sortQueue();
  }

  /**
   * 按优先级排序队列
   */
  private sortQueue(): void {
    this.effectQueue.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 执行结算（夜间结算或白天结算）
   * @param game 游戏对象
   * @param phase 结算阶段 ('night' | 'day')
   * @returns 结算结果
   */
  async resolve(game: Game, phase: 'night' | 'day'): Promise<SettleResult> {
    const result: SettleResult = {
      deaths: [],
      revives: [],
      protected: [],
      blocked: [],
      messages: [],
      pendingEffects: [],
    };

    // 初始化玩家状态
    this.initializePlayerStates(game);

    // 按优先级执行每个技能效果
    for (const effect of this.effectQueue) {
      // 跳过不属于当前阶段的效果
      if (!this.shouldExecuteInPhase(effect, phase)) {
        continue;
      }

      // 检查执行条件
      if (effect.condition && !effect.condition(game)) {
        effect.blocked = true;
        effect.blockReason = '条件不满足';
        result.blocked.push(effect);
        continue;
      }

      // 检查施法者状态
      if (!this.canActorAct(effect.actorId)) {
        effect.blocked = true;
        effect.blockReason = '施法者无法行动（被恐惧或石化）';
        result.blocked.push(effect);
        continue;
      }

      // 检查目标状态（某些技能需要检查目标是否可被影响）
      if (this.requiresTargetCheck(effect.type)) {
        if (!this.canTargetBeAffected(effect.targetId, effect.type)) {
          effect.blocked = true;
          effect.blockReason = '目标免疫该效果';
          result.blocked.push(effect);
          continue;
        }
      }

      // 执行技能效果
      const outcome = await this.executeEffect(game, effect);
      effect.executed = true;

      // 收集结果
      this.collectResult(result, outcome);

      // 更新玩家状态
      this.updatePlayerStates(outcome);
    }

    // 处理连结死亡（狼美人）
    this.processLinkedDeaths(game, result);

    // 应用死亡到游戏状态
    this.applyDeaths(game, result);

    // 清空队列
    this.effectQueue = [];

    return result;
  }

  /**
   * 清空当前队列和状态（用于新一轮结算）
   */
  clear(): void {
    this.effectQueue = [];
    this.playerStates.clear();
  }

  /**
   * 初始化玩家状态
   */
  private initializePlayerStates(game: Game): void {
    this.playerStates.clear();

    for (const player of game.players) {
      if (!player.alive) continue;

      this.playerStates.set(player.playerId, {
        playerId: player.playerId,
        feared: player.feared || false,
        poisoned: false,
        cannotAct: false,
        protected: false,
        gargoyleProtected: false,
        dreamProtected: false,
        lastGuardTarget: player.abilities.lastGuardTarget,
        lastDreamTarget: player.abilities.lastDreamTarget,
        dreamKillReady: player.abilities.dreamKillReady,
        willDie: false,
      });
    }
  }

  /**
   * 判断技能是否应该在当前阶段执行
   */
  private shouldExecuteInPhase(effect: SkillEffect, phase: 'night' | 'day'): boolean {
    if (effect.timing === SkillTiming.NIGHT_ACTION && phase === 'night') {
      return true;
    }
    if (effect.timing === SkillTiming.DAY_ACTION && phase === 'day') {
      return true;
    }
    // 死亡触发技能在任何阶段都可能执行
    if (effect.timing === SkillTiming.ON_DEATH) {
      return true;
    }
    return false;
  }

  /**
   * 检查施法者是否能行动
   */
  private canActorAct(actorId: number): boolean {
    const state = this.playerStates.get(actorId);
    if (!state) return false;

    // 被恐惧、被石化、无法行动
    return !state.feared && !state.gargoyleProtected && !state.cannotAct;
  }

  /**
   * 检查某些技能类型是否需要目标检查
   */
  private requiresTargetCheck(effectType: SkillEffectType): boolean {
    return [
      SkillEffectType.KILL,
      SkillEffectType.CHECK,
      SkillEffectType.LINK,
    ].includes(effectType);
  }

  /**
   * 检查目标是否能被影响
   */
  private canTargetBeAffected(targetId: number, effectType: SkillEffectType): boolean {
    const state = this.playerStates.get(targetId);
    if (!state) return false;

    // 被石化免疫所有效果
    if (state.gargoyleProtected) {
      return false;
    }

    // 被守护或被摄梦人守护免疫狼刀
    if (effectType === SkillEffectType.KILL) {
      if (state.protected || state.dreamProtected) {
        return false;
      }
    }

    return true;
  }

  /**
   * 执行单个技能效果
   */
  private async executeEffect(game: Game, effect: SkillEffect): Promise<EffectOutcome> {
    switch (effect.type) {
      case SkillEffectType.KILL:
        return this.executeKill(game, effect);

      case SkillEffectType.PROTECT:
        return this.executeProtect(game, effect);

      case SkillEffectType.SAVE:
        return this.executeSave(game, effect);

      case SkillEffectType.CHECK:
        return this.executeCheck(game, effect);

      case SkillEffectType.LINK:
        return this.executeLink(game, effect);

      case SkillEffectType.BLOCK:
        return this.executeBlock(game, effect);

      case SkillEffectType.IMMUNE:
        return this.executeImmune(game, effect);

      case SkillEffectType.DREAM_KILL:
        return this.executeDreamKill(game, effect);

      default:
        return { success: false, message: '未知技能类型' };
    }
  }

  /**
   * 执行击杀效果
   */
  private executeKill(game: Game, effect: SkillEffect): EffectOutcome {
    const target = game.players.find(p => p.playerId === effect.targetId);
    if (!target || !target.alive) {
      return { success: false, message: '目标无效或已死亡' };
    }

    const state = this.playerStates.get(effect.targetId)!;
    state.willDie = true;
    state.deathReason = this.getDeathReasonFromEffect(effect);

    return {
      success: true,
      death: effect.targetId,
      message: `${effect.targetId}号将死亡`,
    };
  }

  /**
   * 执行守护效果
   */
  private executeProtect(game: Game, effect: SkillEffect): EffectOutcome {
    const state = this.playerStates.get(effect.targetId);
    if (!state) {
      return { success: false, message: '目标不存在' };
    }

    state.protected = true;

    return {
      success: true,
      protected: effect.targetId,
      message: `${effect.targetId}号受到守护`,
    };
  }

  /**
   * 执行救人效果（女巫解药）
   */
  private executeSave(game: Game, effect: SkillEffect): EffectOutcome {
    const state = this.playerStates.get(effect.targetId);
    if (!state) {
      return { success: false, message: '目标不存在' };
    }

    if (!state.willDie) {
      return { success: false, message: '目标未处于死亡状态' };
    }

    // 只能救狼刀
    if (state.deathReason !== DeathReason.WOLF_KILL) {
      return { success: false, message: '只能救狼刀目标' };
    }

    state.willDie = false;
    state.deathReason = undefined;

    return {
      success: true,
      revive: effect.targetId,
      message: `${effect.targetId}号被解药救活`,
    };
  }

  /**
   * 执行查验效果（预言家）
   */
  private executeCheck(game: Game, effect: SkillEffect): EffectOutcome {
    const target = game.players.find(p => p.playerId === effect.targetId);
    if (!target || !target.alive) {
      return { success: false, message: '目标无效或已死亡' };
    }

    // 返回阵营
    const checkResult = target.camp;

    // 保存到effect data中
    effect.data = {
      result: checkResult,
      message: `${effect.targetId}号是${checkResult === 'wolf' ? '狼人' : '好人'}`,
    };

    return {
      success: true,
      checkResult,
      message: effect.data.message,
    };
  }

  /**
   * 执行连结效果（狼美人魅惑）
   */
  private executeLink(game: Game, effect: SkillEffect): EffectOutcome {
    const actorState = this.playerStates.get(effect.actorId);
    const targetState = this.playerStates.get(effect.targetId);

    if (!actorState || !targetState) {
      return { success: false, message: '施法者或目标不存在' };
    }

    // 建立双向连结
    actorState.linkedTo = effect.targetId;
    targetState.linkedBy = effect.actorId;

    return {
      success: true,
      message: `${effect.actorId}号与${effect.targetId}号建立连结`,
    };
  }

  /**
   * 执行阻止效果（恐惧）
   */
  private executeBlock(game: Game, effect: SkillEffect): EffectOutcome {
    const state = this.playerStates.get(effect.targetId);
    if (!state) {
      return { success: false, message: '目标不存在' };
    }

    state.feared = true;
    state.cannotAct = true;

    return {
      success: true,
      blocked: effect.targetId,
      message: `${effect.targetId}号被恐惧，无法使用技能`,
    };
  }

  /**
   * 执行免疫效果（石像鬼守护）
   */
  private executeImmune(game: Game, effect: SkillEffect): EffectOutcome {
    const state = this.playerStates.get(effect.targetId);
    if (!state) {
      return { success: false, message: '目标不存在' };
    }

    state.gargoyleProtected = true;
    state.cannotAct = true; // 被石化的人也无法行动

    return {
      success: true,
      protected: effect.targetId,
      message: `${effect.targetId}号被石化，免疫所有技能`,
    };
  }

  /**
   * 执行梦死效果（摄梦人连续2晚梦游同一人）
   */
  private executeDreamKill(game: Game, effect: SkillEffect): EffectOutcome {
    const target = game.players.find(p => p.playerId === effect.targetId);
    if (!target || !target.alive) {
      return { success: false, message: '目标无效或已死亡' };
    }

    const state = this.playerStates.get(effect.targetId)!;
    state.willDie = true;
    state.deathReason = DeathReason.DREAM_KILL;

    return {
      success: true,
      death: effect.targetId,
      message: `${effect.targetId}号被梦死`,
    };
  }

  /**
   * 收集执行结果
   */
  private collectResult(result: SettleResult, outcome: EffectOutcome): void {
    if (!outcome.success) return;

    if (outcome.death) {
      if (!result.deaths.includes(outcome.death)) {
        result.deaths.push(outcome.death);
      }
    }
    if (outcome.revive) {
      result.revives.push(outcome.revive);
      // 从死亡列表中移除
      const index = result.deaths.indexOf(outcome.revive);
      if (index > -1) {
        result.deaths.splice(index, 1);
      }
    }
    if (outcome.protected) {
      result.protected.push(outcome.protected);
    }
    if (outcome.message) {
      result.messages.push(outcome.message);
    }
  }

  /**
   * 更新玩家状态
   */
  private updatePlayerStates(outcome: EffectOutcome): void {
    // 状态已经在executeXxx方法中更新了
  }

  /**
   * 处理连结死亡（狼美人）
   */
  private processLinkedDeaths(game: Game, result: SettleResult): void {
    // 检查是否有狼美人死亡
    for (const deadId of result.deaths) {
      const deadPlayer = game.players.find(p => p.playerId === deadId);
      if (!deadPlayer || deadPlayer.role !== '狼美人') continue;

      // 找到被魅惑的玩家
      const state = this.playerStates.get(deadId);
      if (state && state.linkedTo) {
        const linkedPlayer = game.players.find(p => p.playerId === state.linkedTo);
        if (linkedPlayer && linkedPlayer.alive) {
          result.deaths.push(state.linkedTo);
          result.messages.push(`${state.linkedTo}号因狼美人死亡而殉情`);
        }
      }
    }
  }

  /**
   * 应用死亡到游戏状态
   */
  private applyDeaths(game: Game, result: SettleResult): void {
    for (const deadId of result.deaths) {
      const player = game.players.find(p => p.playerId === deadId);
      if (player) {
        player.alive = false;
        const state = this.playerStates.get(deadId);
        if (state?.deathReason) {
          player.outReason = state.deathReason;
        }
      }
    }
  }

  /**
   * 从技能效果推断死亡原因
   */
  private getDeathReasonFromEffect(effect: SkillEffect): DeathReason {
    switch (effect.type) {
      case SkillEffectType.KILL:
        // 根据优先级判断
        if (effect.priority === 300) return DeathReason.WOLF_KILL;
        if (effect.priority === 410) return DeathReason.POISON;
        if (effect.priority === 3000) return DeathReason.HUNTER_SHOOT;
        if (effect.priority === 3100) return DeathReason.BLACK_WOLF_EXPLODE;
        return DeathReason.WOLF_KILL;

      case SkillEffectType.DREAM_KILL:
        return DeathReason.DREAM_KILL;

      default:
        return DeathReason.WOLF_KILL;
    }
  }

  /**
   * 获取当前玩家状态（用于调试）
   */
  getPlayerState(playerId: number): PlayerState | undefined {
    return this.playerStates.get(playerId);
  }

  /**
   * 获取所有玩家状态（用于调试）
   */
  getAllPlayerStates(): Map<number, PlayerState> {
    return new Map(this.playerStates);
  }
}
