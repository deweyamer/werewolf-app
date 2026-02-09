import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGame, createMockPlayer } from '../../helpers/GameTestHelper.js';
import { Game, PlayerAction } from '../../../../../shared/src/types.js';
import { WhiteWolfHandler } from '../../../game/roles/WhiteWolfHandler.js';

describe('WhiteWolfHandler', () => {
  let handler: WhiteWolfHandler;
  let game: Game;

  beforeEach(() => {
    handler = new WhiteWolfHandler();

    const players = [
      createMockPlayer(1, 'white_wolf', 'wolf'),
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

  it('should self-destruct on boom action, marking player dead', async () => {
    const action: PlayerAction = {
      phase: 'discussion',
      playerId: 1,
      actionType: 'boom',
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleDayAction(game, action);
    const whiteWolf = game.players.find(p => p.playerId === 1)!;

    expect(result.success).toBe(true);
    expect(result.effect).toBeDefined();
    expect(result.effect!.type).toBe('self_destruct');
    expect(whiteWolf.alive).toBe(false);
    expect(whiteWolf.outReason).toBe('self_destruct');
    expect(whiteWolf.abilities.whiteWolfBoomUsed).toBe(true);
    expect(result.data.skipToNight).toBe(true);
  });

  it('should handle sheriff badge transfer when white wolf is sheriff', async () => {
    const whiteWolf = game.players.find(p => p.playerId === 1)!;
    whiteWolf.isSheriff = true;
    game.sheriffId = 1;

    const action: PlayerAction = {
      phase: 'discussion',
      playerId: 1,
      actionType: 'boom',
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleDayAction(game, action);

    expect(result.success).toBe(true);
    expect(result.data.sheriffPendingAssign).toBe(true);
    expect(whiteWolf.isSheriff).toBe(false);
    expect(game.sheriffId).toBe(0);
    expect(game.sheriffBadgeState).toBe('pending_assign');
    expect(game.pendingSheriffTransfer).toBeDefined();
    expect(game.pendingSheriffTransfer!.fromPlayerId).toBe(1);
    expect(game.pendingSheriffTransfer!.reason).toBe('wolf_explosion');
  });

  it('should prevent using self-destruct twice', async () => {
    game.players.find(p => p.playerId === 1)!.abilities.whiteWolfBoomUsed = true;

    const action: PlayerAction = {
      phase: 'discussion',
      playerId: 1,
      actionType: 'boom',
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleDayAction(game, action);
    expect(result.success).toBe(false);
    expect(result.message).toContain('已经使用过了');
  });
});
