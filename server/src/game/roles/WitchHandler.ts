import { Game, PlayerAction, GamePlayer } from '../../../../shared/src/types.js';
import { BaseRoleHandler, RoleActionResult } from './RoleHandler.js';
import {
  SkillEffectType,
  SkillPriority,
  SkillTiming,
} from '../skill/SkillTypes.js';

/**
 * 女巫Handler
 * 夜间可以使用解药救人或毒药毒人（各一瓶，全局各使用一次）
 */
export class WitchHandler extends BaseRoleHandler {
  roleId = 'witch';
  roleName = '女巫';
  camp = 'good' as const;
  hasNightAction = true;
  hasDayAction = false;
  hasDeathTrigger = false;
  canSkip = true; // 可以跳过不使用

  async handleNightAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    const witch = game.players.find(p => p.playerId === action.playerId);
    if (!witch) {
      return { success: false, message: '女巫不存在' };
    }

    const actionType = action.actionType; // 'none' | 'save' | 'poison'
    const target = action.target;

    // 女巫已经提交过操作，不能再次提交（防止先毒再救的exploit）
    if (game.nightActions.witchSubmitted && actionType !== 'none') {
      return { success: false, message: '女巫本轮已提交操作，不能再次使用技能' };
    }

    // 只有解药还在时才告知被刀者
    let victimInfo = game.nightActions.wolfKill;
    if (victimInfo && !game.nightActions.witchKnowsVictim && witch.abilities.antidote) {
      game.nightActions.witchKnowsVictim = victimInfo;
    }

    // 跳过不使用
    if (actionType === 'none') {
      game.nightActions.witchSubmitted = true;
      return {
        success: true,
        message: '女巫跳过不使用技能',
        data: { victimInfo: game.nightActions.witchKnowsVictim },
      };
    }

    // 使用解药救人
    if (actionType === 'save') {
      if (!witch.abilities.antidote) {
        return { success: false, message: '解药已经使用过了' };
      }

      const wolfKillTarget = game.nightActions.wolfKill;
      if (!wolfKillTarget) {
        return { success: false, message: '今晚没有人被狼刀' };
      }

      // 12人及以上局，首夜女巫不能自救
      if (wolfKillTarget === action.playerId && game.currentRound === 1 && game.players.length >= 12) {
        return { success: false, message: '12人及以上局首夜女巫不能自救' };
      }

      // 创建救人技能效果
      const effect = this.createSkillEffect(
        SkillEffectType.SAVE,
        SkillPriority.WITCH_ANTIDOTE,
        SkillTiming.NIGHT_ACTION,
        action.playerId,
        wolfKillTarget
      );

      // 标记解药已使用
      witch.abilities.antidote = false;
      game.nightActions.witchAction = 'save';
      game.nightActions.witchSubmitted = true;

      return {
        success: true,
        message: '使用解药救人',
        effect,
        data: { victimInfo: game.nightActions.witchKnowsVictim },
      };
    }

    // 使用毒药毒人
    if (actionType === 'poison') {
      if (!witch.abilities.poison) {
        return { success: false, message: '毒药已经使用过了' };
      }

      if (!target) {
        return { success: false, message: '必须选择毒杀目标' };
      }

      if (!this.isValidTarget(game, target)) {
        return { success: false, message: '目标无效' };
      }

      // 不能同一晚又救又毒
      if (game.nightActions.witchAction === 'save') {
        return { success: false, message: '不能同一晚又救又毒' };
      }

      // 创建毒杀技能效果
      const effect = this.createSkillEffect(
        SkillEffectType.KILL,
        SkillPriority.WITCH_POISON,
        SkillTiming.NIGHT_ACTION,
        action.playerId,
        target
      );

      // 标记毒药已使用
      witch.abilities.poison = false;
      game.nightActions.witchAction = 'poison';
      game.nightActions.witchTarget = target;
      game.nightActions.witchSubmitted = true;

      return {
        success: true,
        message: '使用毒药毒人',
        effect,
        data: { victimInfo: game.nightActions.witchKnowsVictim },
      };
    }

    return { success: false, message: '无效的操作类型' };
  }

  getValidTargets(game: Game, playerId: number): number[] {
    // 女巫可以毒所有存活玩家
    return this.getAlivePlayers(game).map(p => p.playerId);
  }

  initializeAbilities(player: GamePlayer): void {
    super.initializeAbilities(player);
    player.abilities.antidote = true;
    player.abilities.poison = true;
  }
}
