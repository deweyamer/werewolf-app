import { describe, it, expect, beforeEach } from 'vitest';
import { ScriptValidator } from '../../../game/script/ScriptValidator.js';
import { ScriptV2 } from '../../../game/script/ScriptTypes.js';

describe('ScriptValidator', () => {
  let validator: ScriptValidator;

  beforeEach(() => {
    validator = new ScriptValidator();
  });

  // 公共辅助：快速构造剧本
  function makeScript(overrides: Partial<ScriptV2> = {}): ScriptV2 {
    return {
      id: 'test',
      name: '测试剧本',
      description: '测试',
      playerCount: 12,
      roleComposition: {
        wolf: 3,
        nightmare: 1,
        seer: 1,
        witch: 1,
        hunter: 1,
        guard: 1,
        villager: 4,
      },
      difficulty: 'medium',
      tags: [],
      rules: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  // ─────────────────────────────────────────────
  // 总人数验证
  // ─────────────────────────────────────────────
  describe('validate - 总人数验证', () => {
    it('应该接受12人标准剧本', () => {
      const result = validator.validate(makeScript());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该接受9人剧本', () => {
      const script = makeScript({
        playerCount: 9,
        roleComposition: {
          wolf: 2,
          wolf_beauty: 1,
          seer: 1,
          witch: 1,
          hunter: 1,
          villager: 3,
        },
      });
      const result = validator.validate(script);
      expect(result.valid).toBe(true);
    });

    it('应该接受18人剧本', () => {
      const script = makeScript({
        playerCount: 18,
        roleComposition: {
          wolf: 3,
          nightmare: 1,
          wolf_beauty: 1,
          white_wolf: 1,
          seer: 1,
          witch: 1,
          hunter: 1,
          guard: 1,
          dreamer: 1,
          knight: 1,
          villager: 6,
        },
      });
      const result = validator.validate(script);
      expect(result.valid).toBe(true);
    });

    it('应该拒绝人数不足9的剧本', () => {
      const script = makeScript({
        playerCount: 8,
        roleComposition: {
          wolf: 2,
          seer: 1,
          witch: 1,
          villager: 4,
        },
      });
      const result = validator.validate(script);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('总人数必须在9-18人之间，当前为8人');
    });

    it('应该拒绝人数超过18的剧本', () => {
      const script = makeScript({
        playerCount: 19,
        roleComposition: {
          wolf: 5,
          nightmare: 1,
          seer: 1,
          witch: 1,
          hunter: 1,
          guard: 1,
          villager: 9,
        },
      });
      const result = validator.validate(script);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('总人数必须在9-18人之间，当前为19人');
    });

    it('应该拒绝playerCount与角色总数不匹配的剧本', () => {
      const script = makeScript({
        playerCount: 12,
        roleComposition: {
          wolf: 3,
          nightmare: 1,
          seer: 1,
          witch: 1,
          hunter: 1,
          villager: 3, // 总共10人，但playerCount=12
        },
      });
      const result = validator.validate(script);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('playerCount(12)与角色总数(10)不匹配');
    });
  });

  // ─────────────────────────────────────────────
  // 阵营平衡验证（warning级别，非error）
  // ─────────────────────────────────────────────
  describe('validate - 阵营平衡验证', () => {
    it('应该接受标准4狼8好配置（无警告）', () => {
      const result = validator.validate(makeScript());
      expect(result.valid).toBe(true);
      // 标准配置不应该有狼人数量警告
      const wolfWarning = result.warnings?.some(w => w.includes('建议狼人数量'));
      expect(wolfWarning).toBeFalsy();
    });

    it('应该拒绝没有狼人的剧本（error）', () => {
      const script = makeScript({
        roleComposition: {
          seer: 1,
          witch: 1,
          hunter: 1,
          guard: 1,
          knight: 1,
          dreamer: 1,
          gravekeeper: 1,
          villager: 5,
        },
      });
      const result = validator.validate(script);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('必须至少包含1个狼人阵营角色');
    });

    it('狼人数量超出建议范围应产生警告（非error）', () => {
      // 12人局5狼 → 超出建议的3-4范围，但仍valid
      const script = makeScript({
        roleComposition: {
          wolf: 4,
          nightmare: 1, // 5狼
          seer: 1,
          witch: 1,
          hunter: 1,
          guard: 1,
          villager: 3,
        },
      });
      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('建议狼人数量'))).toBe(true);
    });

    it('狼人数量低于建议范围应产生警告（非error）', () => {
      // 12人局2狼 → 低于建议的3-4范围，但仍valid
      const script = makeScript({
        roleComposition: {
          wolf: 2,
          seer: 1,
          witch: 1,
          hunter: 1,
          guard: 1,
          villager: 6,
        },
      });
      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('建议狼人数量'))).toBe(true);
    });

    it('应该正确识别特殊狼人角色', () => {
      const script = makeScript({
        roleComposition: {
          wolf: 2,
          white_wolf: 1,
          wolf_beauty: 1, // 4狼
          seer: 1,
          witch: 1,
          hunter: 1,
          guard: 1,
          villager: 4, // 8好
        },
      });
      const result = validator.validate(script);
      expect(result.valid).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 角色存在性验证
  // ─────────────────────────────────────────────
  describe('validate - 角色存在性验证', () => {
    it('应该拒绝包含未知角色的剧本', () => {
      const script = makeScript({
        roleComposition: {
          wolf: 3,
          nightmare: 1,
          seer: 1,
          witch: 1,
          unknown_role: 2,
          villager: 4,
        },
      });
      const result = validator.validate(script);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('未知角色'))).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 角色组合合理性警告
  // ─────────────────────────────────────────────
  describe('validate - 角色组合合理性警告', () => {
    it('应该对平民过少发出警告', () => {
      // wolf=4 + 7神 + 1民 = 12人，villager=1 < 2 触发警告
      const script = makeScript({
        roleComposition: {
          wolf: 4,
          seer: 1,
          witch: 1,
          hunter: 1,
          guard: 1,
          knight: 1,
          dreamer: 1,
          gravekeeper: 1,
          villager: 1,
        },
      });
      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('平民'))).toBe(true);
    });

    it('应该对缺少预言家发出警告', () => {
      const script = makeScript({
        roleComposition: {
          wolf: 3,
          nightmare: 1,
          witch: 1,
          hunter: 1,
          guard: 1,
          knight: 1,
          villager: 4,
        },
      });
      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('预言家'))).toBe(true);
    });

    it('应该对缺少女巫发出警告', () => {
      const script = makeScript({
        roleComposition: {
          wolf: 3,
          nightmare: 1,
          seer: 1,
          hunter: 1,
          guard: 1,
          knight: 1,
          villager: 4,
        },
      });
      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('女巫'))).toBe(true);
    });

    it('应该对特殊狼人过多发出警告', () => {
      const script = makeScript({
        roleComposition: {
          wolf: 1,
          nightmare: 1,
          wolf_beauty: 1,
          white_wolf: 1, // 4狼，其中3个特殊狼
          seer: 1,
          witch: 1,
          hunter: 1,
          guard: 1,
          villager: 4,
        },
      });
      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('特殊狼人过多'))).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // 规则变体验证
  // ─────────────────────────────────────────────
  describe('validate - 规则变体验证', () => {
    it('应该对守卫可连续守护同人发出警告', () => {
      const script = makeScript({
        ruleVariants: {
          skillInteractions: {
            guardCanProtectSame: true,
          },
        },
      });
      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('守卫可以连续守护同一人'))).toBe(true);
    });

    it('应该对女巫首夜不能自救且无守护角色发出警告', () => {
      const script = makeScript({
        roleComposition: {
          wolf: 3,
          nightmare: 1,
          seer: 1,
          witch: 1,
          hunter: 1,
          knight: 1, // 无守卫和摄梦人
          villager: 4,
        },
        ruleVariants: {
          firstNight: {
            witchCanSaveSelf: false,
          },
        },
      });
      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('女巫首夜容易出局'))).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // isValid 快速验证
  // ─────────────────────────────────────────────
  describe('isValid - 快速验证', () => {
    it('应该对合法剧本返回true', () => {
      expect(validator.isValid(makeScript())).toBe(true);
    });

    it('应该对非法剧本返回false', () => {
      const script = makeScript({
        roleComposition: {
          wolf: 3,
          nightmare: 1,
          seer: 1,
          witch: 1,
          villager: 4, // 只有10人，playerCount=12不匹配
        },
      });
      expect(validator.isValid(script)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────
  // 综合测试场景
  // ─────────────────────────────────────────────
  describe('综合测试场景', () => {
    it('应该正确处理错误和警告组合', () => {
      // playerCount不匹配（error） + 缺少女巫（warning） + 狼人数量超范围（warning）
      const script = makeScript({
        playerCount: 12,
        roleComposition: {
          wolf: 1,       // 只有1狼（警告）
          seer: 1,
          hunter: 1,
          guard: 1,
          villager: 6,   // 总共10人，playerCount=12（错误）
        },
      });
      const result = validator.validate(script);

      // 应该有错误：playerCount不匹配
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // 应该有警告：缺少女巫 + 狼人数量不在建议范围
      expect(result.warnings).toBeDefined();
      expect(result.warnings!.length).toBeGreaterThan(0);
    });

    it('狼人数量不在建议范围但仍然valid', () => {
      // 上帝自定义：12人局6狼6好
      const script = makeScript({
        roleComposition: {
          wolf: 5,
          nightmare: 1, // 6狼
          seer: 1,
          witch: 1,
          hunter: 1,
          villager: 3,  // 6好
        },
      });
      const result = validator.validate(script);

      // 有狼人、人数匹配、角色存在 → valid
      expect(result.valid).toBe(true);
      // 但应该有阵营比例警告
      expect(result.warnings?.some(w => w.includes('建议狼人数量'))).toBe(true);
    });
  });
});
