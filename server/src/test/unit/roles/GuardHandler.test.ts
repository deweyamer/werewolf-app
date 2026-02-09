import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGame, createMockPlayer } from '../../helpers/GameTestHelper.js';
import { Game, PlayerAction } from '../../../../../shared/src/types.js';
import { GuardHandler } from '../../../game/roles/GuardHandler.js';

describe('GuardHandler', () => {
  let handler: GuardHandler;
  let game: Game;

  beforeEach(() => {
    handler = new GuardHandler();

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
    handler.initializeAbilities(game.players.find(p => p.playerId === 6)!);
  });

  it('should successfully guard an alive player', async () => {
    const action: PlayerAction = {
      phase: 'guard',
      playerId: 6,
      actionType: 'guard',
      target: 10,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);

    expect(result.success).toBe(true);
    expect(result.effect).toBeDefined();
    expect(result.effect!.type).toBe('protect');
    expect(result.effect!.targetId).toBe(10);
    expect(game.nightActions.guardTarget).toBe(10);
    expect(game.nightActions.guardSubmitted).toBe(true);
    expect(game.players.find(p => p.playerId === 6)!.abilities.lastGuardTarget).toBe(10);
  });

  it('should prevent guarding the same target on consecutive nights', async () => {
    // Simulate night 1: guard player 10
    game.players.find(p => p.playerId === 6)!.abilities.lastGuardTarget = 10;

    const action: PlayerAction = {
      phase: 'guard',
      playerId: 6,
      actionType: 'guard',
      target: 10,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);
    expect(result.success).toBe(false);
    expect(result.message).toContain('不能连续守护同一人');
  });

  it('should allow guarding a different target after guarding someone else', async () => {
    game.players.find(p => p.playerId === 6)!.abilities.lastGuardTarget = 10;

    const action: PlayerAction = {
      phase: 'guard',
      playerId: 6,
      actionType: 'guard',
      target: 11,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);
    expect(result.success).toBe(true);
    expect(result.effect!.targetId).toBe(11);
  });

  it('should fail when target is dead', async () => {
    game.players.find(p => p.playerId === 10)!.alive = false;

    const action: PlayerAction = {
      phase: 'guard',
      playerId: 6,
      actionType: 'guard',
      target: 10,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);
    expect(result.success).toBe(false);
    expect(result.message).toContain('已死亡');
  });

  it('should exclude last guard target from getValidTargets', () => {
    game.players.find(p => p.playerId === 6)!.abilities.lastGuardTarget = 10;
    const validTargets = handler.getValidTargets(game, 6);

    expect(validTargets).not.toContain(10);
    expect(validTargets).toContain(11);
    // Guard can guard self
    expect(validTargets).toContain(6);
  });
});
