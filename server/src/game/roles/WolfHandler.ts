import { Game, PlayerAction, GamePlayer } from '../../../../shared/src/types.js';
import { BaseRoleHandler, RoleActionResult } from './RoleHandler.js';
import {
  SkillEffectType,
  SkillPriority,
  SkillTiming,
} from '../skill/SkillTypes.js';

/**
 * 普通狼人Handler
 * 夜间集体投票刀人
 */
export class WolfHandler extends BaseRoleHandler {
  roleId = 'wolf';
  roleName = '普通狼人';
  camp = 'wolf' as const;
  hasNightAction = true;
  hasDayAction = false;
  hasDeathTrigger = false;
  canSkip = false; // 必须刀人

  async handleNightAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    const target = action.target;

    if (!target) {
      return { success: false, message: '必须选择刀人目标' };
    }

    if (!this.isValidTarget(game, target)) {
      return { success: false, message: '目标无效' };
    }

    // 不能刀狼人
    const targetPlayer = game.players.find(p => p.playerId === target);
    if (targetPlayer && targetPlayer.camp === 'wolf') {
      return { success: false, message: '不能刀狼人' };
    }

    // 初始化狼人投票记录
    if (!game.nightActions.wolfVotes) {
      game.nightActions.wolfVotes = {};
    }

    // 记录本狼的投票（OR逻辑：任意一个狼投票即可生效）
    game.nightActions.wolfVotes[action.playerId] = target;

    // OR逻辑：有任意一个狼投票即可决定目标
    // 使用最新投票的目标作为最终目标
    const finalTarget = target;

    // 创建狼刀技能效果
    const effect = this.createSkillEffect(
      SkillEffectType.KILL,
      SkillPriority.WOLF_KILL,
      SkillTiming.NIGHT_ACTION,
      action.playerId, // 代表狼人阵营
      finalTarget,
      {
        message: `狼人决定刀${finalTarget}号`,
      }
    );

    // 记录狼刀目标
    game.nightActions.wolfKill = finalTarget;
    game.nightActions.wolfSubmitted = true;

    return {
      success: true,
      message: `狼人集体决定刀${finalTarget}号`,
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
