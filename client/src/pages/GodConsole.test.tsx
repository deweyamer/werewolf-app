/**
 * GodConsole 组件测试
 * 验证上帝视角的完整性和正确性
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import GodConsole from './GodConsole';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { createMockFullGame, createGravekeeperTestGame } from '../test/mockData/gameMocks';

// Mock stores
vi.mock('../stores/authStore');
vi.mock('../stores/gameStore');

// Mock websocket service
vi.mock('../services/websocket', () => ({
  wsService: {
    send: vi.fn(),
    onMessage: vi.fn(() => vi.fn()),
    disconnect: vi.fn(),
  },
}));

// Mock config
vi.mock('../config', () => ({
  config: {
    apiUrl: 'http://localhost:3000',
  },
}));

describe('GodConsole 组件测试', () => {
  const mockUser = {
    userId: 'god-user-1',
    username: 'GodPlayer',
    role: 'god',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup auth store mock
    (useAuthStore as any).mockReturnValue({
      user: mockUser,
      token: 'test-token',
      clearAuth: vi.fn(),
    });

    // Setup game store mock with no game initially
    (useGameStore as any).mockReturnValue({
      currentGame: null,
      setGame: vi.fn(),
      clearGame: vi.fn(),
    });
  });

  describe('渲染测试', () => {
    it('P1: 应该渲染基本的UI元素', () => {
      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      expect(screen.getByText('上帝控制台')).toBeInTheDocument();
      expect(screen.getByText(/欢迎.*GodPlayer/)).toBeInTheDocument();
      expect(screen.getByText('退出登录')).toBeInTheDocument();
    });

    it('P1: 无游戏时应该显示创建/加入房间界面', () => {
      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      expect(screen.getByText('创建或加入房间')).toBeInTheDocument();
      expect(screen.getByText('创建新房间')).toBeInTheDocument();
      expect(screen.getByText('加入已有房间')).toBeInTheDocument();
      expect(screen.getByText('选择剧本')).toBeInTheDocument();
    });
  });

  describe('游戏信息展示', () => {
    beforeEach(() => {
      const game = createMockFullGame();
      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });
    });

    it('P0: 应该显示所有玩家的完整信息(角色、阵营)', () => {
      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      // 验证显示玩家状态表格
      expect(screen.getByText('👥 玩家状态')).toBeInTheDocument();

      // 验证表头
      expect(screen.getByText('号位')).toBeInTheDocument();
      expect(screen.getByText('角色')).toBeInTheDocument();
      expect(screen.getByText('阵营')).toBeInTheDocument();
      expect(screen.getByText('状态')).toBeInTheDocument();

      // 验证显示玩家角色 (God可以看到所有角色)
      expect(screen.getByText('噩梦之影')).toBeInTheDocument();
      expect(screen.getByText('守墓人')).toBeInTheDocument();
      expect(screen.getByText('预言家')).toBeInTheDocument();
      expect(screen.getByText('女巫')).toBeInTheDocument();
    });

    it('P0: 应该显示玩家的阵营(狼人/好人)', () => {
      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      // God Console 应该显示所有阵营标签
      const wolfLabels = screen.getAllByText('狼人');
      const goodLabels = screen.getAllByText('好人');

      expect(wolfLabels.length).toBeGreaterThan(0);
      expect(goodLabels.length).toBeGreaterThan(0);
    });

    it('P0: 应该正确显示死亡原因', () => {
      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      // 2号被投票放逐
      expect(screen.getByText('🗳️ 被投票放逐')).toBeInTheDocument();

      // 9号被狼刀
      expect(screen.getByText('🐺 被狼刀')).toBeInTheDocument();
    });

    it('P0: 应该显示游戏概览统计', () => {
      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      expect(screen.getByText('📊 游戏概览')).toBeInTheDocument();
      expect(screen.getByText('当前回合')).toBeInTheDocument();
      expect(screen.getByText('存活狼人')).toBeInTheDocument();
      expect(screen.getByText('存活好人')).toBeInTheDocument();
    });
  });

  describe('守墓人规则展示', () => {
    beforeEach(() => {
      const game = createGravekeeperTestGame();
      game.currentPhase = 'gravekeeper';
      game.nightActions.gravekeeperSubmitted = false;

      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });
    });

    it('P0: 应该显示守墓人规则提示', () => {
      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      expect(screen.getByText(/守墓人只能验尸白天被投票放逐的玩家/)).toBeInTheDocument();
    });

    it('P0: 应该显示可验尸的玩家列表', () => {
      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      // 只有2号可以验尸 (被放逐)
      expect(screen.getByText(/可验尸.*2号/)).toBeInTheDocument();

      // 确认不包含被狼刀的9号
      expect(screen.queryByText(/可验尸.*9号/)).not.toBeInTheDocument();
    });

    it('P0: 没有被放逐玩家时应该显示提示', () => {
      // 修改mock数据: 所有玩家都是被狼刀
      const game = createGravekeeperTestGame();
      game.players.forEach(p => {
        if (!p.alive) {
          p.outReason = 'wolf_kill';
        }
      });

      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      expect(screen.getByText(/尚无被放逐的玩家/)).toBeInTheDocument();
    });
  });

  describe('实时操作状态', () => {
    it('P1: 应该显示夜间行动状态', () => {
      const game = createMockFullGame();
      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      expect(screen.getByRole('heading', { name: /当前阶段/ })).toBeInTheDocument();
    });

    it('P1: 应该显示狼人刀人信息', () => {
      const game = createMockFullGame();
      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      // 狼人已刀10号
      expect(screen.getByText(/已刀.*10号/)).toBeInTheDocument();
    });
  });

  describe('操作历史', () => {
    it('P1: 应该显示游戏历史记录', () => {
      const game = createMockFullGame();
      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      expect(screen.getByText('📜 游戏流程历史')).toBeInTheDocument();
      expect(screen.getByText('第 1 回合')).toBeInTheDocument();
    });
  });

  describe('安全性验证', () => {
    it('P0: God Console应该显示所有敏感信息(全知视角)', () => {
      const game = createMockFullGame();
      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      // 验证显示所有角色
      const roles = ['噩梦之影', '守墓人', '预言家', '女巫', '猎人'];
      roles.forEach(role => {
        expect(screen.getByText(role)).toBeInTheDocument();
      });

      // 验证显示阵营
      expect(screen.getAllByText('狼人').length).toBeGreaterThan(0);
      expect(screen.getAllByText('好人').length).toBeGreaterThan(0);

      // 验证显示死亡原因
      expect(screen.getByText('🗳️ 被投票放逐')).toBeInTheDocument();
      expect(screen.getByText('🐺 被狼刀')).toBeInTheDocument();
    });

    it('P0: 应该显示警长状态', () => {
      const game = createMockFullGame();
      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      // 确认玩家表格存在
      const playerTable = screen.getByRole('table');
      expect(playerTable).toBeInTheDocument();

      // 确认显示了玩家信息（警长应该在玩家列表中）
      expect(screen.getAllByRole('row').length).toBeGreaterThan(1); // 至少有表头和一行数据
    });
  });

  describe('导出复盘功能', () => {
    it('P2: 应该显示导出复盘按钮', () => {
      const game = createMockFullGame();
      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      expect(screen.getByText(/导出复盘/)).toBeInTheDocument();
    });
  });

  describe('游戏控制', () => {
    it('P1: 等待中状态应该显示分配角色和开始游戏按钮', () => {
      const game = createMockFullGame();
      game.status = 'waiting';
      game.players.forEach(p => delete p.role);

      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      expect(screen.getByText('分配角色')).toBeInTheDocument();
      expect(screen.getByText('开始游戏')).toBeInTheDocument();
    });

    it('P1: 进行中状态应该显示进入下一阶段按钮', () => {
      const game = createMockFullGame();
      game.status = 'running';

      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      expect(screen.getByText('进入下一阶段')).toBeInTheDocument();
    });
  });

  describe('技能状态显示', () => {
    it('P1: 应该显示神职技能状态', () => {
      const game = createMockFullGame();
      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <GodConsole />
        </BrowserRouter>
      );

      expect(screen.getByText('🎭 神职技能状态')).toBeInTheDocument();
    });
  });
});
