import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { wsService } from '../services/websocket';
import { config } from '../config';
import { useToast } from '../components/Toast';

export default function LoginPage() {
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const { setAuth } = useAuthStore();
  const autoLoginAttempted = useRef(false);

  // URL 参数自动登录：?user=test1&pwd=test
  useEffect(() => {
    if (autoLoginAttempted.current) return;
    autoLoginAttempted.current = true;

    const params = new URLSearchParams(window.location.search);
    const autoUser = params.get('user');
    const autoPwd = params.get('pwd');
    if (!autoUser || !autoPwd) return;

    // 清除 URL 参数（避免刷新重复登录）
    window.history.replaceState({}, '', window.location.pathname);

    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`${config.apiUrl}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: autoUser, password: autoPwd }),
        });
        const data = await response.json();
        if (data.success) {
          setAuth(data.data.user, data.data.token);
          wsService.connect(data.data.token);
        } else {
          setError(`自动登录失败: ${data.error || '未知错误'}`);
        }
      } catch {
        setError('自动登录失败: 网络错误');
      } finally {
        setLoading(false);
      }
    })();
  }, [setAuth]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${config.apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        toast('注册成功！请登录', 'success');
        setIsRegisterMode(false);
        setPassword('');
      } else {
        setError(data.error || '注册失败');
      }
    } catch (err) {
      setError('网络错误，请检查服务器是否运行');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${config.apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        setAuth(data.data.user, data.data.token);
        wsService.connect(data.data.token);
      } else {
        setError(data.error || '登录失败');
      }
    } catch (err) {
      setError('网络错误，请检查服务器是否运行');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl w-full max-w-md border border-white/20">
        <h1 className="text-4xl font-bold text-white text-center mb-8">
          🐺 狼人杀
        </h1>
        <p className="text-gray-300 text-center mb-8">线下面杀版</p>

        <div className="flex justify-center mb-6">
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(false);
              setError('');
            }}
            className={`px-6 py-2 rounded-l-lg transition ${
              !isRegisterMode
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegisterMode(true);
              setError('');
            }}
            className={`px-6 py-2 rounded-r-lg transition ${
              isRegisterMode
                ? 'bg-purple-600 text-white'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            注册
          </button>
        </div>

        <form onSubmit={isRegisterMode ? handleRegister : handleLogin} className="space-y-6">
          <div>
            <label className="block text-white text-sm font-medium mb-2">
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="请输入用户名"
              required
            />
          </div>

          <div>
            <label className="block text-white text-sm font-medium mb-2">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="请输入密码"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (isRegisterMode ? '注册中...' : '登录中...') : (isRegisterMode ? '注册' : '登录')}
          </button>
        </form>

        <div className="mt-8 text-center text-gray-400 text-sm space-y-1">
          {!isRegisterMode && (
            <>
              <p>默认管理员账号：admin / admin123</p>
              <p>默认上帝账号：god / god</p>
              <p className="text-purple-300 mt-2">玩家可以点击"注册"创建账号</p>
            </>
          )}
          {isRegisterMode && (
            <p className="text-purple-300">注册成功后将自动成为玩家角色</p>
          )}
        </div>
      </div>
    </div>
  );
}
