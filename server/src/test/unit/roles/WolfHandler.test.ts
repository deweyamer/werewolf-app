import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGame, createMockPlayer } from '../../helpers/GameTestHelper.js';
import { Game, PlayerAction } from '../../../../../shared/src/types.js';
import { WolfHandler } from '../../../game/roles/WolfHandler.js';

describe('WolfHandler', () => {
  let handler: WolfHandler;
  let game: Game;

  beforeEach(() => {
    handler = new WolfHandler();

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
    handler.initializeAbilities(game.players.find(p => p.playerId === 1)!);
  });

  it('should successfully vote to kill a good player', async () => {
    const action: PlayerAction = {
      phase: 'wolf',
      playerId: 1,
      actionType: 'kill',
      target: 10,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);

    expect(result.success).toBe(true);
    expect(game.nightActions.wolfKill).toBe(10);
    expect(game.nightActions.wolfSubmitted).toBe(true);
    expect(game.nightActions.wolfVotes![1]).toBe(10);
  });

  it('should not allow killing a wolf teammate', async () => {
    const action: PlayerAction = {
      phase: 'wolf',
      playerId: 1,
      actionType: 'kill',
      target: 2,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);
    expect(result.success).toBe(false);
    expect(result.message).toContain('不能刀狼人');
  });

  it('should update wolfKill when multiple wolves vote (last vote wins)', async () => {
    // Wolf 1 votes for player 10
    await handler.handleNightAction(game, {
      phase: 'wolf',
      playerId: 1,
      actionType: 'kill',
      target: 10,
      timestamp: new Date().toISOString(),
    });

    // Wolf 2 votes for player 11
    await handler.handleNightAction(game, {
      phase: 'wolf',
      playerId: 2,
      actionType: 'kill',
      target: 11,
      timestamp: new Date().toISOString(),
    });

    expect(game.nightActions.wolfVotes![1]).toBe(10);
    expect(game.nightActions.wolfVotes![2]).toBe(11);
    // Last vote determines final target
    expect(game.nightActions.wolfKill).toBe(11);
  });

  it('should only return good players from getValidTargets', () => {
    const targets = handler.getValidTargets(game, 1);

    // 8 good players: 5..12
    expect(targets.length).toBe(8);
    expect(targets).not.toContain(1);
    expect(targets).not.toContain(2);
    expect(targets).not.toContain(3);
    expect(targets).not.toContain(4);
    expect(targets).toContain(5);
    expect(targets).toContain(12);
  });
});
