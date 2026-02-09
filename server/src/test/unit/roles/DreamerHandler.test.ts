import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGame, createMockPlayer } from '../../helpers/GameTestHelper.js';
import { Game, PlayerAction } from '../../../../../shared/src/types.js';
import { DreamerHandler } from '../../../game/roles/DreamerHandler.js';

describe('DreamerHandler', () => {
  let handler: DreamerHandler;
  let game: Game;

  beforeEach(() => {
    handler = new DreamerHandler();

    const players = [
      createMockPlayer(1, 'wolf', 'wolf'),
      createMockPlayer(2, 'wolf', 'wolf'),
      createMockPlayer(3, 'wolf', 'wolf'),
      createMockPlayer(4, 'wolf', 'wolf'),
      createMockPlayer(5, 'seer', 'good'),
      createMockPlayer(6, 'guard', 'good'),
      createMockPlayer(7, 'dreamer', 'good'),
      createMockPlayer(8, 'hunter', 'good'),
      createMockPlayer(9, 'villager', 'good'),
      createMockPlayer(10, 'villager', 'good'),
      createMockPlayer(11, 'villager', 'good'),
      createMockPlayer(12, 'villager', 'good'),
    ];

    game = createMockGame({ players, nightActions: {} as any });
    handler.initializeAbilities(game.players.find(p => p.playerId === 7)!);
  });

  it('should produce DREAM_PROTECT effect on first visit to a target', async () => {
    const action: PlayerAction = {
      phase: 'dream',
      playerId: 7,
      actionType: 'dream',
      target: 10,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);

    expect(result.success).toBe(true);
    expect(result.effect).toBeDefined();
    expect(result.effect!.type).toBe('dream_protect');
    expect(result.effect!.targetId).toBe(10);
    expect(game.players.find(p => p.playerId === 7)!.abilities.lastDreamTarget).toBe(10);
  });

  it('should produce DREAM_KILL effect when targeting the same player two consecutive nights', async () => {
    // Simulate first night already visited player 10
    game.players.find(p => p.playerId === 7)!.abilities.lastDreamTarget = 10;

    const action: PlayerAction = {
      phase: 'dream',
      playerId: 7,
      actionType: 'dream',
      target: 10,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);

    expect(result.success).toBe(true);
    expect(result.effect).toBeDefined();
    expect(result.effect!.type).toBe('dream_kill');
    expect(result.effect!.targetId).toBe(10);
    // After dream-kill, lastDreamTarget should be reset
    expect(game.players.find(p => p.playerId === 7)!.abilities.lastDreamTarget).toBeUndefined();
  });

  it('should switch to DREAM_PROTECT when changing targets after a previous visit', async () => {
    game.players.find(p => p.playerId === 7)!.abilities.lastDreamTarget = 10;

    const action: PlayerAction = {
      phase: 'dream',
      playerId: 7,
      actionType: 'dream',
      target: 11,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);

    expect(result.success).toBe(true);
    expect(result.effect!.type).toBe('dream_protect');
    expect(result.effect!.targetId).toBe(11);
    expect(game.players.find(p => p.playerId === 7)!.abilities.lastDreamTarget).toBe(11);
  });

  it('should not allow dreaming self', async () => {
    const action: PlayerAction = {
      phase: 'dream',
      playerId: 7,
      actionType: 'dream',
      target: 7,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);
    expect(result.success).toBe(false);
    expect(result.message).toContain('不能梦游自己');
  });

  it('should exclude self from getValidTargets', () => {
    const targets = handler.getValidTargets(game, 7);
    expect(targets).not.toContain(7);
    expect(targets).toContain(10);
    expect(targets.length).toBe(11); // all 12 players minus self
  });
});
