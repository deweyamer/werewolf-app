import { describe, it, expect, beforeEach } from 'vitest';
import { useGameStore } from './gameStore';
import { createMockGame } from '../test/mockData/gameMocks';

describe('gameStore', () => {
  beforeEach(() => {
    useGameStore.setState({ currentGame: null });
  });

  it('初始化currentGame应该为null', () => {
    expect(useGameStore.getState().currentGame).toBeNull();
  });

  it('setGame应该更新currentGame', () => {
    const game = createMockGame();
    useGameStore.getState().setGame(game);

    expect(useGameStore.getState().currentGame).toEqual(game);
  });

  it('clearGame应该清空currentGame', () => {
    const game = createMockGame();
    useGameStore.getState().setGame(game);
    expect(useGameStore.getState().currentGame).not.toBeNull();

    useGameStore.getState().clearGame();
    expect(useGameStore.getState().currentGame).toBeNull();
  });

  it('多次setGame应该保留最新的游戏状态', () => {
    const game1 = createMockGame({ roomCode: 'ROOM01' });
    const game2 = createMockGame({ roomCode: 'ROOM02' });

    useGameStore.getState().setGame(game1);
    expect(useGameStore.getState().currentGame!.roomCode).toBe('ROOM01');

    useGameStore.getState().setGame(game2);
    expect(useGameStore.getState().currentGame!.roomCode).toBe('ROOM02');
  });
});
