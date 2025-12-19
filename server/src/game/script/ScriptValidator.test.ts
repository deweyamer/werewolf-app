import { describe, it, expect, beforeEach } from 'vitest';
import { ScriptValidator } from './ScriptValidator.js';
import { ScriptV2 } from './ScriptTypes.js';

describe('ScriptValidator', () => {
  let validator: ScriptValidator;

  beforeEach(() => {
    validator = new ScriptValidator();
  });

  describe('validate - 总人数验证', () => {
    it('应该接受12人剧本', () => {
      const script: ScriptV2 = {
        id: 'test-12',
        name: '测试剧本',
        description: '12人标准剧本',
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
      };

      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该拒绝人数不足12的剧本', () => {
      const script: ScriptV2 = {
        id: 'test-less',
        name: '人数不足',
        description: '只有10人',
        playerCount: 12,
        roleComposition: {
          wolf: 3,
          nightmare: 1,
          seer: 1,
          witch: 1,
          hunter: 1,
          villager: 3, // 总共10人
        },
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validator.validate(script);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('总人数必须为12人，当前为10人');
    });

    it('应该拒绝人数超过12的剧本', () => {
      const script: ScriptV2 = {
        id: 'test-more',
        name: '人数过多',
        description: '有14人',
        playerCount: 12,
        roleComposition: {
          wolf: 3,
          nightmare: 1,
          seer: 1,
          witch: 1,
          hunter: 1,
          guard: 1,
          villager: 6, // 总共14人
        },
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validator.validate(script);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('总人数必须为12人，当前为14人');
    });
  });

  describe('validate - 阵营平衡验证', () => {
    it('应该接受4狼8好的标准配置', () => {
      const script: ScriptV2 = {
        id: 'test-balanced',
        name: '平衡剧本',
        description: '4狼8好',
        playerCount: 12,
        roleComposition: {
          wolf: 3,
          nightmare: 1, // 4狼
          seer: 1,
          witch: 1,
          hunter: 1,
          guard: 1,
          villager: 4, // 8好
        },
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validator.validate(script);
      expect(result.valid).toBe(true);
    });

    it('应该拒绝狼人数量不足4的剧本', () => {
      const script: ScriptV2 = {
        id: 'test-less-wolf',
        name: '狼人不足',
        description: '只有3狼',
        playerCount: 12,
        roleComposition: {
          wolf: 3, // 只有3狼
          seer: 1,
          witch: 1,
          hunter: 1,
          guard: 1,
          villager: 5, // 9好
        },
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validator.validate(script);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('狼人阵营必须为4人，当前为3人');
    });

    it('应该拒绝好人数量不足8的剧本', () => {
      const script: ScriptV2 = {
        id: 'test-less-good',
        name: '好人不足',
        description: '只有7好',
        playerCount: 12,
        roleComposition: {
          wolf: 4,
          nightmare: 1, // 5狼
          seer: 1,
          witch: 1,
          hunter: 1,
          guard: 1,
          villager: 3, // 7好
        },
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validator.validate(script);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('好人阵营必须为8人，当前为7人');
    });

    it('应该正确识别特殊狼人角色', () => {
      const script: ScriptV2 = {
        id: 'test-special-wolves',
        name: '特殊狼人',
        description: '包含白狼王和狼美人',
        playerCount: 12,
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
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validator.validate(script);
      expect(result.valid).toBe(true);
    });
  });

  describe('validate - 角色存在性验证', () => {
    it('应该拒绝包含未知角色的剧本', () => {
      const script: ScriptV2 = {
        id: 'test-unknown',
        name: '未知角色',
        description: '包含不存在的角色',
        playerCount: 12,
        roleComposition: {
          wolf: 3,
          nightmare: 1,
          seer: 1,
          witch: 1,
          unknown_role: 2, // 不存在的角色
          villager: 4,
        },
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validator.validate(script);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('未知角色'))).toBe(true);
    });
  });

  describe('validate - 角色组合合理性警告', () => {
    it('应该对非4神4民配置发出警告', () => {
      const script: ScriptV2 = {
        id: 'test-unbalanced-gods',
        name: '神职不平衡',
        description: '3神5民',
        playerCount: 12,
        roleComposition: {
          wolf: 3,
          nightmare: 1, // 4狼
          seer: 1,
          witch: 1,
          hunter: 1, // 3神
          villager: 5, // 5民
        },
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('建议配置为4神4民'))).toBe(true);
    });

    it('应该对缺少预言家发出警告', () => {
      const script: ScriptV2 = {
        id: 'test-no-seer',
        name: '无预言家',
        description: '缺少预言家',
        playerCount: 12,
        roleComposition: {
          wolf: 3,
          nightmare: 1, // 4狼
          witch: 1,
          hunter: 1,
          guard: 1,
          knight: 1, // 4神但无预言家
          villager: 4, // 4民
        },
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('预言家'))).toBe(true);
    });

    it('应该对缺少女巫发出警告', () => {
      const script: ScriptV2 = {
        id: 'test-no-witch',
        name: '无女巫',
        description: '缺少女巫',
        playerCount: 12,
        roleComposition: {
          wolf: 3,
          nightmare: 1,
          seer: 1,
          hunter: 1,
          guard: 1,
          knight: 1, // 4神但无女巫
          villager: 4,
        },
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('女巫'))).toBe(true);
    });

    it('应该对特殊狼人过多发出警告', () => {
      const script: ScriptV2 = {
        id: 'test-too-many-special-wolves',
        name: '特殊狼人过多',
        description: '3个特殊狼人',
        playerCount: 12,
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
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('特殊狼人过多'))).toBe(true);
    });
  });

  describe('validate - 规则变体验证', () => {
    it('应该对守卫可连续守护同人发出警告', () => {
      const script: ScriptV2 = {
        id: 'test-guard-rule',
        name: '守卫同守规则',
        description: '守卫可连续守护',
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
        ruleVariants: {
          skillInteractions: {
            guardCanProtectSame: true,
          },
        },
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('守卫可以连续守护同一人'))).toBe(true);
    });

    it('应该对女巫首夜不能自救且无守护角色发出警告', () => {
      const script: ScriptV2 = {
        id: 'test-witch-first-night',
        name: '女巫首夜不自救',
        description: '女巫首夜不能自救且无守护',
        playerCount: 12,
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
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('女巫首夜容易出局'))).toBe(true);
    });
  });

  describe('isValid - 快速验证', () => {
    it('应该对合法剧本返回true', () => {
      const script: ScriptV2 = {
        id: 'test-valid',
        name: '合法剧本',
        description: '标准12人局',
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
      };

      expect(validator.isValid(script)).toBe(true);
    });

    it('应该对非法剧本返回false', () => {
      const script: ScriptV2 = {
        id: 'test-invalid',
        name: '非法剧本',
        description: '人数不对',
        playerCount: 12,
        roleComposition: {
          wolf: 3,
          nightmare: 1,
          seer: 1,
          witch: 1,
          villager: 4, // 只有10人
        },
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(validator.isValid(script)).toBe(false);
    });
  });

  describe('综合测试场景', () => {
    it('应该正确处理复杂的错误和警告组合', () => {
      const script: ScriptV2 = {
        id: 'test-complex',
        name: '复杂场景',
        description: '多重错误',
        playerCount: 12,
        roleComposition: {
          wolf: 2, // 狼人不足（错误）
          nightmare: 1,
          seer: 1,
          hunter: 1,
          guard: 1, // 3神（警告）
          villager: 6, // 6民（警告）
        },
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validator.validate(script);

      // 应该有错误（总人数、狼人数、好人数）
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // 可能还有警告（神职配置）
      if (result.warnings) {
        expect(result.warnings.length).toBeGreaterThan(0);
      }
    });
  });
});
