import { create } from 'zustand';
import { UserSession } from '../../../shared/src/types';

interface AuthState {
  user: UserSession | null;
  token: string | null;
  setAuth: (user: UserSession, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => {
    localStorage.setItem('token', token);
    set({ user, token });
  },
  clearAuth: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));
