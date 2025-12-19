import { Game, PlayerAction, GamePlayer } from '../../../../shared/src/types.js';
import { BaseRoleHandler, RoleActionResult } from './RoleHandler.js';
import {
  SkillEffectType,
  SkillPriority,
  SkillTiming,
} from '../skill/SkillTypes.js';

/**
 * 石像鬼Handler（独狼）
 * - 狼人阵营，但不参与刀人，不与小狼夜晚见面
 * - 每晚可以查验一名玩家的具体角色（比预言家更强，能看到具体角色名）
 * - 只要小狼未全死，石像鬼不带刀
 * - 是狼队的大哥，拥有强大的信息获取能力
 */
export class GargoyleHandler extends BaseRoleHandler {
  roleId = 'gargoyle';
  roleName = '石像鬼';
  camp = 'wolf' as const;
  hasNightAction = true;
  hasDayAction = false;
  hasDeathTrigger = false;
  canSkip = false; // 必须查验

  async handleNightAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    const target = action.target;

    if (!target) {
      return { success: false, message: '必须选择查验目标' };
    }

    if (!this.isValidTarget(game, target)) {
      return { success: false, message: '目标无效' };
    }

    // 不能查验自己
    if (target === action.playerId) {
      return { success: false, message: '不能查验自己' };
    }

    const targetPlayer = game.players.find(p => p.playerId === target);
    if (!targetPlayer) {
      return { success: false, message: '目标玩家不存在' };
    }

    // 石像鬼查验，返回具体角色名（比预言家强）
    const effect = this.createSkillEffect(
      SkillEffectType.CHECK,
      SkillPriority.GARGOYLE_CHECK,
      SkillTiming.NIGHT_ACTION,
      action.playerId,
      target,
      {
        message: `${target}号的角色是：${targetPlayer.role}`,
        checkResult: targetPlayer.role, // 返回具体角色名
        camp: targetPlayer.camp,
      }
    );

    return {
      success: true,
      message: `查验${target}号，角色是：${targetPlayer.role}`,
      effect,
      data: {
        role: targetPlayer.role,
        camp: targetPlayer.camp,
      },
    };
  }

  getValidTargets(game: Game, playerId: number): number[] {
    // 所有存活玩家（除了自己）
    return this.getAlivePlayers(game)
      .filter(p => p.playerId !== playerId)
      .map(p => p.playerId);
  }

  initializeAbilities(player: GamePlayer): void {
    super.initializeAbilities(player);
  }
}
