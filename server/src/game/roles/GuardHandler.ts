import { Game, PlayerAction, GamePlayer } from '../../../../shared/src/types.js';
import { BaseRoleHandler, RoleActionResult } from './RoleHandler.js';
import {
  SkillEffectType,
  SkillPriority,
  SkillTiming,
} from '../skill/SkillTypes.js';

/**
 * 守卫Handler
 * 夜间守护一名玩家，使其免受狼刀（不能连续守护同一人）
 */
export class GuardHandler extends BaseRoleHandler {
  roleId = 'guard';
  roleName = '守卫';
  camp = 'good' as const;
  hasNightAction = true;
  hasDayAction = false;
  hasDeathTrigger = false;
  canSkip = false; // 必须守护

  async handleNightAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    const guard = game.players.find(p => p.playerId === action.playerId);
    if (!guard) {
      return { success: false, message: '守卫不存在' };
    }

    const target = action.target;

    if (!target) {
      return { success: false, message: '必须选择守护目标' };
    }

    // 检查目标是否存在且存活
    const targetPlayer = game.players.find(p => p.playerId === target);
    if (!targetPlayer) {
      return { success: false, message: '目标不存在' };
    }
    if (!targetPlayer.alive) {
      return { success: false, message: '目标已死亡' };
    }

    // 检查是否连续守护同一人
    if (guard.abilities.lastGuardTarget === target) {
      return { success: false, message: '不能连续守护同一人' };
    }

    // 创建守护技能效果
    const effect = this.createSkillEffect(
      SkillEffectType.PROTECT,
      SkillPriority.GUARD,
      SkillTiming.NIGHT_ACTION,
      action.playerId,
      target
    );

    // 更新上次守护目标
    guard.abilities.lastGuardTarget = target;

    // 更新nightActions，让上帝可以看到守卫的行动
    game.nightActions.guardTarget = target;
    game.nightActions.guardSubmitted = true;

    return {
      success: true,
      message: `守护${target}号`,
      effect,
    };
  }

  getValidTargets(game: Game, playerId: number): number[] {
    const guard = game.players.find(p => p.playerId === playerId);
    const lastTarget = guard?.abilities.lastGuardTarget;

    // 所有存活玩家，但排除上次守护的目标
    return this.getAlivePlayers(game)
      .filter(p => p.playerId !== lastTarget)
      .map(p => p.playerId);
  }

  initializeAbilities(player: GamePlayer): void {
    super.initializeAbilities(player);
    player.abilities.lastGuardTarget = undefined;
  }
}
