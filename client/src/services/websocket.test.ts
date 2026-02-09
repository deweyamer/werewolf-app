import { describe, it, expect, beforeEach, vi } from 'vitest';

// Build a controllable fake socket
let socketEventHandlers: Record<string, Function> = {};
let ioEventHandlers: Record<string, Function> = {};
const mockSocket = {
  on: vi.fn((event: string, handler: Function) => {
    socketEventHandlers[event] = handler;
  }),
  emit: vi.fn(),
  disconnect: vi.fn(),
  connected: false,
  io: {
    on: vi.fn((event: string, handler: Function) => {
      ioEventHandlers[event] = handler;
    }),
  },
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

describe('WebSocketService', () => {
  let wsService: any;

  beforeEach(async () => {
    // Reset all mocks and state
    socketEventHandlers = {};
    ioEventHandlers = {};
    mockSocket.on.mockClear();
    mockSocket.emit.mockClear();
    mockSocket.disconnect.mockClear();
    mockSocket.connected = false;

    sessionStorage.clear();
    vi.resetModules();

    const module = await import('./websocket');
    wsService = module.wsService;
  });

  describe('connect', () => {
    it('已连接时不应该重复连接', async () => {
      // First connection
      wsService.connect('token-1');

      // Simulate connected state
      mockSocket.connected = true;

      // Get mock io to check call count
      const { io } = await import('socket.io-client');
      const callCount = (io as any).mock.calls.length;
      wsService.connect('token-2');
      // io should not be called again
      expect((io as any).mock.calls.length).toBe(callCount);
    });

    it('应该创建socket连接并发送AUTH消息', () => {
      wsService.connect('test-token');

      // The connect handler calls this.send() which checks this.socket?.connected
      mockSocket.connected = true;

      // Simulate the 'connect' event
      socketEventHandlers['connect']();

      expect(mockSocket.emit).toHaveBeenCalledWith('message', {
        type: 'AUTH',
        token: 'test-token',
      });
    });

    it('重连时应该自动rejoin上次的房间', () => {
      sessionStorage.setItem('werewolf_room_code', 'ROOM99');

      wsService.connect('test-token');

      // The connect handler calls this.send() which checks this.socket?.connected
      mockSocket.connected = true;

      socketEventHandlers['connect']();

      // Should send AUTH first
      expect(mockSocket.emit).toHaveBeenCalledWith('message', {
        type: 'AUTH',
        token: 'test-token',
      });
      // Then send JOIN_ROOM
      expect(mockSocket.emit).toHaveBeenCalledWith('message', {
        type: 'JOIN_ROOM',
        roomCode: 'ROOM99',
      });
    });

    it('连接时应该更新状态为connecting然后connected', () => {
      const statusUpdates: string[] = [];
      wsService.connect('test-token');

      wsService.onStatusChange((status: string) => {
        statusUpdates.push(status);
      });

      socketEventHandlers['connect']();
      expect(statusUpdates).toContain('connected');
    });
  });

  describe('disconnect', () => {
    it('应该断开连接并清理状态', () => {
      wsService.connect('test-token');
      wsService.disconnect();

      expect(mockSocket.disconnect).toHaveBeenCalled();
      expect(wsService.status).toBe('disconnected');
    });

    it('应该清除sessionStorage中的roomCode', () => {
      sessionStorage.setItem('werewolf_room_code', 'ROOM01');
      wsService.connect('test-token');
      wsService.disconnect();

      expect(sessionStorage.getItem('werewolf_room_code')).toBeNull();
    });
  });

  describe('send', () => {
    it('未连接时不应该发送消息', () => {
      mockSocket.connected = false;
      wsService.send({ type: 'AUTH', token: 'x' });
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });

    it('已连接时应该通过socket发送消息', () => {
      wsService.connect('test-token');
      mockSocket.connected = true;

      const msg = { type: 'JOIN_ROOM', roomCode: 'ABC123' };
      wsService.send(msg);

      expect(mockSocket.emit).toHaveBeenCalledWith('message', msg);
    });
  });

  describe('onMessage', () => {
    it('应该注册消息处理器并在收到消息时调用', () => {
      wsService.connect('test-token');
      const handler = vi.fn();
      wsService.onMessage(handler);

      const msg = { type: 'CONNECTED' };
      socketEventHandlers['message'](msg);

      expect(handler).toHaveBeenCalledWith(msg);
    });

    it('返回的函数应该取消注册', () => {
      wsService.connect('test-token');
      const handler = vi.fn();
      const unsubscribe = wsService.onMessage(handler);

      unsubscribe();
      socketEventHandlers['message']({ type: 'CONNECTED' });

      expect(handler).not.toHaveBeenCalled();
    });

    it('ROOM_JOINED消息应该保存roomCode到sessionStorage', () => {
      wsService.connect('test-token');
      wsService.onMessage(() => {}); // register a handler so message event fires

      socketEventHandlers['message']({
        type: 'ROOM_JOINED',
        game: { roomCode: 'SAVED1' },
      });

      expect(sessionStorage.getItem('werewolf_room_code')).toBe('SAVED1');
    });

    it('ROOM_LEFT消息应该清除sessionStorage中的roomCode', () => {
      sessionStorage.setItem('werewolf_room_code', 'OLD_ROOM');
      wsService.connect('test-token');
      wsService.onMessage(() => {});

      socketEventHandlers['message']({ type: 'ROOM_LEFT' });

      expect(sessionStorage.getItem('werewolf_room_code')).toBeNull();
    });
  });

  describe('onStatusChange', () => {
    it('注册时应该立即通知当前状态', () => {
      const handler = vi.fn();
      wsService.onStatusChange(handler);

      // Should be called immediately with current status
      expect(handler).toHaveBeenCalledWith(wsService.status);
    });

    it('返回的函数应该取消注册', () => {
      wsService.connect('test-token');
      const handler = vi.fn();
      const unsubscribe = wsService.onStatusChange(handler);
      handler.mockClear();

      unsubscribe();

      // Trigger a status change
      socketEventHandlers['connect']?.();

      // Handler should NOT be called after unsubscribe
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('断线重连', () => {
    it('服务器主动断开应该设置disconnected状态', () => {
      wsService.connect('test-token');
      socketEventHandlers['disconnect']('io server disconnect');

      expect(wsService.status).toBe('disconnected');
    });

    it('其他原因断开应该设置reconnecting状态', () => {
      wsService.connect('test-token');
      socketEventHandlers['disconnect']('transport close');

      expect(wsService.status).toBe('reconnecting');
    });

    it('重连失败应该设置disconnected状态', () => {
      wsService.connect('test-token');
      ioEventHandlers['reconnect_failed']();

      expect(wsService.status).toBe('disconnected');
    });
  });

  describe('clearRoomCode', () => {
    it('应该清除sessionStorage中的roomCode', () => {
      sessionStorage.setItem('werewolf_room_code', 'TO_CLEAR');
      wsService.clearRoomCode();
      expect(sessionStorage.getItem('werewolf_room_code')).toBeNull();
    });
  });

  describe('isConnected', () => {
    it('未连接时应该返回false', () => {
      expect(wsService.isConnected()).toBe(false);
    });

    it('已连接时应该返回true', () => {
      wsService.connect('test-token');
      mockSocket.connected = true;
      expect(wsService.isConnected()).toBe(true);
    });
  });
});
