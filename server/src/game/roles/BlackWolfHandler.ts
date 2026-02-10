import { Game, PlayerAction, GamePlayer } from '../../../../shared/src/types.js';
import { BaseRoleHandler, RoleActionResult } from './RoleHandler.js';
import {
  SkillEffect,
  SkillEffectType,
  SkillPriority,
  SkillTiming,
  DeathReason,
} from '../skill/SkillTypes.js';

/**
 * 黑狼王Handler
 * 死亡时带走前一位发言者（毒死不触发）
 */
export class BlackWolfHandler extends BaseRoleHandler {
  roleId = 'black_wolf';
  roleName = '黑狼王';
  camp = 'wolf' as const;
  hasNightAction = true; // 参与狼刀
  hasDayAction = false;
  hasDeathTrigger = true; // 死亡触发爆炸
  canSkip = false;

  // 黑狼王参与狼刀（复用普通狼人的逻辑）
  async handleNightAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    return {
      success: true,
      message: '黑狼王参与狼刀投票',
    };
  }

  async onDeath(game: Game, blackWolf: GamePlayer, deathReason: string): Promise<SkillEffect | null> {
    // 只有常规死亡方式可以爆炸：被刀、被投票、被开枪
    const canExplode = [DeathReason.WOLF_KILL, DeathReason.EXILE, DeathReason.HUNTER_SHOOT].includes(deathReason as DeathReason);
    if (!canExplode) {
      return null;
    }

    // 获取前一位发言者
    // 这里需要游戏状态中记录发言顺序
    // 简化处理：由上帝手动指定爆炸目标
    return {
      id: `black-wolf-explode-${blackWolf.playerId}`,
      type: SkillEffectType.EXPLODE,
      priority: SkillPriority.BLACK_WOLF_EXPLOSION,
      timing: SkillTiming.ON_DEATH,
      actorId: blackWolf.playerId,
      targetId: 0, // 待定（上帝指定）
      executed: false,
      blocked: false,
      data: {
        message: `${blackWolf.playerId}号黑狼王可以爆炸带走一人`,
        extraInfo: { pending: true },
      },
    };
  }

  getValidTargets(game: Game, playerId: number): number[] {
    // 黑狼王刀人目标同普通狼人
    return this.getAliveGoodPlayers(game).map(p => p.playerId);
  }

  initializeAbilities(player: GamePlayer): void {
    super.initializeAbilities(player);
  }
}
