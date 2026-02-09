import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGame, createMockPlayer } from '../../helpers/GameTestHelper.js';
import { Game, PlayerAction } from '../../../../../shared/src/types.js';
import { WitchHandler } from '../../../game/roles/WitchHandler.js';

describe('WitchHandler', () => {
  let handler: WitchHandler;
  let game: Game;

  beforeEach(() => {
    handler = new WitchHandler();

    const players = [
      createMockPlayer(1, 'wolf', 'wolf'),
      createMockPlayer(2, 'wolf', 'wolf'),
      createMockPlayer(3, 'wolf', 'wolf'),
      createMockPlayer(4, 'wolf', 'wolf'),
      createMockPlayer(5, 'seer', 'good'),
      createMockPlayer(6, 'guard', 'good'),
      createMockPlayer(7, 'witch', 'good'),
      createMockPlayer(8, 'hunter', 'good'),
      createMockPlayer(9, 'villager', 'good'),
      createMockPlayer(10, 'villager', 'good'),
      createMockPlayer(11, 'villager', 'good'),
      createMockPlayer(12, 'villager', 'good'),
    ];

    game = createMockGame({ players, nightActions: {} as any });
    handler.initializeAbilities(game.players.find(p => p.playerId === 7)!);
  });

  // ── save (antidote) ──────────────────────────

  it('should save the wolf-kill victim with antidote', async () => {
    game.nightActions.wolfKill = 10;

    const action: PlayerAction = {
      phase: 'witch',
      playerId: 7,
      actionType: 'save',
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);

    expect(result.success).toBe(true);
    expect(result.effect).toBeDefined();
    expect(result.effect!.type).toBe('save');
    expect(result.effect!.targetId).toBe(10);
    expect(game.players.find(p => p.playerId === 7)!.abilities.antidote).toBe(false);
    expect(game.nightActions.witchAction).toBe('save');
    expect(game.nightActions.witchSubmitted).toBe(true);
  });

  it('should fail to save when antidote is already used', async () => {
    game.nightActions.wolfKill = 10;
    game.players.find(p => p.playerId === 7)!.abilities.antidote = false;

    const action: PlayerAction = {
      phase: 'witch',
      playerId: 7,
      actionType: 'save',
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);
    expect(result.success).toBe(false);
    expect(result.message).toContain('解药已经使用过了');
  });

  it('should fail to save when no one was wolf-killed', async () => {
    const action: PlayerAction = {
      phase: 'witch',
      playerId: 7,
      actionType: 'save',
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);
    expect(result.success).toBe(false);
    expect(result.message).toContain('没有人被狼刀');
  });

  // ── poison ───────────────────────────────────

  it('should poison an alive target', async () => {
    const action: PlayerAction = {
      phase: 'witch',
      playerId: 7,
      actionType: 'poison',
      target: 9,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);

    expect(result.success).toBe(true);
    expect(result.effect).toBeDefined();
    expect(result.effect!.type).toBe('kill');
    expect(result.effect!.targetId).toBe(9);
    expect(game.players.find(p => p.playerId === 7)!.abilities.poison).toBe(false);
    expect(game.nightActions.witchAction).toBe('poison');
    expect(game.nightActions.witchTarget).toBe(9);
  });

  it('should fail to poison when poison is already used', async () => {
    game.players.find(p => p.playerId === 7)!.abilities.poison = false;

    const action: PlayerAction = {
      phase: 'witch',
      playerId: 7,
      actionType: 'poison',
      target: 9,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);
    expect(result.success).toBe(false);
    expect(result.message).toContain('毒药已经使用过了');
  });

  // ── none (skip) ──────────────────────────────

  it('should allow skipping with actionType none', async () => {
    game.nightActions.wolfKill = 10;

    const action: PlayerAction = {
      phase: 'witch',
      playerId: 7,
      actionType: 'none',
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);

    expect(result.success).toBe(true);
    expect(result.effect).toBeUndefined();
    expect(game.nightActions.witchSubmitted).toBe(true);
  });

  // ── double submission guard ──────────────────

  it('should prevent double submission after a non-skip action', async () => {
    game.nightActions.wolfKill = 10;

    // First action: save
    const save: PlayerAction = {
      phase: 'witch',
      playerId: 7,
      actionType: 'save',
      timestamp: new Date().toISOString(),
    };
    await handler.handleNightAction(game, save);

    // Second action: poison (should be blocked)
    const poison: PlayerAction = {
      phase: 'witch',
      playerId: 7,
      actionType: 'poison',
      target: 9,
      timestamp: new Date().toISOString(),
    };
    const result = await handler.handleNightAction(game, poison);
    expect(result.success).toBe(false);
    expect(result.message).toContain('已提交操作');
  });
});
