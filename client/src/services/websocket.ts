import { io, Socket } from 'socket.io-client';
import { ClientMessage, ServerMessage } from '../../../shared/src/types';
import { config } from '../config';

class WebSocketService {
  private socket: Socket | null = null;
  private messageHandlers: ((message: ServerMessage) => void)[] = [];

  connect(token: string) {
    if (this.socket?.connected) {
      return;
    }

    this.socket = io(config.wsUrl, {
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.send({ type: 'AUTH', token });
    });

    this.socket.on('message', (message: ServerMessage) => {
      console.log('Received:', message);
      this.messageHandlers.forEach((handler) => handler(message));
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
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

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const wsService = new WebSocketService();
