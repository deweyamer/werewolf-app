import { Game, PlayerAction, GamePlayer } from '../../../../shared/src/types.js';
import { BaseRoleHandler, RoleActionResult } from './RoleHandler.js';
import {
  SkillEffectType,
  SkillPriority,
  SkillTiming,
} from '../skill/SkillTypes.js';

/**
 * 守墓人Handler
 * 夜间验尸，查验前一晚死者的真实身份
 */
export class GravekeeperHandler extends BaseRoleHandler {
  roleId = 'gravekeeper';
  roleName = '守墓人';
  camp = 'good' as const;
  hasNightAction = true;
  hasDayAction = false;
  hasDeathTrigger = false;
  canSkip = true; // 如果没有死者可以跳过

  async handleNightAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    const target = action.target;

    // 获取最近死亡的玩家
    const recentDeaths = game.players.filter(p => !p.alive);
    if (recentDeaths.length === 0) {
      return {
        success: true,
        message: '当前没有死者可以验尸',
      };
    }

    if (!target) {
      return { success: false, message: '必须选择验尸目标' };
    }

    // 检查目标是否已死亡
    const targetPlayer = game.players.find(p => p.playerId === target);
    if (!targetPlayer) {
      return { success: false, message: '目标不存在' };
    }

    if (targetPlayer.alive) {
      return { success: false, message: '只能验尸已死亡的玩家' };
    }

    // 创建验尸技能效果（类似查验）
    const effect = this.createSkillEffect(
      SkillEffectType.CHECK,
      SkillPriority.GRAVEKEEPER,
      SkillTiming.NIGHT_ACTION,
      action.playerId,
      target,
      {
        result: targetPlayer.camp,
        role: targetPlayer.role,
        message: `${target}号的身份是${targetPlayer.role}，阵营是${targetPlayer.camp === 'wolf' ? '狼人' : '好人'}`,
      }
    );

    return {
      success: true,
      message: '验尸成功',
      effect,
      data: {
        playerId: target,
        role: targetPlayer.role,
        camp: targetPlayer.camp,
        message: `${target}号的身份是${targetPlayer.role}`,
      },
    };
  }

  getValidTargets(game: Game, playerId: number): number[] {
    // 所有已死亡的玩家
    return game.players
      .filter(p => !p.alive)
      .map(p => p.playerId);
  }

  initializeAbilities(player: GamePlayer): void {
    super.initializeAbilities(player);
  }
}
