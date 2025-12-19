import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { wsService } from '../services/websocket';
import { User } from '../../../shared/src/types';

export default function AdminDashboard() {
  const { user, token, clearAuth } = useAuthStore();
  const [users, setUsers] = useState<Omit<User, 'passwordHash'>[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'player' as 'admin' | 'god' | 'player' });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setUsers(data.data.users);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:3001/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newUser),
      });

      const data = await response.json();
      if (data.success) {
        setShowCreateForm(false);
        setNewUser({ username: '', password: '', role: 'player' });
        loadUsers();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error('Failed to create user:', err);
      alert('创建用户失败');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('确定要删除此用户吗？')) return;

    try {
      const response = await fetch(`http://localhost:3001/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success) {
        loadUsers();
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
      alert('删除用户失败');
    }
  };

  const handleLogout = () => {
    wsService.disconnect();
    clearAuth();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">管理员控制台</h1>
            <p className="text-gray-300">欢迎, {user?.username}</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
          >
            退出登录
          </button>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">用户管理</h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
            >
              {showCreateForm ? '取消' : '创建用户'}
            </button>
          </div>

          {showCreateForm && (
            <form onSubmit={handleCreateUser} className="mb-6 p-6 bg-white/5 rounded-lg space-y-4">
              <div>
                <label className="block text-white text-sm font-medium mb-2">用户名</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-white text-sm font-medium mb-2">密码</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-white text-sm font-medium mb-2">角色</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                  className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white"
                >
                  <option value="player">玩家</option>
                  <option value="god">上帝</option>
                  <option value="admin">管理员</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition"
              >
                创建
              </button>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left text-white py-3 px-4">用户名</th>
                  <th className="text-left text-white py-3 px-4">角色</th>
                  <th className="text-left text-white py-3 px-4">创建时间</th>
                  <th className="text-left text-white py-3 px-4">最后登录</th>
                  <th className="text-left text-white py-3 px-4">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-white/10 hover:bg-white/5">
                    <td className="text-gray-300 py-3 px-4">{u.username}</td>
                    <td className="text-gray-300 py-3 px-4">
                      {u.role === 'admin' ? '管理员' : u.role === 'god' ? '上帝' : '玩家'}
                    </td>
                    <td className="text-gray-300 py-3 px-4">
                      {new Date(u.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="text-gray-300 py-3 px-4">
                      {new Date(u.lastLogin).toLocaleString('zh-CN')}
                    </td>
                    <td className="text-gray-300 py-3 px-4">
                      {u.id !== user?.userId && (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition"
                        >
                          删除
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
