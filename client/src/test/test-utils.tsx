/**
 * 共享测试工具
 * 提供自定义渲染函数、Store mock 辅助函数、wsService mock 等
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { ToastProvider } from '../components/Toast';
import { ServerMessage } from '../../../shared/src/types';

// ===== 自定义渲染（含 Provider 包裹）=====

function AllProviders({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter>
      <ToastProvider>
        {children}
      </ToastProvider>
    </BrowserRouter>
  );
}

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// ===== Store Mock 辅助 =====

export function mockAuthStore(state: {
  user?: { userId: string; username: string; role: string } | null;
  token?: string | null;
  setAuth?: ReturnType<typeof vi.fn>;
  clearAuth?: ReturnType<typeof vi.fn>;
}) {
  const { useAuthStore } = require('../stores/authStore');
  (useAuthStore as any).mockReturnValue({
    user: state.user ?? null,
    token: state.token ?? null,
    setAuth: state.setAuth ?? vi.fn(),
    clearAuth: state.clearAuth ?? vi.fn(),
  });
}

export function mockGameStore(state: {
  currentGame?: any;
  setGame?: ReturnType<typeof vi.fn>;
  clearGame?: ReturnType<typeof vi.fn>;
}) {
  const { useGameStore } = require('../stores/gameStore');
  (useGameStore as any).mockReturnValue({
    currentGame: state.currentGame ?? null,
    setGame: state.setGame ?? vi.fn(),
    clearGame: state.clearGame ?? vi.fn(),
  });
}

// ===== wsService Mock =====

let _messageHandlers: ((msg: ServerMessage) => void)[] = [];

export const mockWsService = {
  send: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  clearRoomCode: vi.fn(),
  isConnected: vi.fn(() => true),
  status: 'connected' as const,
  onMessage: vi.fn((handler: (msg: ServerMessage) => void) => {
    _messageHandlers.push(handler);
    return () => {
      const idx = _messageHandlers.indexOf(handler);
      if (idx > -1) _messageHandlers.splice(idx, 1);
    };
  }),
  onStatusChange: vi.fn((handler: (status: string) => void) => {
    handler('connected');
    return () => {};
  }),
};

export function simulateServerMessage(msg: ServerMessage) {
  _messageHandlers.forEach(h => h(msg));
}

export function resetWsMock() {
  _messageHandlers = [];
  mockWsService.send.mockClear();
  mockWsService.connect.mockClear();
  mockWsService.disconnect.mockClear();
  mockWsService.clearRoomCode.mockClear();
  mockWsService.isConnected.mockClear();
  mockWsService.onMessage.mockClear();
  mockWsService.onStatusChange.mockClear();
}

// ===== confirm() Mock =====

export function mockConfirm(returnValue = true) {
  return vi.spyOn(window, 'confirm').mockReturnValue(returnValue);
}

// Re-export testing-library utilities for convenience
export { screen, waitFor, within } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
