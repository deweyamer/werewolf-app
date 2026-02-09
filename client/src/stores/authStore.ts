import { create } from 'zustand';
import { UserSession } from '../../../shared/src/types';

interface AuthState {
  user: UserSession | null;
  token: string | null;
  setAuth: (user: UserSession, token: string) => void;
  clearAuth: () => void;
}

// 从 localStorage 恢复用户信息
function loadPersistedAuth(): { user: UserSession | null; token: string | null } {
  try {
    const token = localStorage.getItem('token');
    const userJson = localStorage.getItem('user');
    if (token && userJson) {
      const user = JSON.parse(userJson) as UserSession;
      return { user, token };
    }
  } catch {
    // JSON 解析失败时清理
    localStorage.removeItem('user');
  }
  return { user: null, token: null };
}

const persisted = loadPersistedAuth();

export const useAuthStore = create<AuthState>((set) => ({
  user: persisted.user,
  token: persisted.token,
  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    set({ user, token });
  },
  clearAuth: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null });
  },
}));
