import { Game, PlayerAction, GamePlayer } from '../../../../shared/src/types.js';
import { BaseRoleHandler, RoleActionResult } from './RoleHandler.js';
import {
  SkillEffectType,
  SkillPriority,
  SkillTiming,
} from '../skill/SkillTypes.js';

/**
 * 噩梦之影Handler
 * 夜间恐惧一名玩家，使其无法使用当晚技能
 */
export class NightmareHandler extends BaseRoleHandler {
  roleId = 'nightmare';
  roleName = '噩梦之影';
  camp = 'wolf' as const;
  hasNightAction = true;
  hasDayAction = false;
  hasDeathTrigger = false;
  canSkip = true; // 可以跳过不使用

  async handleNightAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    const target = action.target;

    // 跳过不使用
    if (!target) {
      game.nightActions.fearSubmitted = true;
      return {
        success: true,
        message: '噩梦之影跳过不使用恐惧',
      };
    }

    if (!this.isValidTarget(game, target)) {
      return { success: false, message: '目标无效' };
    }

    // 不能恐惧自己
    if (target === action.playerId) {
      return { success: false, message: '不能恐惧自己' };
    }

    // 不能恐惧狼人
    const targetPlayer = game.players.find(p => p.playerId === target);
    if (targetPlayer && targetPlayer.camp === 'wolf') {
      return { success: false, message: '不能恐惧狼人' };
    }

    // 创建恐惧技能效果
    const effect = this.createSkillEffect(
      SkillEffectType.BLOCK,
      SkillPriority.FEAR,
      SkillTiming.NIGHT_ACTION,
      action.playerId,
      target,
      {
        message: `${target}号被恐惧，无法使用技能`,
      }
    );

    // 记录恐惧目标
    game.nightActions.fear = target;
    game.nightActions.fearSubmitted = true;

    // 标记目标被恐惧（用于后续检查）
    if (targetPlayer) {
      targetPlayer.feared = true;
    }

    return {
      success: true,
      message: `恐惧${target}号`,
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
