import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { User, UserSession, UserRole } from '../../../shared/src/types.js';
import { SESSION_TIMEOUT } from '../../../shared/src/constants.js';

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export class AuthService {
  private users: User[] = [];
  private sessions: Map<string, SessionRecord> = new Map();

  async init() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await this.loadUsers();
    await this.loadSessions();
    await this.ensureDefaultAdmin();
    await this.ensureDefaultGod();
    await this.ensureTestPlayers();
  }

  private async loadUsers() {
    try {
      const data = await fs.readFile(USERS_FILE, 'utf-8');
      this.users = JSON.parse(data);
    } catch (error) {
      this.users = [];
    }
  }

  private async saveUsers() {
    await fs.writeFile(USERS_FILE, JSON.stringify(this.users, null, 2));
  }

  private async loadSessions() {
    try {
      const data = await fs.readFile(SESSIONS_FILE, 'utf-8');
      const sessions: SessionRecord[] = JSON.parse(data);
      this.sessions = new Map(sessions.map(s => [s.token, s]));
      this.cleanExpiredSessions();
    } catch (error) {
      this.sessions = new Map();
    }
  }

  private async saveSessions() {
    const sessions = Array.from(this.sessions.values());
    await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  }

  private cleanExpiredSessions() {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (new Date(session.expiresAt).getTime() < now) {
        this.sessions.delete(token);
      }
    }
  }

  private async ensureDefaultAdmin() {
    const adminExists = this.users.some(u => u.role === 'admin');
    if (!adminExists) {
      const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10);
      const admin: User = {
        id: uuidv4(),
        username: process.env.ADMIN_USERNAME || 'admin',
        passwordHash,
        role: 'admin',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      this.users.push(admin);
      await this.saveUsers();
    }
  }

  private async ensureDefaultGod() {
    const godExists = this.users.some(u => u.username === 'god');
    if (!godExists) {
      const passwordHash = await bcrypt.hash(process.env.GOD_PASSWORD || 'god', 10);
      const god: User = {
        id: uuidv4(),
        username: process.env.GOD_USERNAME || 'god',
        passwordHash,
        role: 'god',
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      this.users.push(god);
      await this.saveUsers();
    }
  }

  private async ensureTestPlayers() {
    // 创建12个测试玩家账号: test1-test12, 密码都是 test
    for (let i = 1; i <= 12; i++) {
      const username = `test${i}`;
      const exists = this.users.some(u => u.username === username);
      if (!exists) {
        const passwordHash = await bcrypt.hash(process.env.TEST_PLAYER_PASSWORD || 'test', 10);
        const player: User = {
          id: uuidv4(),
          username,
          passwordHash,
          role: 'player',
          createdAt: new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        };
        this.users.push(player);
      }
    }
    await this.saveUsers();
  }

  async login(username: string, password: string): Promise<UserSession | null> {
    const user = this.users.find(u => u.username === username);
    if (!user) return null;

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;

    const token = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TIMEOUT);

    const session: SessionRecord = {
      token,
      userId: user.id,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    this.sessions.set(token, session);
    await this.saveSessions();

    user.lastLogin = now.toISOString();
    await this.saveUsers();

    return {
      userId: user.id,
      username: user.username,
      role: user.role,
      token,
    };
  }

  async validateToken(token: string): Promise<UserSession | null> {
    const session = this.sessions.get(token);
    if (!session) return null;

    if (new Date(session.expiresAt).getTime() < Date.now()) {
      this.sessions.delete(token);
      await this.saveSessions();
      return null;
    }

    const user = this.users.find(u => u.id === session.userId);
    if (!user) return null;

    return {
      userId: user.id,
      username: user.username,
      role: user.role,
      token,
    };
  }

  async logout(token: string) {
    this.sessions.delete(token);
    await this.saveSessions();
  }

  async createUser(username: string, password: string, role: UserRole): Promise<User | null> {
    if (this.users.some(u => u.username === username)) {
      return null;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user: User = {
      id: uuidv4(),
      username,
      passwordHash,
      role,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };

    this.users.push(user);
    await this.saveUsers();
    return user;
  }

  async register(username: string, password: string): Promise<User | null> {
    // 玩家自注册，只能注册为 player 角色
    return this.createUser(username, password, 'player');
  }

  async listUsers(): Promise<Omit<User, 'passwordHash'>[]> {
    return this.users.map(({ passwordHash, ...user }) => user);
  }

  async deleteUser(userId: string): Promise<boolean> {
    const index = this.users.findIndex(u => u.id === userId);
    if (index === -1) return false;

    this.users.splice(index, 1);
    await this.saveUsers();
    return true;
  }
}
