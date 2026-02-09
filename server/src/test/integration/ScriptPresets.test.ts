import { describe, it, expect } from 'vitest';
import { ScriptPresets } from '../../game/script/ScriptPresets.js';
import { ScriptValidator } from '../../game/script/ScriptValidator.js';
import { ScriptPhaseGenerator } from '../../game/script/ScriptPhaseGenerator.js';
import { RoleRegistry } from '../../game/roles/RoleRegistry.js';

describe('ScriptPresets', () => {
  const validator = new ScriptValidator();
  const phaseGenerator = new ScriptPhaseGenerator();

  describe('getAllPresets', () => {
    it('应该返回7个预设剧本', () => {
      const presets = ScriptPresets.getAllPresets();
      expect(presets).toHaveLength(7);
    });

    it('所有预设剧本都应该有唯一ID', () => {
      const presets = ScriptPresets.getAllPresets();
      const ids = presets.map(p => p.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(presets.length);
    });
  });

  describe('getById', () => {
    it('应该能通过ID获取摄梦人剧本', () => {
      const script = ScriptPresets.getById('dreamer-nightmare');
      expect(script).toBeDefined();
      expect(script?.name).toBe('摄梦人剧本');
    });

    it('应该能通过ID获取骑士狼美人剧本', () => {
      const script = ScriptPresets.getById('knight-beauty');
      expect(script).toBeDefined();
      expect(script?.name).toBe('骑士狼美人剧本');
    });

    it('应该能通过ID获取守墓人石像鬼剧本', () => {
      const script = ScriptPresets.getById('gravekeeper-gargoyle');
      expect(script).toBeDefined();
      expect(script?.name).toBe('守墓人石像鬼剧本');
    });

    it('应该对不存在的ID返回undefined', () => {
      const script = ScriptPresets.getById('non-existent');
      expect(script).toBeUndefined();
    });
  });

  describe('DREAMER_SCRIPT - 摄梦人剧本', () => {
    const script = ScriptPresets.DREAMER_SCRIPT;

    it('应该是合法的12人剧本', () => {
      expect(script.playerCount).toBe(12);
      const totalPlayers = Object.values(script.roleComposition).reduce((sum, count) => sum + count, 0);
      expect(totalPlayers).toBe(12);
    });

    it('应该通过剧本验证', () => {
      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该包含正确的角色配置（摄梦人、预言家、女巫、猎人、噩梦之影、3狼、4民）', () => {
      expect(script.roleComposition.dreamer).toBe(1);
      expect(script.roleComposition.seer).toBe(1);
      expect(script.roleComposition.witch).toBe(1);
      expect(script.roleComposition.hunter).toBe(1);
      expect(script.roleComposition.nightmare).toBe(1);
      expect(script.roleComposition.wolf).toBe(3);
      expect(script.roleComposition.villager).toBe(4);
    });

    it('应该有4狼8好的阵营平衡', () => {
      const wolfCount = (script.roleComposition.nightmare ?? 0) + (script.roleComposition.wolf ?? 0);
      const totalPlayers = Object.values(script.roleComposition).reduce((sum, count) => sum + count, 0);
      const goodCount = totalPlayers - wolfCount;

      expect(wolfCount).toBe(4);
      expect(goodCount).toBe(8);
    });

    it('应该配置摄梦人连续两晚梦死规则', () => {
      expect(script.ruleVariants?.skillInteractions?.dreamerKillNights).toBe(2);
    });

    it('应该能生成完整的阶段配置', () => {
      const phases = phaseGenerator.generatePhases(script);

      // 验证包含摄梦人和噩梦之影的特殊阶段
      expect(phases.some(p => p.id === 'dream')).toBe(true);
      expect(phases.some(p => p.id === 'fear')).toBe(true);
      expect(phases.some(p => p.id === 'wolf')).toBe(true);
      expect(phases.some(p => p.id === 'witch')).toBe(true);
      expect(phases.some(p => p.id === 'seer')).toBe(true);
    });

    it('应该标记为medium难度', () => {
      expect(script.difficulty).toBe('medium');
    });

    it('应该包含合适的标签', () => {
      expect(script.tags).toContain('摄梦人');
      expect(script.tags).toContain('噩梦之影');
    });
  });

  describe('KNIGHT_BEAUTY_SCRIPT - 骑士狼美人剧本', () => {
    const script = ScriptPresets.KNIGHT_BEAUTY_SCRIPT;

    it('应该是合法的12人剧本', () => {
      expect(script.playerCount).toBe(12);
      const totalPlayers = Object.values(script.roleComposition).reduce((sum, count) => sum + count, 0);
      expect(totalPlayers).toBe(12);
    });

    it('应该通过剧本验证', () => {
      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该包含正确的角色配置（骑士、预言家、女巫、守卫、狼美人、3狼、4民）', () => {
      expect(script.roleComposition.knight).toBe(1);
      expect(script.roleComposition.seer).toBe(1);
      expect(script.roleComposition.witch).toBe(1);
      expect(script.roleComposition.guard).toBe(1);
      expect(script.roleComposition.wolf_beauty).toBe(1);
      expect(script.roleComposition.wolf).toBe(3);
      expect(script.roleComposition.villager).toBe(4);
    });

    it('应该有4狼8好的阵营平衡', () => {
      const wolfCount = (script.roleComposition.wolf_beauty ?? 0) + (script.roleComposition.wolf ?? 0);
      const totalPlayers = Object.values(script.roleComposition).reduce((sum, count) => sum + count, 0);
      const goodCount = totalPlayers - wolfCount;

      expect(wolfCount).toBe(4);
      expect(goodCount).toBe(8);
    });

    it('应该配置守卫不能连续守护同一人', () => {
      expect(script.ruleVariants?.skillInteractions?.guardCanProtectSame).toBe(false);
    });

    it('应该能生成完整的阶段配置', () => {
      const phases = phaseGenerator.generatePhases(script);

      // 验证包含骑士和狼美人的特殊阶段
      expect(phases.some(p => p.id === 'guard')).toBe(true);
      expect(phases.some(p => p.id === 'wolf')).toBe(true);
      expect(phases.some(p => p.id === 'wolf_beauty')).toBe(true);
      expect(phases.some(p => p.id === 'witch')).toBe(true);
      expect(phases.some(p => p.id === 'seer')).toBe(true);
    });

    it('应该标记为hard难度', () => {
      expect(script.difficulty).toBe('hard');
    });

    it('应该包含合适的标签', () => {
      expect(script.tags).toContain('骑士');
      expect(script.tags).toContain('狼美人');
      expect(script.tags).toContain('高阶局');
    });
  });

  describe('GRAVEKEEPER_GARGOYLE_SCRIPT - 守墓人石像鬼剧本', () => {
    const script = ScriptPresets.GRAVEKEEPER_GARGOYLE_SCRIPT;

    it('应该是合法的12人剧本', () => {
      expect(script.playerCount).toBe(12);
      const totalPlayers = Object.values(script.roleComposition).reduce((sum, count) => sum + count, 0);
      expect(totalPlayers).toBe(12);
    });

    it('应该通过剧本验证', () => {
      const result = validator.validate(script);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('应该包含正确的角色配置（守墓人、石像鬼、预言家、女巫、猎人、3狼、4民）', () => {
      expect(script.roleComposition.gravekeeper).toBe(1);
      expect(script.roleComposition.gargoyle).toBe(1);
      expect(script.roleComposition.seer).toBe(1);
      expect(script.roleComposition.witch).toBe(1);
      expect(script.roleComposition.hunter).toBe(1);
      expect(script.roleComposition.wolf).toBe(3);
      expect(script.roleComposition.villager).toBe(4);
    });

    it('应该有4狼8好的阵营平衡', () => {
      const wolfCount = Object.entries(script.roleComposition).reduce((sum, [roleId, count]) => {
        const handler = RoleRegistry.getHandler(roleId);
        return sum + (handler?.camp === 'wolf' ? count : 0);
      }, 0);
      const totalPlayers = Object.values(script.roleComposition).reduce((sum, count) => sum + count, 0);
      const goodCount = totalPlayers - wolfCount;

      expect(wolfCount).toBe(4);
      expect(goodCount).toBe(8);
    });

    it('应该能生成完整的阶段配置', () => {
      const phases = phaseGenerator.generatePhases(script);

      // 验证包含守墓人和石像鬼的特殊阶段
      expect(phases.some(p => p.id === 'gargoyle')).toBe(true);
      expect(phases.some(p => p.id === 'wolf')).toBe(true);
      expect(phases.some(p => p.id === 'gravekeeper')).toBe(true);
      expect(phases.some(p => p.id === 'witch')).toBe(true);
      expect(phases.some(p => p.id === 'seer')).toBe(true);
    });

    it('应该标记为hard难度', () => {
      expect(script.difficulty).toBe('hard');
    });

    it('应该包含合适的标签', () => {
      expect(script.tags).toContain('守墓人');
      expect(script.tags).toContain('石像鬼');
      expect(script.tags).toContain('独狼');
    });
  });

  describe('所有预设剧本通用验证', () => {
    const allPresets = ScriptPresets.getAllPresets();

    it('所有剧本都应该有完整的元数据', () => {
      allPresets.forEach(script => {
        expect(script.id).toBeTruthy();
        expect(script.name).toBeTruthy();
        expect(script.description).toBeTruthy();
        expect(script.rules).toBeTruthy();
        expect(script.difficulty).toBeTruthy();
        expect(script.tags).toBeDefined();
        expect(script.createdAt).toBeTruthy();
        expect(script.updatedAt).toBeTruthy();
      });
    });

    it('所有剧本都应该通过验证', () => {
      allPresets.forEach(script => {
        const result = validator.validate(script);
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });
    });

    it('所有剧本都应该能生成阶段配置', () => {
      allPresets.forEach(script => {
        const phases = phaseGenerator.generatePhases(script);
        expect(phases.length).toBeGreaterThan(0);

        // 验证必要的阶段
        expect(phases.some(p => p.id === 'lobby')).toBe(true);
        expect(phases.some(p => p.id === 'finished')).toBe(true);
        expect(phases.some(p => p.id === 'wolf')).toBe(true); // 所有剧本都有狼人
      });
    });

    it('所有剧本的playerCount应该与角色总数一致', () => {
      allPresets.forEach(script => {
        const totalPlayers = Object.values(script.roleComposition).reduce((sum, count) => sum + count, 0);
        expect(totalPlayers).toBe(script.playerCount);
      });
    });

    it('所有剧本的狼人数量应该在合理范围内', () => {
      allPresets.forEach(script => {
        const wolfCount = Object.entries(script.roleComposition).reduce((sum, [roleId, count]) => {
          const handler = RoleRegistry.getHandler(roleId);
          return sum + (handler?.camp === 'wolf' ? count : 0);
        }, 0);

        const totalPlayers = Object.values(script.roleComposition).reduce((sum, count) => sum + count, 0);
        const goodCount = totalPlayers - wolfCount;

        // 狼人数量应大于0且小于好人数量
        expect(wolfCount).toBeGreaterThan(0);
        expect(goodCount).toBeGreaterThan(wolfCount);
      });
    });
  });

  describe('剧本间的差异性', () => {
    it('每个剧本都应该有独特的角色组合', () => {
      const presets = ScriptPresets.getAllPresets();

      // 将角色组合转换为可比较的字符串
      const compositions = presets.map(p => JSON.stringify(p.roleComposition));

      // 验证所有组合都不相同
      const uniqueCompositions = new Set(compositions);
      expect(uniqueCompositions.size).toBe(presets.length);
    });

    it('摄梦人剧本应该包含dreamer和nightmare', () => {
      const script = ScriptPresets.DREAMER_SCRIPT;
      expect(script.roleComposition.dreamer).toBeDefined();
      expect(script.roleComposition.nightmare).toBeDefined();
    });

    it('骑士狼美人剧本应该包含knight和wolf_beauty', () => {
      const script = ScriptPresets.KNIGHT_BEAUTY_SCRIPT;
      expect(script.roleComposition.knight).toBeDefined();
      expect(script.roleComposition.wolf_beauty).toBeDefined();
    });

    it('守墓人石像鬼剧本应该包含gravekeeper和gargoyle', () => {
      const script = ScriptPresets.GRAVEKEEPER_GARGOYLE_SCRIPT;
      expect(script.roleComposition.gravekeeper).toBeDefined();
      expect(script.roleComposition.gargoyle).toBeDefined();
    });
  });
});
