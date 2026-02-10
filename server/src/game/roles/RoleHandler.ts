import { v4 as uuidv4 } from 'uuid';
import { Game, PlayerAction, GamePlayer, Camp } from '../../../../shared/src/types.js';
import {
  SkillEffect,
  SkillEffectType,
  SkillPriority,
  SkillTiming,
} from '../skill/SkillTypes.js';

/**
 * 角色行动结果（新版）
 */
export interface RoleActionResult {
  success: boolean;
  message: string;
  effect?: SkillEffect | null;  // 生成的技能效果
  data?: any;                     // 额外数据（如查验结果）
}

/**
 * 角色Handler接口（V2版本 - 基于技能系统重构）
 */
export interface IRoleHandler {
  // 角色基本信息
  roleId: string;
  roleName: string;
  camp: Camp;

  // 技能配置
  hasNightAction: boolean;        // 是否有夜间行动
  hasDayAction: boolean;          // 是否有白天行动
  hasDeathTrigger: boolean;       // 是否有死亡触发技能

  // 处理夜间行动（返回技能效果）
  handleNightAction(game: Game, action: PlayerAction): Promise<RoleActionResult>;

  // 处理白天行动（返回技能效果）
  handleDayAction(game: Game, action: PlayerAction): Promise<RoleActionResult>;

  // 死亡触发（返回技能效果，如猎人开枪）
  onDeath(game: Game, player: GamePlayer, deathReason: string): Promise<SkillEffect | null>;

  // 获取有效目标列表
  getValidTargets(game: Game, playerId: number): number[];

  // 是否可以跳过行动
  canSkip: boolean;

  // 初始化角色技能
  initializeAbilities(player: GamePlayer): void;
}

/**
 * 基础角色Handler抽象类
 */
export abstract class BaseRoleHandler implements IRoleHandler {
  abstract roleId: string;
  abstract roleName: string;
  abstract camp: Camp;
  abstract hasNightAction: boolean;
  abstract hasDayAction: boolean;
  abstract hasDeathTrigger: boolean;
  abstract canSkip: boolean;

  // 默认实现：夜间行动
  async handleNightAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    return {
      success: false,
      message: '该角色没有夜间行动',
    };
  }

  // 默认实现：白天行动（狼人阵营通用自爆）
  async handleDayAction(game: Game, action: PlayerAction): Promise<RoleActionResult> {
    // 狼人阵营通用自爆逻辑
    if (this.camp === 'wolf' && action.actionType === 'boom') {
      const wolf = game.players.find(p => p.playerId === action.playerId);
      if (!wolf || !wolf.alive) {
        return { success: false, message: '玩家不存在或已死亡' };
      }

      // 创建自爆效果
      const effect = this.createSkillEffect(
        SkillEffectType.SELF_DESTRUCT,
        SkillPriority.WHITE_WOLF_BOOM,
        SkillTiming.DAY_ACTION,
        action.playerId,
        action.playerId,
        {
          message: `${this.roleName}${action.playerId}号自爆，直接进入黑夜`,
          skipToNight: true,
        }
      );

      // 处理警徽
      const wasSheriff = wolf.isSheriff;
      if (wasSheriff) {
        const validTargets = game.players
          .filter(p => p.alive && p.playerId !== action.playerId)
          .map(p => p.playerId);
        game.sheriffBadgeState = 'pending_assign';
        game.pendingSheriffTransfer = {
          fromPlayerId: action.playerId,
          options: validTargets,
          reason: 'wolf_explosion',
        };
        wolf.isSheriff = false;
        game.sheriffId = 0;
      }

      // 自爆死亡
      wolf.alive = false;
      wolf.outReason = 'self_destruct';

      return {
        success: true,
        message: `${this.roleName}自爆成功`,
        effect,
        data: {
          skipToNight: true,
          sheriffPendingAssign: wasSheriff,
        },
      };
    }

    // 狼人阵营跳过自爆
    if (this.camp === 'wolf' && action.actionType === 'skip') {
      return {
        success: true,
        message: `${this.roleName}跳过不自爆`,
      };
    }

    return {
      success: false,
      message: '该角色没有白天行动',
    };
  }

  // 默认实现：死亡触发
  async onDeath(game: Game, player: GamePlayer, deathReason: string): Promise<SkillEffect | null> {
    return null;
  }

  // 默认实现：获取有效目标
  getValidTargets(game: Game, playerId: number): number[] {
    return [];
  }

  // 默认实现：初始化技能
  initializeAbilities(player: GamePlayer): void {
    player.abilities.hasNightAction = this.hasNightAction;
  }

  // 工具方法：创建技能效果
  protected createSkillEffect(
    type: SkillEffectType,
    priority: SkillPriority,
    timing: SkillTiming,
    actorId: number,
    targetId: number,
    data?: any
  ): SkillEffect {
    return {
      id: uuidv4(),
      type,
      priority,
      timing,
      actorId,
      targetId,
      executed: false,
      blocked: false,
      data,
    };
  }

  // 工具方法：检查目标是否有效
  protected isValidTarget(game: Game, targetId: number, includeDead: boolean = false): boolean {
    const target = game.players.find(p => p.playerId === targetId);
    if (!target) return false;
    if (!includeDead && !target.alive) return false;
    return true;
  }

  // 工具方法：获取所有存活玩家
  protected getAlivePlayers(game: Game): GamePlayer[] {
    return game.players.filter(p => p.alive);
  }

  // 工具方法：获取所有存活好人
  protected getAliveGoodPlayers(game: Game): GamePlayer[] {
    return game.players.filter(p => p.alive && p.camp === 'good');
  }

  // 工具方法：获取所有存活狼人
  protected getAliveWolfPlayers(game: Game): GamePlayer[] {
    return game.players.filter(p => p.alive && p.camp === 'wolf');
  }
}
