import { Game, PlayerAction, GamePlayer } from '../../../../shared/src/types.js';
import { BaseRoleHandler, RoleActionResult } from './RoleHandler.js';
import {
  SkillEffectType,
  SkillPriority,
  SkillTiming,
} from '../skill/SkillTypes.js';

/**
 * 摄梦人Handler
 * 夜间梦游一名玩家：
 * - 连续2晚梦游同一人则梦死
 * - 否则守护该目标免受狼刀
 */
export class DreamerHandler extends BaseRoleHandler {
  roleId = 'dreamer';
  roleName = '摄梦人';
  camp = 'good' as const;
  hasNightAction = true;
  hasDayAction = false;
  hasDeathTrigger = false;
  canSkip = false; // 必须梦游

  async handleNightAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    const dreamer = game.players.find(p => p.playerId === action.playerId);
    if (!dreamer) {
      return { success: false, message: '摄梦人不存在' };
    }

    const target = action.target;

    if (!target) {
      return { success: false, message: '必须选择梦游目标' };
    }

    if (!this.isValidTarget(game, target)) {
      return { success: false, message: '目标无效' };
    }

    // 不能梦游自己
    if (target === action.playerId) {
      return { success: false, message: '不能梦游自己' };
    }

    const lastDreamTarget = dreamer.abilities.lastDreamTarget;

    // 检查是否连续2晚梦游同一人
    if (lastDreamTarget === target) {
      // 连续第二晚梦游同一人，触发梦死
      const effect = this.createSkillEffect(
        SkillEffectType.DREAM_KILL,
        SkillPriority.DREAM,
        SkillTiming.NIGHT_ACTION,
        action.playerId,
        target,
        {
          message: `${target}号被梦死`,
        }
      );

      // 重置梦游记录
      dreamer.abilities.lastDreamTarget = undefined;
      dreamer.abilities.dreamKillReady = false;

      return {
        success: true,
        message: `连续2晚梦游${target}号，触发梦死`,
        effect,
      };
    } else {
      // 第一晚或换了目标，守护该目标
      const effect = this.createSkillEffect(
        SkillEffectType.PROTECT,
        SkillPriority.DREAM,
        SkillTiming.NIGHT_ACTION,
        action.playerId,
        target,
        {
          message: `${target}号受到摄梦人守护`,
        }
      );

      // 更新梦游记录
      dreamer.abilities.lastDreamTarget = target;
      dreamer.abilities.dreamKillReady = false;

      return {
        success: true,
        message: `梦游${target}号（首次，守护生效）`,
        effect,
      };
    }
  }

  getValidTargets(game: Game, playerId: number): number[] {
    // 所有存活玩家（除了自己）
    return this.getAlivePlayers(game)
      .filter(p => p.playerId !== playerId)
      .map(p => p.playerId);
  }

  initializeAbilities(player: GamePlayer): void {
    super.initializeAbilities(player);
    player.abilities.lastDreamTarget = undefined;
    player.abilities.dreamKillReady = false;
  }
}
