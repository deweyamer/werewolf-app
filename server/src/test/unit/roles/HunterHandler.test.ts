import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGame, createMockPlayer } from '../../helpers/GameTestHelper.js';
import { Game, PlayerAction } from '../../../../../shared/src/types.js';
import { HunterHandler } from '../../../game/roles/HunterHandler.js';

describe('HunterHandler', () => {
  let handler: HunterHandler;
  let game: Game;

  beforeEach(() => {
    handler = new HunterHandler();

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
    handler.initializeAbilities(game.players.find(p => p.playerId === 8)!);
  });

  it('should return pending shoot effect on death by wolf_kill', async () => {
    const hunter = game.players.find(p => p.playerId === 8)!;
    const effect = await handler.onDeath(game, hunter, 'wolf_kill');

    expect(effect).not.toBeNull();
    expect(effect!.type).toBe('kill');
    expect(effect!.actorId).toBe(8);
    expect(effect!.targetId).toBe(0); // pending god assignment
    expect(effect!.data?.extraInfo?.pending).toBe(true);
  });

  it('should return null on death by poison (cannot shoot)', async () => {
    const hunter = game.players.find(p => p.playerId === 8)!;
    const effect = await handler.onDeath(game, hunter, 'poison');

    expect(effect).toBeNull();
  });

  it('should handle day action shoot at a valid target', async () => {
    const action: PlayerAction = {
      phase: 'hunter',
      playerId: 8,
      actionType: 'shoot',
      target: 1,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleDayAction(game, action);

    expect(result.success).toBe(true);
    expect(result.effect).toBeDefined();
    expect(result.effect!.type).toBe('kill');
    expect(result.effect!.targetId).toBe(1);
    expect(result.effect!.actorId).toBe(8);
  });
});
