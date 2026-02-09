import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { useAuthStore } from './stores/authStore';

// Mock stores
vi.mock('./stores/authStore');

// Mock page components as stubs
vi.mock('./pages/LoginPage', () => ({
  default: () => <div data-testid="login-page">LoginPage</div>,
}));

vi.mock('./pages/AdminDashboard', () => ({
  default: () => <div data-testid="admin-dashboard">AdminDashboard</div>,
}));

vi.mock('./pages/GodConsole', () => ({
  default: () => <div data-testid="god-console">GodConsole</div>,
}));

vi.mock('./pages/PlayerView', () => ({
  default: () => <div data-testid="player-view">PlayerView</div>,
}));

vi.mock('./components/ConnectionStatus', () => ({
  default: () => <div data-testid="connection-status">ConnectionStatus</div>,
}));

describe('App 路由', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未登录时应该显示LoginPage', () => {
    (useAuthStore as any).mockReturnValue({ user: null });

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('connection-status')).not.toBeInTheDocument();
  });

  it('admin用户应该导航到AdminDashboard', () => {
    (useAuthStore as any).mockReturnValue({
      user: { userId: 'a1', username: 'Admin', role: 'admin' },
    });

    render(
      <MemoryRouter initialEntries={['/admin']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('admin-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('connection-status')).toBeInTheDocument();
  });

  it('god用户应该导航到GodConsole', () => {
    (useAuthStore as any).mockReturnValue({
      user: { userId: 'g1', username: 'God', role: 'god' },
    });

    render(
      <MemoryRouter initialEntries={['/god']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('god-console')).toBeInTheDocument();
    expect(screen.getByTestId('connection-status')).toBeInTheDocument();
  });

  it('player用户应该导航到PlayerView', () => {
    (useAuthStore as any).mockReturnValue({
      user: { userId: 'p1', username: 'Player', role: 'player' },
    });

    render(
      <MemoryRouter initialEntries={['/player']}>
        <App />
      </MemoryRouter>
    );

    expect(screen.getByTestId('player-view')).toBeInTheDocument();
    expect(screen.getByTestId('connection-status')).toBeInTheDocument();
  });

  it('已登录用户访问未知路径应该重定向到对应页面', () => {
    (useAuthStore as any).mockReturnValue({
      user: { userId: 'p1', username: 'Player', role: 'player' },
    });

    render(
      <MemoryRouter initialEntries={['/unknown']}>
        <App />
      </MemoryRouter>
    );

    // Should redirect to /player
    expect(screen.getByTestId('player-view')).toBeInTheDocument();
  });
});
