import { describe, it, expect, beforeEach } from 'vitest';
import { SkillResolver } from '../../../game/skill/SkillResolver.js';
import { SkillEffectType, SkillPriority, SkillTiming, DeathReason } from '../../../game/skill/SkillTypes.js';
import { createMockGame, createMockPlayer, createSkillEffect } from '../../helpers/GameTestHelper.js';
import { Game } from '../../../../../shared/src/types.js';

describe('SkillResolver', () => {
  let resolver: SkillResolver;
  let game: Game;

  function effect(
    type: SkillEffectType,
    priority: SkillPriority,
    actorId: number,
    targetId: number
  ) {
    return createSkillEffect(type, priority, actorId, targetId, SkillTiming.NIGHT_ACTION);
  }

  beforeEach(() => {
    const players = [
      createMockPlayer(1, 'wolf', 'wolf'),
      createMockPlayer(2, 'wolf', 'wolf'),
      createMockPlayer(3, 'wolf', 'wolf'),
      createMockPlayer(4, 'wolf', 'wolf'),
      createMockPlayer(5, 'seer', 'good'),
      createMockPlayer(6, 'witch', 'good'),
      createMockPlayer(7, 'hunter', 'good'),
      createMockPlayer(8, 'guard', 'good'),
      createMockPlayer(9, 'dreamer', 'good'),
      createMockPlayer(10, 'villager', 'good'),
      createMockPlayer(11, 'villager', 'good'),
      createMockPlayer(12, 'villager', 'good'),
    ];

    game = createMockGame({ players });
    resolver = new SkillResolver();
  });

  // ─────────────────────────────────────────────
  // 单效果执行
  // ─────────────────────────────────────────────
  describe('单效果执行', () => {
    it('KILL 应该标记目标死亡', async () => {
      resolver.addEffect(effect(SkillEffectType.KILL, SkillPriority.WOLF_KILL, 1, 10));
      const result = await resolver.resolve(game, 'night');
      expect(result.deaths).toContain(10);
    });

    it('PROTECT 应该标记目标被守护', async () => {
      resolver.addEffect(effect(SkillEffectType.PROTECT, SkillPriority.GUARD, 8, 10));
      const result = await resolver.resolve(game, 'night');
      expect(result.protected).toContain(10);
    });

    it('DREAM_PROTECT 应该标记目标被摄梦人守护', async () => {
      resolver.addEffect(effect(SkillEffectType.DREAM_PROTECT, SkillPriority.DREAM, 9, 10));
      const result = await resolver.resolve(game, 'night');
      expect(result.protected).toContain(10);
    });

    it('SAVE 应该救活被狼刀的目标', async () => {
      resolver.addEffect(effect(SkillEffectType.KILL, SkillPriority.WOLF_KILL, 1, 10));
      resolver.addEffect(effect(SkillEffectType.SAVE, SkillPriority.WITCH_ANTIDOTE, 6, 10));
      const result = await resolver.resolve(game, 'night');
      expect(result.deaths).not.toContain(10);
      expect(result.revives).toContain(10);
    });

    it('SAVE 不能救非狼刀死因', async () => {
      resolver.addEffect(effect(SkillEffectType.DREAM_KILL, SkillPriority.DREAM, 9, 10));
      resolver.addEffect(effect(SkillEffectType.SAVE, SkillPriority.WITCH_ANTIDOTE, 6, 10));
      const result = await resolver.resolve(game, 'night');
      expect(result.deaths).toContain(10);
    });

    it('CHECK 应该返回正确阵营', async () => {
      const checkEffect = effect(SkillEffectType.CHECK, SkillPriority.SEER_CHECK, 5, 1);
      resolver.addEffect(checkEffect);
      await resolver.resolve(game, 'night');
      expect(checkEffect.data?.result).toBe('wolf');
    });

    it('BLOCK 应该标记目标被恐惧', async () => {
      resolver.addEffect(effect(SkillEffectType.BLOCK, SkillPriority.FEAR, 1, 5));
      await resolver.resolve(game, 'night');
      const state = resolver.getPlayerState(5);
      expect(state?.feared).toBe(true);
    });

    it('LINK 应该建立双向连结', async () => {
      resolver.addEffect(effect(SkillEffectType.LINK, SkillPriority.WOLF_BEAUTY, 4, 10));
      await resolver.resolve(game, 'night');
      const state4 = resolver.getPlayerState(4);
      const state10 = resolver.getPlayerState(10);
      expect(state4?.linkedTo).toBe(10);
      expect(state10?.linkedBy).toBe(4);
    });

    it('DREAM_KILL 应该标记目标梦死', async () => {
      resolver.addEffect(effect(SkillEffectType.DREAM_KILL, SkillPriority.DREAM, 9, 10));
      const result = await resolver.resolve(game, 'night');
      expect(result.deaths).toContain(10);
    });
  });

  // ─────────────────────────────────────────────
  // 优先级排序
  // ─────────────────────────────────────────────
  describe('优先级排序', () => {
    it('效果应该按优先级升序执行', async () => {
      // WOLF_KILL(300) is added first, GUARD(200) second
      // But GUARD has lower priority number → executes first → protects target
      resolver.addEffect(effect(SkillEffectType.KILL, SkillPriority.WOLF_KILL, 1, 10));
      resolver.addEffect(effect(SkillEffectType.PROTECT, SkillPriority.GUARD, 8, 10));
      const result = await resolver.resolve(game, 'night');
      expect(result.deaths).not.toContain(10);
    });
  });

  // ─────────────────────────────────────────────
  // 守护免疫
  // ─────────────────────────────────────────────
  describe('守护免疫', () => {
    it('守卫守护应该挡住狼刀', async () => {
      resolver.addEffect(effect(SkillEffectType.PROTECT, SkillPriority.GUARD, 8, 10));
      resolver.addEffect(effect(SkillEffectType.KILL, SkillPriority.WOLF_KILL, 1, 10));
      const result = await resolver.resolve(game, 'night');
      expect(result.deaths).not.toContain(10);
    });

    it('守卫守护不能挡住毒药', async () => {
      resolver.addEffect(effect(SkillEffectType.PROTECT, SkillPriority.GUARD, 8, 10));
      resolver.addEffect(effect(SkillEffectType.KILL, SkillPriority.WITCH_POISON, 6, 10));
      const result = await resolver.resolve(game, 'night');
      expect(result.deaths).toContain(10);
    });

    it('摄梦人守护应该挡住狼刀', async () => {
      resolver.addEffect(effect(SkillEffectType.DREAM_PROTECT, SkillPriority.DREAM, 9, 10));
      resolver.addEffect(effect(SkillEffectType.KILL, SkillPriority.WOLF_KILL, 1, 10));
      const result = await resolver.resolve(game, 'night');
      expect(result.deaths).not.toContain(10);
    });

    it('摄梦人守护应该挡住毒药', async () => {
      resolver.addEffect(effect(SkillEffectType.DREAM_PROTECT, SkillPriority.DREAM, 9, 10));
      resolver.addEffect(effect(SkillEffectType.KILL, SkillPriority.WITCH_POISON, 6, 10));
      const result = await resolver.resolve(game, 'night');
      expect(result.deaths).not.toContain(10);
    });
  });

  // ─────────────────────────────────────────────
  // 同守同救
  // ─────────────────────────────────────────────
  describe('同守同救', () => {
    it('守卫守护+女巫解药同时作用→目标死亡(奶穿)', async () => {
      resolver.addEffect(effect(SkillEffectType.PROTECT, SkillPriority.GUARD, 8, 10));
      resolver.addEffect(effect(SkillEffectType.KILL, SkillPriority.WOLF_KILL, 1, 10));
      resolver.addEffect(effect(SkillEffectType.SAVE, SkillPriority.WITCH_ANTIDOTE, 6, 10));
      const result = await resolver.resolve(game, 'night');
      expect(result.deaths).toContain(10);
    });

    it('仅守卫守护(无解药)→目标存活', async () => {
      resolver.addEffect(effect(SkillEffectType.PROTECT, SkillPriority.GUARD, 8, 10));
      resolver.addEffect(effect(SkillEffectType.KILL, SkillPriority.WOLF_KILL, 1, 10));
      const result = await resolver.resolve(game, 'night');
      expect(result.deaths).not.toContain(10);
    });

    it('仅女巫解药(无守卫)→目标存活', async () => {
      resolver.addEffect(effect(SkillEffectType.KILL, SkillPriority.WOLF_KILL, 1, 10));
      resolver.addEffect(effect(SkillEffectType.SAVE, SkillPriority.WITCH_ANTIDOTE, 6, 10));
      const result = await resolver.resolve(game, 'night');
      expect(result.deaths).not.toContain(10);
    });
  });

  // ─────────────────────────────────────────────
  // 恐惧机制
  // ─────────────────────────────────────────────
  describe('恐惧机制', () => {
    it('被恐惧的施法者效果应该被阻止', async () => {
      resolver.addEffect(effect(SkillEffectType.BLOCK, SkillPriority.FEAR, 1, 5));
      resolver.addEffect(effect(SkillEffectType.CHECK, SkillPriority.SEER_CHECK, 5, 1));
      const result = await resolver.resolve(game, 'night');
      expect(result.blocked.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────
  // 连锁死亡
  // ─────────────────────────────────────────────
  describe('连锁死亡', () => {
    it('狼美人死亡→魅惑目标殉情', async () => {
      // processLinkedDeaths checks deadPlayer.role !== '狼美人' (Chinese name)
      const players = game.players.map((p) =>
        p.playerId === 4 ? { ...p, role: '狼美人' } : p
      );
      game = createMockGame({ players });
      resolver = new SkillResolver();

      resolver.addEffect(effect(SkillEffectType.LINK, SkillPriority.WOLF_BEAUTY, 4, 10));
      resolver.addEffect(effect(SkillEffectType.KILL, SkillPriority.WOLF_KILL, 1, 4));
      const result = await resolver.resolve(game, 'night');

      expect(result.deaths).toContain(4);
      expect(result.deaths).toContain(10);
    });

    it('摄梦人夜间死亡→梦游目标连带死亡', async () => {
      // Override player 9 to have lastDreamTarget
      const players = game.players.map((p) =>
        p.playerId === 9
          ? { ...p, role: 'dreamer', abilities: { lastDreamTarget: 10 } }
          : p
      );
      game = createMockGame({ players });
      resolver = new SkillResolver();

      resolver.addEffect(effect(SkillEffectType.KILL, SkillPriority.WOLF_KILL, 1, 9));
      const result = await resolver.resolve(game, 'night');

      expect(result.deaths).toContain(9);
      expect(result.deaths).toContain(10);
    });

    it('摄梦人死亡但梦游目标已死→不重复添加', async () => {
      const players = game.players.map((p) =>
        p.playerId === 9
          ? { ...p, role: 'dreamer', abilities: { lastDreamTarget: 10 } }
          : p
      );
      game = createMockGame({ players });
      resolver = new SkillResolver();

      resolver.addEffect(effect(SkillEffectType.KILL, SkillPriority.WOLF_KILL, 1, 9));
      resolver.addEffect(effect(SkillEffectType.KILL, SkillPriority.WITCH_POISON, 6, 10));
      const result = await resolver.resolve(game, 'night');

      expect(result.deaths).toContain(9);
      expect(result.deaths).toContain(10);
      // Player 10 should only appear once in the deaths array
      expect(result.deaths.filter((id) => id === 10).length).toBe(1);
    });
  });

  // ─────────────────────────────────────────────
  // applyDeaths (called internally by resolve)
  // ─────────────────────────────────────────────
  describe('applyDeaths', () => {
    it('死亡玩家应该被标记为 alive=false 并设置 outReason', async () => {
      resolver.addEffect(effect(SkillEffectType.KILL, SkillPriority.WOLF_KILL, 1, 10));
      await resolver.resolve(game, 'night');

      // applyDeaths is called internally by resolve()
      const player10 = game.players.find((p) => p.playerId === 10);
      expect(player10?.alive).toBe(false);
      expect(player10?.outReason).toBe('wolf_kill');
    });
  });
});
