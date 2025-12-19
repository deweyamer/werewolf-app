import { Game, PlayerAction, GamePlayer } from '../../../../shared/src/types.js';
import { BaseRoleHandler, RoleActionResult } from './RoleHandler.js';
import {
  SkillEffectType,
  SkillPriority,
  SkillTiming,
} from '../skill/SkillTypes.js';

/**
 * 骑士Handler
 * 白天可以决斗一名玩家：若为狼则出局，若为好人则骑士死（全局一次）
 */
export class KnightHandler extends BaseRoleHandler {
  roleId = 'knight';
  roleName = '骑士';
  camp = 'good' as const;
  hasNightAction = false;
  hasDayAction = true;
  hasDeathTrigger = false;
  canSkip = true; // 可以不使用

  async handleDayAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    const knight = game.players.find(p => p.playerId === action.playerId);
    if (!knight) {
      return { success: false, message: '骑士不存在' };
    }

    // 检查是否已经使用过决斗
    if (knight.abilities.knightDuelUsed) {
      return { success: false, message: '决斗技能已经使用过了' };
    }

    const target = action.target;

    if (!target) {
      return { success: false, message: '必须选择决斗目标' };
    }

    if (!this.isValidTarget(game, target)) {
      return { success: false, message: '目标无效' };
    }

    // 不能决斗自己
    if (target === action.playerId) {
      return { success: false, message: '不能决斗自己' };
    }

    const targetPlayer = game.players.find(p => p.playerId === target)!;

    // 判断决斗结果
    let duelVictim: number;
    let duelResult: string;

    if (targetPlayer.camp === 'wolf') {
      // 目标是狼人，目标出局
      duelVictim = target;
      duelResult = `决斗成功！${target}号是狼人，出局`;
    } else {
      // 目标是好人，骑士出局
      duelVictim = action.playerId;
      duelResult = `决斗失败！${target}号是好人，骑士出局`;
    }

    // 创建决斗击杀效果
    const effect = this.createSkillEffect(
      SkillEffectType.KILL,
      SkillPriority.KNIGHT_DUEL,
      SkillTiming.DAY_ACTION,
      action.playerId,
      duelVictim,
      {
        message: duelResult,
      }
    );

    // 标记决斗已使用
    knight.abilities.knightDuelUsed = true;

    return {
      success: true,
      message: duelResult,
      effect,
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
    player.abilities.knightDuelUsed = false;
  }
}
