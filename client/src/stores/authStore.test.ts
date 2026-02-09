import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('authStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  async function importAuthStore() {
    const module = await import('./authStore');
    return module.useAuthStore;
  }

  describe('初始化', () => {
    it('localStorage为空时应该初始化为null', async () => {
      const useAuthStore = await importAuthStore();
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
    });

    it('localStorage有有效数据时应该恢复用户状态', async () => {
      const mockUser = { userId: 'u1', username: 'test', role: 'player' };
      localStorage.setItem('token', 'saved-token');
      localStorage.setItem('user', JSON.stringify(mockUser));

      const useAuthStore = await importAuthStore();
      const state = useAuthStore.getState();

      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('saved-token');
    });

    it('localStorage有无效JSON时应该清理并返回null', async () => {
      localStorage.setItem('token', 'some-token');
      localStorage.setItem('user', '{{invalid json}}');

      const useAuthStore = await importAuthStore();
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });

    it('有token但无user时应该返回null', async () => {
      localStorage.setItem('token', 'orphan-token');

      const useAuthStore = await importAuthStore();
      const state = useAuthStore.getState();

      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
    });
  });

  describe('setAuth', () => {
    it('应该更新store状态并写入localStorage', async () => {
      const useAuthStore = await importAuthStore();
      const mockUser = { userId: 'u2', username: 'player2', role: 'god' };

      useAuthStore.getState().setAuth(mockUser as any, 'new-token');

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('new-token');
      expect(localStorage.getItem('token')).toBe('new-token');
      expect(JSON.parse(localStorage.getItem('user')!)).toEqual(mockUser);
    });
  });

  describe('clearAuth', () => {
    it('应该清空store状态和localStorage', async () => {
      const useAuthStore = await importAuthStore();
      const mockUser = { userId: 'u3', username: 'player3', role: 'player' };

      useAuthStore.getState().setAuth(mockUser as any, 'token-to-clear');
      expect(useAuthStore.getState().user).not.toBeNull();

      useAuthStore.getState().clearAuth();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().token).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });
  });
});
