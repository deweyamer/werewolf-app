import { Game, PlayerAction, GamePlayer } from '../../../../shared/src/types.js';
import { BaseRoleHandler, RoleActionResult } from './RoleHandler.js';
import {
  SkillEffectType,
  SkillPriority,
  SkillTiming,
} from '../skill/SkillTypes.js';

/**
 * 狼美人Handler
 * 夜间魅惑一名玩家，建立连结：狼美人死则该玩家同死
 */
export class WolfBeautyHandler extends BaseRoleHandler {
  roleId = 'wolf_beauty';
  roleName = '狼美人';
  camp = 'wolf' as const;
  hasNightAction = true;
  hasDayAction = false;
  hasDeathTrigger = false;
  canSkip = false; // 必须魅惑

  async handleNightAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    const target = action.target;

    if (!target) {
      return { success: false, message: '必须选择魅惑目标' };
    }

    if (!this.isValidTarget(game, target)) {
      return { success: false, message: '目标无效' };
    }

    // 不能魅惑自己
    if (target === action.playerId) {
      return { success: false, message: '不能魅惑自己' };
    }

    // 不能魅惑狼人
    const targetPlayer = game.players.find(p => p.playerId === target);
    if (targetPlayer && targetPlayer.camp === 'wolf') {
      return { success: false, message: '不能魅惑狼人' };
    }

    // 创建连结技能效果
    const effect = this.createSkillEffect(
      SkillEffectType.LINK,
      SkillPriority.WOLF_BEAUTY,
      SkillTiming.NIGHT_ACTION,
      action.playerId,
      target,
      {
        message: `狼美人与${target}号建立连结`,
      }
    );

    return {
      success: true,
      message: `魅惑${target}号，建立生死连结`,
      effect,
    };
  }

  getValidTargets(game: Game, playerId: number): number[] {
    // 所有存活好人
    return this.getAliveGoodPlayers(game).map(p => p.playerId);
  }

  initializeAbilities(player: GamePlayer): void {
    super.initializeAbilities(player);
  }
}
