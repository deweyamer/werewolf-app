import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useGameSocket } from './useGameSocket';
import { createMockGame, createMockPlayer } from '../test/mockData/gameMocks';

// Mock wsService
const _messageHandlers: ((msg: any) => void)[] = [];
vi.mock('../services/websocket', () => ({
  wsService: {
    onMessage: vi.fn((handler: (msg: any) => void) => {
      _messageHandlers.push(handler);
      return () => {
        const idx = _messageHandlers.indexOf(handler);
        if (idx > -1) _messageHandlers.splice(idx, 1);
      };
    }),
  },
}));

// Mock gameStore
const mockSetGame = vi.fn();
let mockCurrentGame: any = null;
vi.mock('../stores/gameStore', () => ({
  useGameStore: () => ({
    currentGame: mockCurrentGame,
    setGame: mockSetGame,
  }),
}));

function simulateMessage(msg: any) {
  // Copy handlers since they may mutate during iteration
  [..._messageHandlers].forEach(h => h(msg));
}

describe('useGameSocket', () => {
  beforeEach(() => {
    _messageHandlers.length = 0;
    mockSetGame.mockClear();
    mockCurrentGame = null;
  });

  describe('通用消息处理', () => {
    it('ROOM_JOINED应该调用setGame', () => {
      const game = createMockGame({ roomCode: 'JOIN01' });
      renderHook(() => useGameSocket());

      simulateMessage({ type: 'ROOM_JOINED', game });

      expect(mockSetGame).toHaveBeenCalledWith(game);
    });

    it('GAME_STATE_UPDATE应该调用setGame', () => {
      const game = createMockGame({ currentPhase: 'seer' });
      renderHook(() => useGameSocket());

      simulateMessage({ type: 'GAME_STATE_UPDATE', game });

      expect(mockSetGame).toHaveBeenCalledWith(game);
    });

    it('PLAYER_JOINED应该添加新玩家到currentGame', () => {
      const existingPlayer = createMockPlayer({ playerId: 1, username: 'Existing' });
      mockCurrentGame = createMockGame({ players: [existingPlayer] });

      const newPlayer = createMockPlayer({ playerId: 2, username: 'NewPlayer' });
      renderHook(() => useGameSocket());

      simulateMessage({ type: 'PLAYER_JOINED', player: newPlayer });

      expect(mockSetGame).toHaveBeenCalledTimes(1);
      const updatedGame = mockSetGame.mock.calls[0][0];
      expect(updatedGame.players).toHaveLength(2);
      expect(updatedGame.players[1]).toEqual(newPlayer);
    });

    it('PLAYER_JOINED无currentGame时不应该调用setGame', () => {
      mockCurrentGame = null;
      renderHook(() => useGameSocket());

      simulateMessage({ type: 'PLAYER_JOINED', player: createMockPlayer() });

      expect(mockSetGame).not.toHaveBeenCalled();
    });
  });

  describe('页面消息委派', () => {
    it('应该将所有消息转发给onPageMessage回调', () => {
      const pageHandler = vi.fn();
      renderHook(() => useGameSocket(pageHandler));

      const msg = { type: 'ROLE_ASSIGNED' as const, role: 'wolf', camp: 'wolf' as const };
      simulateMessage(msg);

      expect(pageHandler).toHaveBeenCalledWith(msg);
    });

    it('无回调时不应该报错', () => {
      renderHook(() => useGameSocket());

      // Should not throw
      expect(() => {
        simulateMessage({ type: 'SOME_MESSAGE' });
      }).not.toThrow();
    });

    it('通用消息也应该转发给onPageMessage', () => {
      const pageHandler = vi.fn();
      const game = createMockGame();
      renderHook(() => useGameSocket(pageHandler));

      simulateMessage({ type: 'ROOM_JOINED', game });

      // setGame should be called (通用处理)
      expect(mockSetGame).toHaveBeenCalledWith(game);
      // pageHandler should also be called (委派)
      expect(pageHandler).toHaveBeenCalledWith({ type: 'ROOM_JOINED', game });
    });
  });

  describe('清理', () => {
    it('卸载时应该取消消息订阅', () => {
      const { unmount } = renderHook(() => useGameSocket());

      expect(_messageHandlers).toHaveLength(1);

      unmount();

      expect(_messageHandlers).toHaveLength(0);
    });
  });
});
