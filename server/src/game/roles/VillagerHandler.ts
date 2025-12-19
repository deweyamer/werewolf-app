import { BaseRoleHandler, RoleActionResult } from './RoleHandler.js';
import { Game, PlayerAction, GamePlayer } from '../../../../shared/src/types.js';

/**
 * 平民Handler
 * 没有特殊技能的好人阵营角色
 */
export class VillagerHandler extends BaseRoleHandler {
  roleId = 'villager';
  roleName = '平民';
  camp = 'good' as const;
  hasNightAction = false;
  hasDayAction = false;
  hasDeathTrigger = false;
  canSkip = false;

  async handleNightAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    return { success: false, message: '平民没有夜间行动' };
  }

  async handleDayAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    return { success: false, message: '平民没有白天行动' };
  }

  getValidTargets(game: Game, playerId: number): number[] {
    return [];
  }

  initializeAbilities(player: GamePlayer): void {
    super.initializeAbilities(player);
  }
}
