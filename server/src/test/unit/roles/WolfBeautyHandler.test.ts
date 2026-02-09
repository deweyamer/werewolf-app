import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGame, createMockPlayer } from '../../helpers/GameTestHelper.js';
import { Game, PlayerAction } from '../../../../../shared/src/types.js';
import { WolfBeautyHandler } from '../../../game/roles/WolfBeautyHandler.js';

describe('WolfBeautyHandler', () => {
  let handler: WolfBeautyHandler;
  let game: Game;

  beforeEach(() => {
    handler = new WolfBeautyHandler();

    const players = [
      createMockPlayer(1, 'wolf', 'wolf'),
      createMockPlayer(2, 'wolf', 'wolf'),
      createMockPlayer(3, 'wolf', 'wolf'),
      createMockPlayer(4, 'wolf_beauty', 'wolf'),
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
    handler.initializeAbilities(game.players.find(p => p.playerId === 4)!);
  });

  it('should create LINK effect when charming a good player', async () => {
    const action: PlayerAction = {
      phase: 'wolf_beauty',
      playerId: 4,
      actionType: 'charm',
      target: 10,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);

    expect(result.success).toBe(true);
    expect(result.effect).toBeDefined();
    expect(result.effect!.type).toBe('link');
    expect(result.effect!.actorId).toBe(4);
    expect(result.effect!.targetId).toBe(10);
  });

  it('should not allow charming self', async () => {
    const action: PlayerAction = {
      phase: 'wolf_beauty',
      playerId: 4,
      actionType: 'charm',
      target: 4,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);
    expect(result.success).toBe(false);
    expect(result.message).toContain('不能魅惑自己');
  });

  it('should not allow charming a wolf teammate', async () => {
    const action: PlayerAction = {
      phase: 'wolf_beauty',
      playerId: 4,
      actionType: 'charm',
      target: 1,
      timestamp: new Date().toISOString(),
    };

    const result = await handler.handleNightAction(game, action);
    expect(result.success).toBe(false);
    expect(result.message).toContain('不能魅惑狼人');
  });
});
