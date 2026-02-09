import { describe, it, expect } from 'vitest';
import { translateDeathReason, getRoleName, getPhaseLabel, getPhaseIcon, getPhaseColorClass } from './phaseLabels';

describe('phaseLabels utils', () => {
  describe('translateDeathReason', () => {
    it('应该正确翻译新格式的死亡原因 (snake_case)', () => {
      expect(translateDeathReason('wolf_kill')).toBe('🐺 被狼刀');
      expect(translateDeathReason('poison')).toBe('☠️ 被毒死');
      expect(translateDeathReason('exile')).toBe('🗳️ 被投票放逐');
      expect(translateDeathReason('hunter_shoot')).toBe('🏹 被猎人带走');
      expect(translateDeathReason('dream_kill')).toBe('💤 摄梦人梦死');
      expect(translateDeathReason('black_wolf_explode')).toBe('💥 黑狼自爆');
      expect(translateDeathReason('knight_duel')).toBe('⚔️ 被骑士决斗');
      expect(translateDeathReason('wolf_beauty_link')).toBe('💃 与狼美人殉情');
      expect(translateDeathReason('self_destruct')).toBe('💣 狼人自爆');
    });

    it('应该兼容旧格式的死亡原因 (camelCase)', () => {
      expect(translateDeathReason('wolfKill')).toBe('🐺 被狼刀');
      expect(translateDeathReason('vote')).toBe('🗳️ 被投票放逐');
      expect(translateDeathReason('dreamerKilled')).toBe('💤 摄梦人梦死');
      expect(translateDeathReason('hunter')).toBe('🏹 被猎人带走');
      expect(translateDeathReason('knight')).toBe('⚔️ 被骑士决斗');
      expect(translateDeathReason('wolfBeauty')).toBe('💃 与狼美人殉情');
    });

    it('应该处理未知原因', () => {
      expect(translateDeathReason('unknown_reason')).toBe('unknown_reason');
      expect(translateDeathReason()).toBe('未知原因');
      expect(translateDeathReason('')).toBe('未知原因');
    });

    it('测试守墓人规则: exile vs vote', () => {
      // 确保新格式 'exile' 和旧格式 'vote' 都能正确翻译
      expect(translateDeathReason('exile')).toBe('🗳️ 被投票放逐');
      expect(translateDeathReason('vote')).toBe('🗳️ 被投票放逐');
    });
  });

  describe('getRoleName', () => {
    it('应该正确翻译所有角色名称', () => {
      expect(getRoleName('wolf')).toBe('狼人');
      expect(getRoleName('nightmare')).toBe('噩梦之影');
      expect(getRoleName('wolf_beauty')).toBe('狼美人');
      expect(getRoleName('white_wolf')).toBe('白狼王');
      expect(getRoleName('black_wolf')).toBe('黑狼');
      expect(getRoleName('gargoyle')).toBe('石像鬼');
      expect(getRoleName('seer')).toBe('预言家');
      expect(getRoleName('witch')).toBe('女巫');
      expect(getRoleName('hunter')).toBe('猎人');
      expect(getRoleName('guard')).toBe('守卫');
      expect(getRoleName('gravekeeper')).toBe('守墓人');
      expect(getRoleName('knight')).toBe('骑士');
      expect(getRoleName('dreamer')).toBe('摄梦人');
      expect(getRoleName('villager')).toBe('平民');
    });

    it('应该返回原始角色ID如果没有翻译', () => {
      expect(getRoleName('unknown_role')).toBe('unknown_role');
    });
  });

  describe('getPhaseLabel', () => {
    it('应该返回带图标的阶段标签', () => {
      expect(getPhaseLabel('wolf')).toBe('🐺 狼人刀人');
      expect(getPhaseLabel('witch')).toBe('🧪 女巫用药');
      expect(getPhaseLabel('seer')).toBe('🔮 预言家查验');
      expect(getPhaseLabel('vote')).toBe('🗳️ 投票放逐');
      expect(getPhaseLabel('gravekeeper')).toBe('⚰️ 守墓 (守墓人)');
      expect(getPhaseLabel('settle')).toBe('⚖️ 夜间结算');
      expect(getPhaseLabel('daySettle')).toBe('☀️ 白天结算');
    });

    it('应该返回原始阶段名称如果没有定义', () => {
      expect(getPhaseLabel('unknown_phase')).toBe('unknown_phase');
    });
  });

  describe('getPhaseIcon', () => {
    it('应该返回已知阶段的图标', () => {
      expect(getPhaseIcon('wolf')).toBe('🐺');
      expect(getPhaseIcon('witch')).toBe('🧪');
      expect(getPhaseIcon('seer')).toBe('🔮');
      expect(getPhaseIcon('guard')).toBe('🛡️');
      expect(getPhaseIcon('fear')).toBe('🌙');
    });

    it('未知阶段应该返回问号图标', () => {
      expect(getPhaseIcon('unknown')).toBe('❓');
    });
  });

  describe('getPhaseColorClass', () => {
    it('应该返回对应阶段的颜色类名', () => {
      expect(getPhaseColorClass('wolf')).toBe('border-red-500 bg-red-600/20');
      expect(getPhaseColorClass('seer')).toBe('border-cyan-500 bg-cyan-600/20');
      expect(getPhaseColorClass('witch')).toBe('border-green-500 bg-green-600/20');
    });

    it('未知阶段应该使用默认灰色', () => {
      expect(getPhaseColorClass('unknown')).toBe('border-gray-500 bg-gray-600/20');
    });
  });
});
