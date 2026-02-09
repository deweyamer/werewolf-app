import { ScriptV2, ScriptValidationResult } from './ScriptTypes.js';
import { RoleRegistry } from '../roles/RoleRegistry.js';

/**
 * 剧本验证器
 * 确保剧本配置合法（角色数量、阵营平衡等）
 */
export class ScriptValidator {
  /**
   * 验证剧本配置是否合法
   */
  validate(script: ScriptV2): ScriptValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. 验证总人数
    this.validateTotalPlayers(script, errors);

    // 2. 验证阵营平衡（降级为警告，上帝可自由配置）
    this.validateCampBalance(script, errors, warnings);

    // 3. 验证角色是否存在
    this.validateRolesExist(script, errors);

    // 4. 验证角色组合合理性
    this.validateRoleComposition(script, warnings);

    // 5. 验证规则变体
    this.validateRuleVariants(script, warnings);

    return {
      valid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * 验证总人数（支持9-18人）
   */
  private validateTotalPlayers(script: ScriptV2, errors: string[]): void {
    const totalPlayers = Object.values(script.roleComposition).reduce(
      (sum, count) => sum + count,
      0
    );

    if (totalPlayers < 9 || totalPlayers > 18) {
      errors.push(`总人数必须在9-18人之间，当前为${totalPlayers}人`);
    }

    if (totalPlayers !== script.playerCount) {
      errors.push(`playerCount(${script.playerCount})与角色总数(${totalPlayers})不匹配`);
    }
  }

  /**
   * 验证阵营平衡
   * - 至少1个狼人（error）
   * - 狼人数量建议范围（warning，上帝可自由配置）
   */
  private validateCampBalance(script: ScriptV2, errors: string[], warnings: string[]): void {
    let wolfCount = 0;
    let goodCount = 0;

    for (const [roleId, count] of Object.entries(script.roleComposition)) {
      const handler = RoleRegistry.getHandler(roleId);
      if (!handler) continue;

      if (handler.camp === 'wolf') {
        wolfCount += count;
      } else if (handler.camp === 'good') {
        goodCount += count;
      }
    }

    // 硬约束：必须有狼人
    if (wolfCount === 0) {
      errors.push('必须至少包含1个狼人阵营角色');
    }

    // 软建议：狼人数量范围
    const totalPlayers = wolfCount + goodCount;
    const { minWolves, maxWolves } = this.getBalanceRules(totalPlayers);

    if (wolfCount < minWolves || wolfCount > maxWolves) {
      warnings.push(`${totalPlayers}人局建议狼人数量为${minWolves}-${maxWolves}人，当前为${wolfCount}人`);
    }
  }

  /**
   * 根据总人数获取阵营平衡规则
   */
  private getBalanceRules(playerCount: number): { minWolves: number; maxWolves: number } {
    if (playerCount <= 9) return { minWolves: 2, maxWolves: 3 };
    if (playerCount <= 12) return { minWolves: 3, maxWolves: 4 };
    if (playerCount <= 15) return { minWolves: 4, maxWolves: 5 };
    return { minWolves: 5, maxWolves: 6 }; // 16-18人
  }

  /**
   * 验证角色是否存在于RoleRegistry
   */
  private validateRolesExist(script: ScriptV2, errors: string[]): void {
    for (const roleId of Object.keys(script.roleComposition)) {
      const handler = RoleRegistry.getHandler(roleId);
      if (!handler) {
        errors.push(`未知角色：${roleId}`);
      }
    }
  }

  /**
   * 验证角色组合合理性（警告级别）
   */
  private validateRoleComposition(script: ScriptV2, warnings: string[]): void {
    // 统计神职数量和平民数量
    const godCount = this.countGods(script.roleComposition);
    const villagerCount = script.roleComposition['villager'] || 0;
    const totalPlayers = script.playerCount;

    // 根据总人数计算建议的神职和平民数量
    const suggestedGods = Math.floor((totalPlayers - this.getBalanceRules(totalPlayers).minWolves) / 2);
    const suggestedVillagers = totalPlayers - this.getBalanceRules(totalPlayers).minWolves - suggestedGods;

    // 建议：好人阵营应该是神民平衡
    if (godCount > suggestedGods + 1) {
      warnings.push(`${totalPlayers}人局建议神职不超过${suggestedGods + 1}人，当前为${godCount}神`);
    }

    if (villagerCount < 2) {
      warnings.push(`建议至少配置2个平民，当前为${villagerCount}民`);
    }

    // 检查是否有预言家（强烈建议）
    if (!script.roleComposition['seer']) {
      warnings.push('建议至少包含1个预言家，否则好人信息获取困难');
    }

    // 检查是否有女巫（强烈建议）
    if (!script.roleComposition['witch']) {
      warnings.push('建议至少包含1个女巫，否则好人容错率过低');
    }

    // 检查狼人配置
    const normalWolfCount = script.roleComposition['wolf'] || 0;
    if (normalWolfCount === 0) {
      warnings.push('建议至少包含1个普通狼人');
    }

    // 检查是否有过多特殊狼（根据总狼人数动态计算）
    const specialWolves = ['nightmare', 'wolf_beauty', 'white_wolf', 'black_wolf', 'gargoyle'];
    const specialWolfCount = specialWolves.reduce(
      (sum, roleId) => sum + (script.roleComposition[roleId] || 0),
      0
    );
    const { maxWolves } = this.getBalanceRules(totalPlayers);
    if (specialWolfCount > Math.ceil(maxWolves / 2)) {
      warnings.push(`特殊狼人过多（${specialWolfCount}个），建议不超过${Math.ceil(maxWolves / 2)}个`);
    }
  }

  /**
   * 验证规则变体配置
   */
  private validateRuleVariants(script: ScriptV2, warnings: string[]): void {
    if (!script.ruleVariants) return;

    // 检查守卫同守规则
    if (script.ruleVariants.skillInteractions?.guardCanProtectSame) {
      warnings.push('守卫可以连续守护同一人可能导致游戏失衡');
    }

    // 检查女巫同救同毒规则
    if (script.ruleVariants.skillInteractions?.witchCanSavePoisonSame) {
      warnings.push('女巫可以同夜救毒同一人可能导致混乱');
    }

    // 检查首夜规则
    if (script.ruleVariants.firstNight?.witchCanSaveSelf === false) {
      if (!script.roleComposition['guard'] && !script.roleComposition['dreamer']) {
        warnings.push('女巫首夜不能自救且无守护角色，女巫首夜容易出局');
      }
    }
  }

  /**
   * 统计神职数量（排除平民）
   */
  private countGods(roleComposition: { [roleId: string]: number }): number {
    let count = 0;
    for (const [roleId, num] of Object.entries(roleComposition)) {
      if (roleId === 'villager') continue;

      const handler = RoleRegistry.getHandler(roleId);
      if (handler && handler.camp === 'good') {
        count += num;
      }
    }
    return count;
  }

  /**
   * 快速验证（只返回是否通过，不返回详细错误）
   */
  isValid(script: ScriptV2): boolean {
    const result = this.validate(script);
    return result.valid;
  }
}
