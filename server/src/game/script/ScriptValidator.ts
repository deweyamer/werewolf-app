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

    // 2. 验证阵营平衡
    this.validateCampBalance(script, errors);

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
   * 验证总人数（必须为12人）
   */
  private validateTotalPlayers(script: ScriptV2, errors: string[]): void {
    const totalPlayers = Object.values(script.roleComposition).reduce(
      (sum, count) => sum + count,
      0
    );

    if (totalPlayers !== 12) {
      errors.push(`总人数必须为12人，当前为${totalPlayers}人`);
    }
  }

  /**
   * 验证阵营平衡（4狼8好人）
   */
  private validateCampBalance(script: ScriptV2, errors: string[]): void {
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

    if (wolfCount !== 4) {
      errors.push(`狼人阵营必须为4人，当前为${wolfCount}人`);
    }

    if (goodCount !== 8) {
      errors.push(`好人阵营必须为8人，当前为${goodCount}人`);
    }
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
    // 统计神职数量
    const godCount = this.countGods(script.roleComposition);
    const villagerCount = script.roleComposition['villager'] || 0;

    // 建议：好人阵营应该是4神4民
    if (godCount !== 4 || villagerCount !== 4) {
      warnings.push(`建议配置为4神4民，当前为${godCount}神${villagerCount}民`);
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

    // 检查是否有过多特殊狼
    const specialWolves = ['nightmare', 'wolf_beauty', 'white_wolf', 'black_wolf'];
    const specialWolfCount = specialWolves.reduce(
      (sum, roleId) => sum + (script.roleComposition[roleId] || 0),
      0
    );
    if (specialWolfCount > 2) {
      warnings.push(`特殊狼人过多（${specialWolfCount}个），可能导致狼人过强`);
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
