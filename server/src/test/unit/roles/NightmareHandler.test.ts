import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGame, createMockPlayer } from '../../helpers/GameTestHelper.js';
import { Game, PlayerAction } from '../../../../../shared/src/types.js';
import { NightmareHandler } from '../../../game/roles/NightmareHandler.js';

describe('NightmareHandler', () => {
  let handler: NightmareHandler;
  let game: Game;

  beforeEach(() => {
    handler = new NightmareHandler();

    const players = [
      createMockPlayer(1, 'nightmare', 'wolf'),
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

    game = createMockGame({ players, currentRound: 1, nightActions: {} as any });
    handler.initializeAbilities(game.players.find(p => p.playerId === 1)!);
  });

  it('should fear a good player and produce BLOCK effect', async () => {
    const action: PlayerAction = {
      phase: 'fear',
      playerId: 1,
      actionType: 'fear',
      target: 5,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);

    expect(result.success).toBe(true);
    expect(result.effect).toBeDefined();
    expect(result.effect!.type).toBe('block');
    expect(result.effect!.targetId).toBe(5);
    expect(game.nightActions.fear).toBe(5);
    expect(game.nightActions.fearSubmitted).toBe(true);
    expect(game.players.find(p => p.playerId === 5)!.feared).toBe(true);
  });

  it('should not allow fearing a wolf teammate', async () => {
    const action: PlayerAction = {
      phase: 'fear',
      playerId: 1,
      actionType: 'fear',
      target: 2,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);
    expect(result.success).toBe(false);
    expect(result.message).toContain('不能恐惧狼人');
  });

  it('should allow skipping (no target)', async () => {
    const action: PlayerAction = {
      phase: 'fear',
      playerId: 1,
      actionType: 'fear',
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);

    expect(result.success).toBe(true);
    expect(result.effect).toBeUndefined();
    expect(game.nightActions.fearSubmitted).toBe(true);
  });
});
