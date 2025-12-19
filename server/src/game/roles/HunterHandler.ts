import { Game, PlayerAction, GamePlayer } from '../../../../shared/src/types.js';
import { BaseRoleHandler, RoleActionResult } from './RoleHandler.js';
import {
  SkillEffect,
  SkillEffectType,
  SkillPriority,
  SkillTiming,
  DeathReason,
} from '../skill/SkillTypes.js';

/**
 * 猎人Handler
 * 死亡时可以开枪带走一名玩家（毒死不能开枪）
 */
export class HunterHandler extends BaseRoleHandler {
  roleId = 'hunter';
  roleName = '猎人';
  camp = 'good' as const;
  hasNightAction = false;
  hasDayAction = true; // 开枪是白天触发（死亡后）
  hasDeathTrigger = true;
  canSkip = true; // 可以选择不开枪

  async handleDayAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    // 猎人开枪（由上帝触发）
    const target = action.target;

    if (!target) {
      return { success: false, message: '必须选择开枪目标' };
    }

    if (!this.isValidTarget(game, target)) {
      return { success: false, message: '目标无效' };
    }

    // 不能射自己
    if (target === action.playerId) {
      return { success: false, message: '不能射自己' };
    }

    // 创建开枪技能效果
    const effect = this.createSkillEffect(
      SkillEffectType.KILL,
      SkillPriority.HUNTER_SHOOT,
      SkillTiming.ON_DEATH,
      action.playerId,
      target
    );

    return {
      success: true,
      message: `猎人开枪击中${target}号`,
      effect,
    };
  }

  async onDeath(game: Game, hunter: GamePlayer, deathReason: string): Promise<SkillEffect | null> {
    // 毒死不能开枪
    if (deathReason === DeathReason.POISON) {
      return null;
    }

    // 返回待处理的开枪效果（需要上帝指定目标）
    return {
      id: `hunter-shoot-${hunter.playerId}`,
      type: SkillEffectType.KILL,
      priority: SkillPriority.HUNTER_SHOOT,
      timing: SkillTiming.ON_DEATH,
      actorId: hunter.playerId,
      targetId: 0, // 待定
      executed: false,
      blocked: false,
      data: {
        message: `${hunter.playerId}号猎人可以开枪`,
        extraInfo: { pending: true },
      },
    };
  }

  getValidTargets(game: Game, playerId: number): number[] {
    // 猎人可以射所有存活玩家（除了自己）
    return this.getAlivePlayers(game)
      .filter(p => p.playerId !== playerId)
      .map(p => p.playerId);
  }

  initializeAbilities(player: GamePlayer): void {
    super.initializeAbilities(player);
  }
}
