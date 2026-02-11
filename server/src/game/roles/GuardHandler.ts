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
  canSkip = true; // 可以放弃守护

  async handleNightAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    const guard = game.players.find(p => p.playerId === action.playerId);
    if (!guard) {
      return { success: false, message: '守卫不存在' };
    }

    // 防止同一晚重复提交
    if (game.nightActions.guardSubmitted) {
      return { success: false, message: '守卫本轮已提交操作' };
    }

    if (!guard.abilities.guardHistory) {
      guard.abilities.guardHistory = [];
    }

    const target = action.target;

    // 放弃守护：记录 0 表示空手
    if (!target || action.actionType === 'skip') {
      guard.abilities.lastGuardTarget = 0;
      guard.abilities.guardHistory.push(0);
      game.nightActions.guardTarget = 0;
      game.nightActions.guardSubmitted = true;
      return { success: true, message: '守卫放弃守护' };
    }

    // 检查目标是否存在且存活
    const targetPlayer = game.players.find(p => p.playerId === target);
    if (!targetPlayer) {
      return { success: false, message: '目标不存在' };
    }
    if (!targetPlayer.alive) {
      return { success: false, message: '目标已死亡' };
    }

    // 检查是否连续守护同一人（用 lastGuardTarget 判断，0 表示空手不受限制）
    if (guard.abilities.lastGuardTarget && guard.abilities.lastGuardTarget === target) {
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

    // 更新上次守护目标和历史记录
    guard.abilities.lastGuardTarget = target;
    guard.abilities.guardHistory.push(target);

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

    // 所有存活玩家，但排除上次守护的目标（0 表示空手，不排除任何人）
    return this.getAlivePlayers(game)
      .filter(p => !lastTarget || p.playerId !== lastTarget)
      .map(p => p.playerId);
  }

  initializeAbilities(player: GamePlayer): void {
    super.initializeAbilities(player);
    player.abilities.lastGuardTarget = 0;
    player.abilities.guardHistory = [];
  }
}
