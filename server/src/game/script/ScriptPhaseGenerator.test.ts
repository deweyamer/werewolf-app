import { describe, it, expect, beforeEach } from 'vitest';
import { ScriptPhaseGenerator } from './ScriptPhaseGenerator.js';
import { ScriptV2 } from './ScriptTypes.js';

describe('ScriptPhaseGenerator', () => {
  let generator: ScriptPhaseGenerator;

  beforeEach(() => {
    generator = new ScriptPhaseGenerator();
  });

  describe('generatePhases - 基础阶段生成', () => {
    it('应该为标准剧本生成完整的阶段序列', () => {
      const script: ScriptV2 = {
        id: 'test-standard',
        name: '标准剧本',
        description: '包含基础角色',
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

      const phases = generator.generatePhases(script);

      // 验证包含关键阶段
      expect(phases.some(p => p.id === 'lobby')).toBe(true);
      expect(phases.some(p => p.id === 'fear')).toBe(true);
      expect(phases.some(p => p.id === 'guard')).toBe(true);
      expect(phases.some(p => p.id === 'wolf')).toBe(true);
      expect(phases.some(p => p.id === 'witch')).toBe(true);
      expect(phases.some(p => p.id === 'seer')).toBe(true);
      expect(phases.some(p => p.id === 'settle')).toBe(true);
      expect(phases.some(p => p.id === 'sheriffElection')).toBe(true);
      expect(phases.some(p => p.id === 'discussion')).toBe(true);
      expect(phases.some(p => p.id === 'vote')).toBe(true);
      expect(phases.some(p => p.id === 'daySettle')).toBe(true);
      expect(phases.some(p => p.id === 'finished')).toBe(true);
    });

    it('应该按正确的order排序阶段', () => {
      const script: ScriptV2 = {
        id: 'test-order',
        name: '顺序测试',
        description: '测试阶段顺序',
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

      const phases = generator.generatePhases(script);

      // 验证order是递增的
      for (let i = 0; i < phases.length - 1; i++) {
        expect(phases[i].order).toBeLessThan(phases[i + 1].order);
      }

      // 验证特定阶段顺序
      const lobbyOrder = phases.find(p => p.id === 'lobby')?.order ?? -1;
      const fearOrder = phases.find(p => p.id === 'fear')?.order ?? -1;
      const wolfOrder = phases.find(p => p.id === 'wolf')?.order ?? -1;
      const settleOrder = phases.find(p => p.id === 'settle')?.order ?? -1;
      const finishedOrder = phases.find(p => p.id === 'finished')?.order ?? -1;

      expect(lobbyOrder).toBeLessThan(fearOrder);
      expect(fearOrder).toBeLessThan(wolfOrder);
      expect(wolfOrder).toBeLessThan(settleOrder);
      expect(settleOrder).toBeLessThan(finishedOrder);
    });
  });

  describe('generatePhases - 夜间阶段优先级', () => {
    it('应该按技能优先级排序夜间阶段', () => {
      const script: ScriptV2 = {
        id: 'test-priority',
        name: '优先级测试',
        description: '测试技能优先级',
        playerCount: 12,
        roleComposition: {
          wolf: 3,
          nightmare: 1, // priority 100
          guard: 1,      // priority 200
          witch: 1,      // priority 400
          seer: 1,       // priority 500
          hunter: 1,
          villager: 4,
        },
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const phases = generator.generatePhases(script);
      const nightPhases = phases.filter(p => p.isNightPhase);

      // 找到各阶段的索引
      const fearIdx = nightPhases.findIndex(p => p.id === 'fear');
      const guardIdx = nightPhases.findIndex(p => p.id === 'guard');
      const wolfIdx = nightPhases.findIndex(p => p.id === 'wolf');
      const witchIdx = nightPhases.findIndex(p => p.id === 'witch');
      const seerIdx = nightPhases.findIndex(p => p.id === 'seer');

      // 验证顺序：fear < guard < wolf < witch < seer
      expect(fearIdx).toBeLessThan(guardIdx);
      expect(guardIdx).toBeLessThan(wolfIdx);
      expect(wolfIdx).toBeLessThan(witchIdx);
      expect(witchIdx).toBeLessThan(seerIdx);
    });

    it('应该将石像鬼阶段放在守卫之前狼刀之前', () => {
      const script: ScriptV2 = {
        id: 'test-gargoyle',
        name: '石像鬼测试',
        description: '测试石像鬼位置',
        playerCount: 12,
        roleComposition: {
          wolf: 3,
          white_wolf: 1,
          gargoyle: 1,   // priority 150 (在guard 200之前)
          guard: 1,
          seer: 1,
          witch: 1,
          hunter: 1,
          villager: 3,
        },
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const phases = generator.generatePhases(script);
      const nightPhases = phases.filter(p => p.isNightPhase);

      const gargoyleIdx = nightPhases.findIndex(p => p.id === 'gargoyle');
      const guardIdx = nightPhases.findIndex(p => p.id === 'guard');
      const wolfIdx = nightPhases.findIndex(p => p.id === 'wolf');

      // 石像鬼应该在守卫之前、狼刀之前（石像鬼需要先石化才能免疫伤害）
      expect(gargoyleIdx).toBeLessThan(guardIdx);
      expect(gargoyleIdx).toBeLessThan(wolfIdx);
    });
  });

  describe('generatePhases - 动态阶段生成', () => {
    it('应该只生成剧本中存在的角色阶段', () => {
      const script: ScriptV2 = {
        id: 'test-minimal',
        name: '最简剧本',
        description: '只有狼人和预言家',
        playerCount: 12,
        roleComposition: {
          wolf: 4,
          seer: 1,
          villager: 7,
        },
        difficulty: 'easy',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const phases = generator.generatePhases(script);

      // 应该包含狼人和预言家阶段
      expect(phases.some(p => p.id === 'wolf')).toBe(true);
      expect(phases.some(p => p.id === 'seer')).toBe(true);

      // 不应该包含不存在的角色阶段
      expect(phases.some(p => p.id === 'fear')).toBe(false);
      expect(phases.some(p => p.id === 'guard')).toBe(false);
      expect(phases.some(p => p.id === 'witch')).toBe(false);
      expect(phases.some(p => p.id === 'dream')).toBe(false);
    });

    it('应该对多个狼人角色只生成一个wolf阶段', () => {
      const script: ScriptV2 = {
        id: 'test-multiple-wolves',
        name: '多狼人',
        description: '包含多种狼人',
        playerCount: 12,
        roleComposition: {
          wolf: 2,
          white_wolf: 1,
          black_wolf: 1, // 3种狼人
          seer: 1,
          witch: 1,
          hunter: 1,
          guard: 1,
          villager: 4,
        },
        difficulty: 'hard',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const phases = generator.generatePhases(script);
      const wolfPhases = phases.filter(p => p.id === 'wolf');

      // 只应该有一个wolf阶段
      expect(wolfPhases.length).toBe(1);
    });

    it('应该包含守墓人阶段（在狼刀和女巫之间）', () => {
      const script: ScriptV2 = {
        id: 'test-gravekeeper',
        name: '守墓人测试',
        description: '包含守墓人',
        playerCount: 12,
        roleComposition: {
          wolf: 3,
          white_wolf: 1,
          gravekeeper: 1, // priority 350
          seer: 1,
          witch: 1,
          hunter: 1,
          gargoyle: 1,
          villager: 3,
        },
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const phases = generator.generatePhases(script);
      const nightPhases = phases.filter(p => p.isNightPhase);

      const wolfIdx = nightPhases.findIndex(p => p.id === 'wolf');
      const gravekeeperIdx = nightPhases.findIndex(p => p.id === 'gravekeeper');
      const witchIdx = nightPhases.findIndex(p => p.id === 'witch');

      // 守墓人应该在狼刀之后、女巫之前
      expect(wolfIdx).toBeLessThan(gravekeeperIdx);
      expect(gravekeeperIdx).toBeLessThan(witchIdx);
    });
  });

  describe('generatePhases - 规则变体', () => {
    it('应该在跳过警长竞选时不生成sheriffElection阶段', () => {
      const script: ScriptV2 = {
        id: 'test-no-sheriff',
        name: '无警长',
        description: '跳过警长竞选',
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
          firstNight: {
            skipSheriffElection: true,
          },
        },
        difficulty: 'medium',
        tags: [],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const phases = generator.generatePhases(script);

      // 不应该包含警长竞选阶段
      expect(phases.some(p => p.id === 'sheriffElection')).toBe(false);
    });

    it('应该默认包含sheriffElection阶段', () => {
      const script: ScriptV2 = {
        id: 'test-default-sheriff',
        name: '默认警长',
        description: '默认包含警长竞选',
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

      const phases = generator.generatePhases(script);

      // 应该包含警长竞选阶段
      expect(phases.some(p => p.id === 'sheriffElection')).toBe(true);
    });
  });

  describe('getNightActionRoles', () => {
    it('应该返回夜间有行动的角色列表', () => {
      const roleComposition = {
        wolf: 3,
        nightmare: 1,
        seer: 1,
        witch: 1,
        hunter: 1, // 猎人没有夜间行动
        guard: 1,
        villager: 4, // 平民没有夜间行动
      };

      const nightRoles = generator.getNightActionRoles(roleComposition);

      // 应该包含夜间行动角色
      expect(nightRoles).toContain('nightmare');
      expect(nightRoles).toContain('guard');
      expect(nightRoles).toContain('wolf');
      expect(nightRoles).toContain('witch');
      expect(nightRoles).toContain('seer');

      // 不应该包含没有夜间行动的角色
      expect(nightRoles).not.toContain('hunter');
      expect(nightRoles).not.toContain('villager');
    });

    it('应该按优先级顺序返回角色', () => {
      const roleComposition = {
        seer: 1,       // priority 500
        wolf: 3,       // priority 300
        nightmare: 1,  // priority 100
        witch: 1,      // priority 400
        guard: 1,      // priority 200
        villager: 5,
      };

      const nightRoles = generator.getNightActionRoles(roleComposition);

      // 验证顺序
      const nightmareIdx = nightRoles.indexOf('nightmare');
      const guardIdx = nightRoles.indexOf('guard');
      const wolfIdx = nightRoles.indexOf('wolf');
      const witchIdx = nightRoles.indexOf('witch');
      const seerIdx = nightRoles.indexOf('seer');

      expect(nightmareIdx).toBeLessThan(guardIdx);
      expect(guardIdx).toBeLessThan(wolfIdx);
      expect(wolfIdx).toBeLessThan(witchIdx);
      expect(witchIdx).toBeLessThan(seerIdx);
    });

    it('应该处理空角色组合', () => {
      const roleComposition = {
        villager: 12,
      };

      const nightRoles = generator.getNightActionRoles(roleComposition);

      expect(nightRoles).toHaveLength(0);
    });
  });

  describe('hasNightAction', () => {
    it('应该正确识别有夜间行动的角色', () => {
      expect(generator.hasNightAction('nightmare')).toBe(true);
      expect(generator.hasNightAction('guard')).toBe(true);
      expect(generator.hasNightAction('dreamer')).toBe(true);
      expect(generator.hasNightAction('wolf')).toBe(true);
      expect(generator.hasNightAction('witch')).toBe(true);
      expect(generator.hasNightAction('seer')).toBe(true);
      expect(generator.hasNightAction('wolf_beauty')).toBe(true);
    });

    it('应该正确识别没有夜间行动的角色', () => {
      expect(generator.hasNightAction('hunter')).toBe(false);
      expect(generator.hasNightAction('knight')).toBe(false);
      expect(generator.hasNightAction('villager')).toBe(false);
    });

    it('应该对未知角色返回false', () => {
      expect(generator.hasNightAction('unknown_role')).toBe(false);
    });
  });

  describe('综合场景测试', () => {
    it('应该为复杂剧本生成正确的阶段序列', () => {
      const script: ScriptV2 = {
        id: 'test-complex',
        name: '复杂剧本',
        description: '包含所有夜间角色',
        playerCount: 12,
        roleComposition: {
          nightmare: 1,
          wolf: 2,
          wolf_beauty: 1, // 4狼
          gargoyle: 1,
          guard: 1,
          dreamer: 1,
          gravekeeper: 1,
          seer: 1,
          witch: 1,
          hunter: 1,
          villager: 2, // 8好
        },
        difficulty: 'hard',
        tags: ['复杂', '多角色'],
        rules: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const phases = generator.generatePhases(script);
      const nightPhases = phases.filter(p => p.isNightPhase);

      // 验证所有夜间阶段都存在
      expect(nightPhases.some(p => p.id === 'fear')).toBe(true);
      expect(nightPhases.some(p => p.id === 'gargoyle')).toBe(true);
      expect(nightPhases.some(p => p.id === 'guard')).toBe(true);
      expect(nightPhases.some(p => p.id === 'dream')).toBe(true);
      expect(nightPhases.some(p => p.id === 'wolf')).toBe(true);
      expect(nightPhases.some(p => p.id === 'gravekeeper')).toBe(true);
      expect(nightPhases.some(p => p.id === 'witch')).toBe(true);
      expect(nightPhases.some(p => p.id === 'seer')).toBe(true);
      expect(nightPhases.some(p => p.id === 'wolf_beauty')).toBe(true);

      // 验证完整的阶段序列
      expect(phases[0].id).toBe('lobby');
      expect(phases[phases.length - 1].id).toBe('finished');
    });
  });
});
