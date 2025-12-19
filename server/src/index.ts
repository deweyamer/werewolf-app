import express from 'express';
import { createServer } from 'http';
import { AuthService } from './services/AuthService.js';
import { ScriptService } from './services/ScriptService.js';
import { GameService } from './services/GameService.js';
import { SocketManager } from './websocket/SocketManager.js';

const PORT = process.env.PORT || 3001;

async function main() {
  console.log('Initializing Werewolf Server...');

  // 初始化服务
  const authService = new AuthService();
  const scriptService = new ScriptService();
  const gameService = new GameService(scriptService);

  await authService.init();
  await scriptService.init();
  await gameService.init();

  console.log('Services initialized');

  // 创建 Express 应用
  const app = express();
  app.use(express.json());

  // CORS
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // REST API 路由
  app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const session = await authService.login(username, password);
    if (!session) {
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }
    res.json({ success: true, data: { user: session, token: session.token } });
  });

  app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
    }
    if (password.length < 4) {
      return res.status(400).json({ success: false, error: '密码长度至少4位' });
    }
    const user = await authService.register(username, password);
    if (!user) {
      return res.status(400).json({ success: false, error: '用户名已存在' });
    }
    res.json({ success: true, data: { userId: user.id, username: user.username } });
  });

  app.post('/api/auth/logout', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      await authService.logout(token);
    }
    res.json({ success: true });
  });

  app.get('/api/scripts', async (req, res) => {
    const scripts = scriptService.listScripts();
    res.json({ success: true, data: { scripts } });
  });

  app.get('/api/scripts/:id', async (req, res) => {
    const script = scriptService.getScript(req.params.id);
    if (!script) {
      return res.status(404).json({ success: false, error: '剧本不存在' });
    }
    res.json({ success: true, data: script });
  });

  app.get('/api/games', async (req, res) => {
    const games = gameService.listGames();
    res.json({ success: true, data: { games } });
  });

  app.get('/api/games/:id', async (req, res) => {
    const game = gameService.getGame(req.params.id);
    if (!game) {
      return res.status(404).json({ success: false, error: '游戏不存在' });
    }
    res.json({ success: true, data: game });
  });

  // 管理员 API
  app.post('/api/admin/users', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = token ? await authService.validateToken(token) : null;

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '需要管理员权限' });
    }

    const { username, password, role } = req.body;
    const newUser = await authService.createUser(username, password, role);
    if (!newUser) {
      return res.status(400).json({ success: false, error: '用户名已存在' });
    }

    res.json({ success: true, data: newUser });
  });

  app.get('/api/admin/users', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = token ? await authService.validateToken(token) : null;

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '需要管理员权限' });
    }

    const users = await authService.listUsers();
    res.json({ success: true, data: { users } });
  });

  app.delete('/api/admin/users/:id', async (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = token ? await authService.validateToken(token) : null;

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, error: '需要管理员权限' });
    }

    const success = await authService.deleteUser(req.params.id);
    if (!success) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    res.json({ success: true });
  });

  // 健康检查
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // 创建 HTTP 服务器
  const httpServer = createServer(app);

  // 初始化 WebSocket
  new SocketManager(httpServer, authService, gameService, scriptService);

  // 启动服务器
  httpServer.listen(PORT, () => {
    console.log(`🎮 Werewolf Server is running on port ${PORT}`);
    console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
    console.log(`🔧 REST API endpoint: http://localhost:${PORT}/api`);
    console.log(`\n默认管理员账号：`);
    console.log(`  用户名: admin`);
    console.log(`  密码: admin123`);
  });
}

main().catch(console.error);
