import { ScriptV2, PhaseConfig, NightRolePhase } from './ScriptTypes.js';
import { GamePhase } from '../../../../shared/src/types.js';

/**
 * 剧本阶段生成器
 * 根据剧本的角色组合，动态生成游戏阶段配置
 */
export class ScriptPhaseGenerator {
  // 夜间角色阶段映射（按技能优先级排序）
  private static readonly NIGHT_ROLE_PHASES: NightRolePhase[] = [
    { roleId: 'nightmare', phaseId: 'fear', name: '恐惧阶段', priority: 100 },
    { roleId: 'gargoyle', phaseId: 'gargoyle', name: '石像鬼查验', priority: 150 }, // 独狼，查验具体角色
    { roleId: 'guard', phaseId: 'guard', name: '守卫阶段', priority: 200 },
    { roleId: 'dreamer', phaseId: 'dream', name: '摄梦阶段', priority: 210 },
    { roleId: 'wolf', phaseId: 'wolf', name: '狼人阶段', priority: 300 },
    { roleId: 'white_wolf', phaseId: 'wolf', name: '狼人阶段', priority: 300 }, // 白狼王也参与狼刀
    { roleId: 'black_wolf', phaseId: 'wolf', name: '狼人阶段', priority: 300 }, // 黑狼王也参与狼刀
    // 注意：石像鬼不参与狼刀，是独狼
    { roleId: 'gravekeeper', phaseId: 'gravekeeper', name: '验尸阶段', priority: 350 },
    { roleId: 'witch', phaseId: 'witch', name: '女巫阶段', priority: 400 },
    { roleId: 'seer', phaseId: 'seer', name: '预言家阶段', priority: 500 },
    { roleId: 'wolf_beauty', phaseId: 'wolf_beauty', name: '狼美人阶段', priority: 510 },
  ];

  /**
   * 根据剧本生成完整的phases配置
   */
  generatePhases(script: ScriptV2): PhaseConfig[] {
    const phases: PhaseConfig[] = [];
    let order = 0;

    // ========== 1. 大厅阶段 ==========
    phases.push({
      id: 'lobby',
      name: '大厅',
      description: '等待玩家加入',
      order: order++,
      isNightPhase: false,
    });

    // ========== 2. 动态夜间阶段 ==========
    const nightPhases = this.generateNightPhases(script.roleComposition);
    nightPhases.forEach(phase => {
      phase.order = order++;
      phases.push(phase);
    });

    // ========== 3. 夜间结算 ==========
    phases.push({
      id: 'settle',
      name: '夜间结算',
      description: '结算夜间死亡',
      order: order++,
      isNightPhase: false,
    });

    // ========== 4. 警长竞选（可选） ==========
    if (!script.ruleVariants?.firstNight?.skipSheriffElection) {
      phases.push({
        id: 'sheriffElection',
        name: '警长竞选',
        description: '选举警长',
        order: order++,
        isNightPhase: false,
      });
    }

    // ========== 5. 讨论发言 ==========
    phases.push({
      id: 'discussion',
      name: '讨论发言',
      description: '玩家自由发言',
      order: order++,
      isNightPhase: false,
    });

    // ========== 6. 放逐投票 ==========
    phases.push({
      id: 'vote',
      name: '投票放逐',
      description: '投票放逐一名玩家',
      order: order++,
      isNightPhase: false,
    });

    // ========== 7. 白天结算 ==========
    phases.push({
      id: 'daySettle',
      name: '白天结算',
      description: '结算白天死亡（猎人、黑狼王等）',
      order: order++,
      isNightPhase: false,
    });

    // ========== 8. 游戏结束 ==========
    phases.push({
      id: 'finished',
      name: '游戏结束',
      description: '游戏结束',
      order: order++,
      isNightPhase: false,
    });

    return phases;
  }

  /**
   * 根据角色组合生成夜间阶段
   * 只添加剧本中存在的角色对应的阶段
   */
  private generateNightPhases(roleComposition: { [roleId: string]: number }): PhaseConfig[] {
    const nightPhases: PhaseConfig[] = [];
    const addedPhaseIds = new Set<string>(); // 防止重复添加（如狼人阶段）

    // 遍历所有可能的夜间角色阶段
    for (const { roleId, phaseId, name } of ScriptPhaseGenerator.NIGHT_ROLE_PHASES) {
      // 检查剧本中是否有该角色
      if (roleComposition[roleId] && roleComposition[roleId] > 0) {
        // 防止重复添加同一阶段（如多个狼人角色共享wolf阶段）
        if (addedPhaseIds.has(phaseId)) {
          continue;
        }

        nightPhases.push({
          id: phaseId as GamePhase,
          name,
          description: `${name}行动`,
          order: 0, // 稍后统一分配
          isNightPhase: true,
          actorRole: roleId,
        });

        addedPhaseIds.add(phaseId);
      }
    }

    return nightPhases;
  }

  /**
   * 获取夜间行动的角色列表（按优先级排序）
   */
  getNightActionRoles(roleComposition: { [roleId: string]: number }): string[] {
    const roles: string[] = [];
    const addedRoles = new Set<string>();

    for (const { roleId } of ScriptPhaseGenerator.NIGHT_ROLE_PHASES) {
      if (roleComposition[roleId] && roleComposition[roleId] > 0 && !addedRoles.has(roleId)) {
        roles.push(roleId);
        addedRoles.add(roleId);
      }
    }

    return roles;
  }

  /**
   * 检查某个角色是否在夜间有行动
   */
  hasNightAction(roleId: string): boolean {
    return ScriptPhaseGenerator.NIGHT_ROLE_PHASES.some(phase => phase.roleId === roleId);
  }
}
