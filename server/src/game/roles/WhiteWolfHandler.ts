import { Game, PlayerAction, GamePlayer } from '../../../../shared/src/types.js';
import { BaseRoleHandler, RoleActionResult } from './RoleHandler.js';
import {
  SkillEffect,
  SkillEffectType,
  SkillPriority,
  SkillTiming,
} from '../skill/SkillTypes.js';

/**
 * 白狼王Handler
 * 白天发言阶段可以自爆，直接结束白天进入黑夜（全局一次）
 */
export class WhiteWolfHandler extends BaseRoleHandler {
  roleId = 'white_wolf';
  roleName = '白狼王';
  camp = 'wolf' as const;
  hasNightAction = true; // 参与狼刀
  hasDayAction = true;   // 自爆
  hasDeathTrigger = false;
  canSkip = true; // 可以不使用

  // 白狼王参与狼刀（复用普通狼人的逻辑）
  async handleNightAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    // 白狼王夜间行为和普通狼人一样，参与狼刀投票
    // 这里可以复用WolfHandlerV2的逻辑
    // 为了简化，直接返回不处理，由WolfHandlerV2统一处理
    return {
      success: true,
      message: '白狼王参与狼刀投票',
    };
  }

  async handleDayAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    const whiteWolf = game.players.find(p => p.playerId === action.playerId);
    if (!whiteWolf) {
      return { success: false, message: '白狼王不存在' };
    }

    // 检查是否已经使用过自爆
    if (whiteWolf.abilities.whiteWolfBoomUsed) {
      return { success: false, message: '自爆技能已经使用过了' };
    }

    const actionType = action.actionType;

    // 跳过不使用
    if (actionType !== 'boom') {
      return {
        success: true,
        message: '白狼王跳过不自爆',
      };
    }

    // 执行自爆
    const effect = this.createSkillEffect(
      SkillEffectType.SELF_DESTRUCT,
      SkillPriority.WHITE_WOLF_BOOM,
      SkillTiming.DAY_ACTION,
      action.playerId,
      action.playerId, // 目标是自己
      {
        message: `白狼王${action.playerId}号自爆，直接进入黑夜`,
        skipToNight: true, // 特殊标记：跳过后续白天流程
      }
    );

    // 标记自爆已使用
    whiteWolf.abilities.whiteWolfBoomUsed = true;

    // 处理警徽：如果白狼王是警长，需要上帝指定警徽归属
    const wasSheriff = whiteWolf.isSheriff;
    if (wasSheriff) {
      const validTargets = game.players
        .filter(p => p.alive && p.playerId !== action.playerId)
        .map(p => p.playerId);

      game.sheriffBadgeState = 'pending_assign';
      game.pendingSheriffTransfer = {
        fromPlayerId: action.playerId,
        options: validTargets,
        reason: 'wolf_explosion',
      };
      whiteWolf.isSheriff = false;
      game.sheriffId = 0;
    }

    // 白狼王自爆后立即死亡
    whiteWolf.alive = false;
    whiteWolf.outReason = 'self_destruct';

    return {
      success: true,
      message: '白狼王自爆成功',
      effect,
      data: {
        skipToNight: true,
        sheriffPendingAssign: wasSheriff,
      },
    };
  }

  getValidTargets(game: Game, playerId: number): number[] {
    // 白狼王刀人目标同普通狼人
    return this.getAliveGoodPlayers(game).map(p => p.playerId);
  }

  initializeAbilities(player: GamePlayer): void {
    super.initializeAbilities(player);
    player.abilities.whiteWolfBoomUsed = false;
  }
}
