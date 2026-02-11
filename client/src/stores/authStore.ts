import { create } from 'zustand';
import { UserSession } from '../../../shared/src/types';

interface AuthState {
  user: UserSession | null;
  token: string | null;
  setAuth: (user: UserSession, token: string) => void;
  clearAuth: () => void;
}

// 从 sessionStorage 恢复用户信息（每个标签页独立）
function loadPersistedAuth(): { user: UserSession | null; token: string | null } {
  try {
    const token = sessionStorage.getItem('token');
    const userJson = sessionStorage.getItem('user');
    if (token && userJson) {
      const user = JSON.parse(userJson) as UserSession;
      return { user, token };
    }
  } catch {
    sessionStorage.removeItem('user');
  }
  return { user: null, token: null };
}

const persisted = loadPersistedAuth();

export const useAuthStore = create<AuthState>((set) => ({
  user: persisted.user,
  token: persisted.token,
  setAuth: (user, token) => {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(user));
    set({ user, token });
  },
  clearAuth: () => {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    set({ user: null, token: null });
  },
}));
