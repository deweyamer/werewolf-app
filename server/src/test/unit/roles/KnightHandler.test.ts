import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGame, createMockPlayer } from '../../helpers/GameTestHelper.js';
import { Game, PlayerAction } from '../../../../../shared/src/types.js';
import { KnightHandler } from '../../../game/roles/KnightHandler.js';

describe('KnightHandler', () => {
  let handler: KnightHandler;
  let game: Game;

  beforeEach(() => {
    handler = new KnightHandler();

    const players = [
      createMockPlayer(1, 'wolf', 'wolf'),
      createMockPlayer(2, 'wolf', 'wolf'),
      createMockPlayer(3, 'wolf', 'wolf'),
      createMockPlayer(4, 'wolf', 'wolf'),
      createMockPlayer(5, 'seer', 'good'),
      createMockPlayer(6, 'guard', 'good'),
      createMockPlayer(7, 'knight', 'good'),
      createMockPlayer(8, 'hunter', 'good'),
      createMockPlayer(9, 'villager', 'good'),
      createMockPlayer(10, 'villager', 'good'),
      createMockPlayer(11, 'villager', 'good'),
      createMockPlayer(12, 'villager', 'good'),
    ];

    game = createMockGame({ players, nightActions: {} as any });
    handler.initializeAbilities(game.players.find(p => p.playerId === 7)!);
  });

  it('should kill the target when dueling a wolf', async () => {
    const action: PlayerAction = {
      phase: 'knight',
      playerId: 7,
      actionType: 'duel',
      target: 1,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleDayAction(game, action);

    expect(result.success).toBe(true);
    expect(result.effect).toBeDefined();
    expect(result.effect!.type).toBe('kill');
    // Target is wolf, so the victim is the target
    expect(result.effect!.targetId).toBe(1);
    expect(game.players.find(p => p.playerId === 7)!.abilities.knightDuelUsed).toBe(true);
  });

  it('should kill the knight when dueling a good player', async () => {
    const action: PlayerAction = {
      phase: 'knight',
      playerId: 7,
      actionType: 'duel',
      target: 9,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleDayAction(game, action);

    expect(result.success).toBe(true);
    expect(result.effect).toBeDefined();
    expect(result.effect!.type).toBe('kill');
    // Target is good, so the victim is the knight
    expect(result.effect!.targetId).toBe(7);
    expect(game.players.find(p => p.playerId === 7)!.abilities.knightDuelUsed).toBe(true);
  });

  it('should prevent using duel twice', async () => {
    game.players.find(p => p.playerId === 7)!.abilities.knightDuelUsed = true;

    const action: PlayerAction = {
      phase: 'knight',
      playerId: 7,
      actionType: 'duel',
      target: 1,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleDayAction(game, action);
    expect(result.success).toBe(false);
    expect(result.message).toContain('已经使用过了');
  });
});
