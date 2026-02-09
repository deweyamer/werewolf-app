import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { useAuthStore } from '../stores/authStore';
import { ToastProvider } from '../components/Toast';

// Mock stores
vi.mock('../stores/authStore');

// Mock websocket service
vi.mock('../services/websocket', () => ({
  wsService: {
    connect: vi.fn(),
  },
}));

// Mock config
vi.mock('../config', () => ({
  config: { apiUrl: 'http://localhost:3000' },
}));

const { wsService } = await import('../services/websocket');

const mockSetAuth = vi.fn();

function renderLogin() {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <LoginPage />
      </ToastProvider>
    </BrowserRouter>
  );
}

/** Get the submit button (type="submit") */
function getSubmitButton() {
  const form = document.querySelector('form')!;
  return form.querySelector('button[type="submit"]') as HTMLButtonElement;
}

/** Get the register tab button (type="button") */
function getRegisterTab() {
  // The register tab is a type="button" with text "注册"
  const buttons = screen.getAllByRole('button');
  return buttons.find(b => b.getAttribute('type') === 'button' && b.textContent === '注册')!;
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthStore as any).mockReturnValue({ setAuth: mockSetAuth });
    global.fetch = vi.fn();
  });

  describe('渲染', () => {
    it('应该渲染登录表单和标题', () => {
      renderLogin();

      expect(screen.getByText(/狼人杀/)).toBeInTheDocument();
      expect(screen.getByPlaceholderText('请输入用户名')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('请输入密码')).toBeInTheDocument();
    });

    it('默认应该是登录模式', () => {
      renderLogin();

      const submitBtn = getSubmitButton();
      expect(submitBtn.textContent).toBe('登录');
    });
  });

  describe('模式切换', () => {
    it('点击注册应该切换到注册模式', async () => {
      renderLogin();

      await userEvent.click(getRegisterTab());

      const submitBtn = getSubmitButton();
      expect(submitBtn.textContent).toBe('注册');
    });
  });

  describe('登录流程', () => {
    it('成功登录应该调用setAuth和wsService.connect', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: () => Promise.resolve({
          success: true,
          data: {
            user: { userId: 'u1', username: 'Test', role: 'player' },
            token: 'jwt-token',
          },
        }),
      });

      renderLogin();

      await userEvent.type(screen.getByPlaceholderText('请输入用户名'), 'testuser');
      await userEvent.type(screen.getByPlaceholderText('请输入密码'), 'pass123');
      await userEvent.click(getSubmitButton());

      await waitFor(() => {
        expect(mockSetAuth).toHaveBeenCalledWith(
          { userId: 'u1', username: 'Test', role: 'player' },
          'jwt-token'
        );
        expect(wsService.connect).toHaveBeenCalledWith('jwt-token');
      });
    });

    it('登录失败应该显示错误', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: '密码错误' }),
      });

      renderLogin();

      await userEvent.type(screen.getByPlaceholderText('请输入用户名'), 'test');
      await userEvent.type(screen.getByPlaceholderText('请输入密码'), 'wrong');
      await userEvent.click(getSubmitButton());

      await waitFor(() => {
        expect(screen.getByText('密码错误')).toBeInTheDocument();
      });
    });

    it('网络错误应该显示提示', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      renderLogin();

      await userEvent.type(screen.getByPlaceholderText('请输入用户名'), 'test');
      await userEvent.type(screen.getByPlaceholderText('请输入密码'), 'pass');
      await userEvent.click(getSubmitButton());

      await waitFor(() => {
        expect(screen.getByText(/网络错误/)).toBeInTheDocument();
      });
    });

    it('提交时应该显示loading状态', async () => {
      let resolvePromise: Function;
      (global.fetch as any).mockReturnValueOnce(
        new Promise((resolve) => { resolvePromise = resolve; })
      );

      renderLogin();

      await userEvent.type(screen.getByPlaceholderText('请输入用户名'), 'test');
      await userEvent.type(screen.getByPlaceholderText('请输入密码'), 'pass');
      await userEvent.click(getSubmitButton());

      expect(screen.getByText('登录中...')).toBeInTheDocument();

      // Resolve to clean up
      resolvePromise!({
        json: () => Promise.resolve({ success: false, error: 'timeout' }),
      });

      await waitFor(() => {
        expect(screen.queryByText('登录中...')).not.toBeInTheDocument();
      });
    });
  });

  describe('注册流程', () => {
    it('成功注册应该切回登录模式', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: () => Promise.resolve({ success: true }),
      });

      renderLogin();
      await userEvent.click(getRegisterTab());

      await userEvent.type(screen.getByPlaceholderText('请输入用户名'), 'newuser');
      await userEvent.type(screen.getByPlaceholderText('请输入密码'), 'pass123');
      await userEvent.click(getSubmitButton());

      await waitFor(() => {
        const submitBtn = getSubmitButton();
        expect(submitBtn.textContent).toBe('登录');
      });
    });

    it('注册失败应该显示错误', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: () => Promise.resolve({ success: false, error: '用户名已存在' }),
      });

      renderLogin();
      await userEvent.click(getRegisterTab());

      await userEvent.type(screen.getByPlaceholderText('请输入用户名'), 'existing');
      await userEvent.type(screen.getByPlaceholderText('请输入密码'), 'pass');
      await userEvent.click(getSubmitButton());

      await waitFor(() => {
        expect(screen.getByText('用户名已存在')).toBeInTheDocument();
      });
    });
  });
});
