import { Game, PlayerAction, GamePlayer } from '../../../../shared/src/types.js';
import { BaseRoleHandler, RoleActionResult } from './RoleHandler.js';
import {
  SkillEffectType,
  SkillPriority,
  SkillTiming,
} from '../skill/SkillTypes.js';

/**
 * 守墓人Handler
 * 自动获得上一轮被投票出局玩家的阵营（好人/坏人）
 * 无需手动选择目标，被动获取信息
 */
export class GravekeeperHandler extends BaseRoleHandler {
  roleId = 'gravekeeper';
  roleName = '守墓人';
  camp = 'good' as const;
  hasNightAction = true;
  hasDayAction = false;
  hasDeathTrigger = false;
  canSkip = true;

  /**
   * 查找上一轮被投票出局的玩家
   */
  private findLastExiledPlayer(game: Game): GamePlayer | null {
    const prevRound = game.currentRound - 1;
    if (prevRound < 1 || !game.roundHistory) return null;

    const prevEntry = game.roundHistory.find(h => h.round === prevRound);
    if (!prevEntry?.exileVote?.result || typeof prevEntry.exileVote.result !== 'number') {
      return null;
    }

    const exiledId = prevEntry.exileVote.result;
    return game.players.find(p => p.playerId === exiledId) || null;
  }

  async handleNightAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    // 守墓人自动获取上一轮被投票出局者的阵营
    const exiledPlayer = this.findLastExiledPlayer(game);

    if (!exiledPlayer) {
      return {
        success: true,
        message: '上一轮没有玩家被投票出局',
        data: {
          gravekeeperResult: {
            hasExile: false,
            message: '上一轮没有玩家被投票出局，无验尸信息',
          },
        },
      };
    }

    const campLabel = exiledPlayer.camp === 'wolf' ? '坏人' : '好人';

    // 创建验尸技能效果
    const effect = this.createSkillEffect(
      SkillEffectType.CHECK,
      SkillPriority.GRAVEKEEPER,
      SkillTiming.NIGHT_ACTION,
      action.playerId,
      exiledPlayer.playerId,
      {
        result: exiledPlayer.camp,
        message: `${exiledPlayer.playerId}号是${campLabel}`,
      }
    );

    return {
      success: true,
      message: '验尸成功',
      effect,
      data: {
        gravekeeperResult: {
          hasExile: true,
          playerId: exiledPlayer.playerId,
          camp: exiledPlayer.camp,
          message: `${exiledPlayer.playerId}号是${campLabel}`,
        },
      },
    };
  }

  getValidTargets(game: Game, playerId: number): number[] {
    // 守墓人无需选择目标，返回空
    return [];
  }

  initializeAbilities(player: GamePlayer): void {
    super.initializeAbilities(player);
  }
}
