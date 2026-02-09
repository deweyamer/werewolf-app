import { io, Socket } from 'socket.io-client';
import { ClientMessage, ServerMessage } from '../../../shared/src/types';
import { config } from '../config';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

class WebSocketService {
  private socket: Socket | null = null;
  private messageHandlers: ((message: ServerMessage) => void)[] = [];
  private statusHandlers: ((status: ConnectionStatus) => void)[] = [];
  private _status: ConnectionStatus = 'disconnected';
  private _token: string | null = null;
  private _lastRoomCode: string | null = null;

  get status(): ConnectionStatus {
    return this._status;
  }

  private setStatus(status: ConnectionStatus) {
    this._status = status;
    this.statusHandlers.forEach((handler) => handler(status));
  }

  connect(token: string) {
    if (this.socket?.connected) {
      return;
    }

    this._token = token;
    this.setStatus('connecting');

    // 读取上次的房间码（用于重连后自动 rejoin）
    this._lastRoomCode = sessionStorage.getItem('werewolf_room_code');

    this.socket = io(config.wsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.setStatus('connected');
      this.send({ type: 'AUTH', token });

      // 重连后自动 rejoin 上次的房间
      if (this._lastRoomCode) {
        this.send({ type: 'JOIN_ROOM', roomCode: this._lastRoomCode });
      }
    });

    this.socket.on('message', (message: ServerMessage) => {
      console.log('Received:', message);

      // 记录成功加入的房间
      if (message.type === 'ROOM_JOINED' && message.game?.roomCode) {
        this._lastRoomCode = message.game.roomCode;
        sessionStorage.setItem('werewolf_room_code', message.game.roomCode);
      }
      if (message.type === 'ROOM_LEFT') {
        this._lastRoomCode = null;
        sessionStorage.removeItem('werewolf_room_code');
      }

      this.messageHandlers.forEach((handler) => handler(message));
    });

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      // socket.io 的 reconnection 机制会自动处理部分 reason
      if (reason === 'io server disconnect') {
        // 服务器主动断开，不自动重连
        this.setStatus('disconnected');
      } else {
        this.setStatus('reconnecting');
      }
    });

    this.socket.io.on('reconnect_attempt', (attempt) => {
      console.log(`Reconnect attempt ${attempt}`);
      this.setStatus('reconnecting');
    });

    this.socket.io.on('reconnect_failed', () => {
      console.log('Reconnect failed');
      this.setStatus('disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this._token = null;
    this._lastRoomCode = null;
    sessionStorage.removeItem('werewolf_room_code');
    this.setStatus('disconnected');
  }

  send(message: ClientMessage) {
    if (!this.socket?.connected) {
      console.error('WebSocket not connected');
      return;
    }
    console.log('Sending:', message);
    this.socket.emit('message', message);
  }

  onMessage(handler: (message: ServerMessage) => void) {
    this.messageHandlers.push(handler);
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  onStatusChange(handler: (status: ConnectionStatus) => void) {
    this.statusHandlers.push(handler);
    // 立即通知当前状态
    handler(this._status);
    return () => {
      const index = this.statusHandlers.indexOf(handler);
      if (index > -1) {
        this.statusHandlers.splice(index, 1);
      }
    };
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  clearRoomCode() {
    this._lastRoomCode = null;
    sessionStorage.removeItem('werewolf_room_code');
  }
}

export const wsService = new WebSocketService();
