import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGame, createMockPlayer } from '../../helpers/GameTestHelper.js';
import { Game, PlayerAction } from '../../../../../shared/src/types.js';
import { SeerHandler } from '../../../game/roles/SeerHandler.js';

describe('SeerHandler', () => {
  let handler: SeerHandler;
  let game: Game;

  beforeEach(() => {
    handler = new SeerHandler();

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
    handler.initializeAbilities(game.players.find(p => p.playerId === 5)!);
  });

  it('should return wolf camp when checking a wolf player', async () => {
    const action: PlayerAction = {
      phase: 'seer',
      playerId: 5,
      actionType: 'check',
      target: 1,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);

    expect(result.success).toBe(true);
    expect(result.data.seerResult.result).toBe('wolf');
    expect(result.data.seerResult.playerId).toBe(1);
    expect(result.effect).toBeDefined();
    expect(result.effect!.type).toBe('check');
    expect(game.nightActions.seerCheck).toBe(1);
    expect(game.nightActions.seerResult).toBe('wolf');
    expect(game.nightActions.seerSubmitted).toBe(true);
  });

  it('should return good camp when checking a good player', async () => {
    const action: PlayerAction = {
      phase: 'seer',
      playerId: 5,
      actionType: 'check',
      target: 9,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);

    expect(result.success).toBe(true);
    expect(result.data.seerResult.result).toBe('good');
    expect(result.data.seerResult.playerId).toBe(9);
  });

  it('should not allow checking self', async () => {
    const action: PlayerAction = {
      phase: 'seer',
      playerId: 5,
      actionType: 'check',
      target: 5,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);
    expect(result.success).toBe(false);
    expect(result.message).toContain('不能查验自己');
  });

  it('should fail when no target is provided', async () => {
    const action: PlayerAction = {
      phase: 'seer',
      playerId: 5,
      actionType: 'check',
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);
    expect(result.success).toBe(false);
    expect(result.message).toContain('必须选择查验目标');
  });
});
