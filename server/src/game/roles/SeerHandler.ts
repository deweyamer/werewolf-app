import { Game, PlayerAction, GamePlayer } from '../../../../shared/src/types.js';
import { BaseRoleHandler, RoleActionResult } from './RoleHandler.js';
import {
  SkillEffectType,
  SkillPriority,
  SkillTiming,
} from '../skill/SkillTypes.js';

/**
 * 预言家Handler
 * 夜间查验一名玩家的身份（狼/好人）
 */
export class SeerHandler extends BaseRoleHandler {
  roleId = 'seer';
  roleName = '预言家';
  camp = 'good' as const;
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

    // 创建查验技能效果
    const effect = this.createSkillEffect(
      SkillEffectType.CHECK,
      SkillPriority.SEER_CHECK,
      SkillTiming.NIGHT_ACTION,
      action.playerId,
      target
    );

    // 立即获取查验结果（在结算器中会再次验证）
    const targetPlayer = game.players.find(p => p.playerId === target)!;
    const checkResult = targetPlayer.camp;

    // 更新nightActions，让上帝可以看到预言家的行动
    game.nightActions.seerCheck = target;
    game.nightActions.seerResult = checkResult;
    game.nightActions.seerSubmitted = true;

    return {
      success: true,
      message: '查验成功',
      effect,
      data: {
        seerResult: {
          playerId: target,
          result: checkResult,
          message: `${target}号是${checkResult === 'wolf' ? '狼人' : '好人'}`,
        },
      },
    };
  }

  getValidTargets(game: Game, playerId: number): number[] {
    return this.getAlivePlayers(game)
      .filter(p => p.playerId !== playerId)
      .map(p => p.playerId);
  }

  initializeAbilities(player: GamePlayer): void {
    super.initializeAbilities(player);
  }
}
