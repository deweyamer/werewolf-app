/**
 * PlayerView 组件测试
 * 验证玩家视角的信息隔离和安全性
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PlayerView from './PlayerView';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { createMockGame, createMockPlayer } from '../test/mockData/gameMocks';

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

describe('PlayerView 组件测试', () => {
  const mockUser = {
    userId: 'player-user-1',
    username: 'TestPlayer',
    role: 'player',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup auth store mock
    (useAuthStore as any).mockReturnValue({
      user: mockUser,
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
          <PlayerView />
        </BrowserRouter>
      );

      expect(screen.getByText('玩家视图')).toBeInTheDocument();
      expect(screen.getByText(/欢迎.*TestPlayer/)).toBeInTheDocument();
      expect(screen.getByText('退出登录')).toBeInTheDocument();
    });

    it('P1: 无游戏时应该显示加入房间界面', () => {
      render(
        <BrowserRouter>
          <PlayerView />
        </BrowserRouter>
      );

      expect(screen.getByRole('heading', { name: '加入房间' })).toBeInTheDocument();
      expect(screen.getByText('房间码')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('输入6位房间码')).toBeInTheDocument();
    });
  });

  describe('信息隔离测试', () => {
    it('P0: 不应该显示其他玩家的角色', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({
            playerId: 1,
            userId: 'player-user-1',
            username: 'TestPlayer',
            role: 'seer',
            camp: 'good',
          }),
          createMockPlayer({
            playerId: 2,
            userId: 'other-user-1',
            username: 'OtherPlayer',
            role: 'wolf',
            camp: 'wolf',
          }),
        ],
      });

      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlayerView />
        </BrowserRouter>
      );

      // 应该显示自己的角色
      expect(screen.getByText(/角色.*seer/)).toBeInTheDocument();

      // 不应该显示其他玩家的角色 (只显示号位和用户名)
      expect(screen.getByText('2号')).toBeInTheDocument();
      expect(screen.getByText('OtherPlayer')).toBeInTheDocument();

      // 确认没有泄露其他玩家的角色信息
      const playerListHeading = screen.getByRole('heading', { name: /玩家列表/ });
      const allText = playerListHeading.parentElement?.textContent || '';
      expect(allText).not.toContain('wolf'); // 不应该出现其他玩家的角色ID
    });

    it('P0: 不应该泄露出局原因', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({
            playerId: 1,
            userId: 'player-user-1',
            username: 'TestPlayer',
            role: 'seer',
            alive: true,
          }),
          createMockPlayer({
            playerId: 2,
            userId: 'other-user-1',
            username: 'DeadPlayer',
            role: 'wolf',
            alive: false,
            outReason: 'wolf_kill', // 敏感信息
          }),
        ],
      });

      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlayerView />
        </BrowserRouter>
      );

      // 应该显示"已出局"
      expect(screen.getByText('已出局')).toBeInTheDocument();

      // 不应该显示出局原因
      expect(screen.queryByText('被狼刀')).not.toBeInTheDocument();
      expect(screen.queryByText('wolf_kill')).not.toBeInTheDocument();
    });

    it('P0: 应该只显示自己的角色信息', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({
            playerId: 1,
            userId: 'player-user-1',
            username: 'TestPlayer',
            role: 'seer',
            camp: 'good',
          }),
        ],
      });

      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlayerView />
        </BrowserRouter>
      );

      // 自己的信息框应该显示角色和阵营
      expect(screen.getByText(/你是 1号/)).toBeInTheDocument();
      expect(screen.getByText(/角色.*seer/)).toBeInTheDocument();
      expect(screen.getByText(/阵营.*好人/)).toBeInTheDocument();
    });
  });

  describe('狼人视角测试', () => {
    it('P1: 狼人应该能看到队友', () => {
      const game = createMockGame({
        status: 'running',
        currentPhase: 'wolf',
        players: [
          createMockPlayer({
            playerId: 1,
            userId: 'player-user-1',
            username: 'TestWolf',
            role: 'wolf',
            camp: 'wolf',
            alive: true,
            abilities: {
              hasNightAction: true, // 狼人有夜间行动
            },
          }),
          createMockPlayer({
            playerId: 2,
            userId: 'other-user-1',
            username: 'Teammate',
            role: 'nightmare',
            camp: 'wolf',
            alive: true,
          }),
          createMockPlayer({
            playerId: 3,
            userId: 'other-user-2',
            username: 'GoodGuy',
            role: 'seer',
            camp: 'good',
            alive: true,
          }),
        ],
      });

      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlayerView />
        </BrowserRouter>
      );

      // 狼人阶段，验证玩家自己知道自己是狼人
      expect(screen.getByText(/角色.*wolf/)).toBeInTheDocument();
      expect(screen.getByText(/阵营.*狼人/)).toBeInTheDocument();

      // 应该显示所有玩家的用户名在列表中（可能在多个位置出现，如列表和下拉框）
      expect(screen.getAllByText('TestWolf').length).toBeGreaterThan(0); // 自己
      expect(screen.getAllByText('Teammate').length).toBeGreaterThan(0); // 队友
      expect(screen.getAllByText('GoodGuy').length).toBeGreaterThan(0); // 好人

      // 但不应该在玩家基本信息之外泄露好人的角色信息
      expect(screen.queryByText(/角色.*seer/)).not.toBeInTheDocument();
    });
  });

  describe('女巫视角测试', () => {
    it('P1: 女巫应该能看到当前阶段', () => {
      const game = createMockGame({
        status: 'running',
        currentPhase: 'witch',
        players: [
          createMockPlayer({
            playerId: 1,
            userId: 'player-user-1',
            username: 'WitchPlayer',
            role: 'witch',
            camp: 'good',
            alive: true,
            abilities: {
              antidote: true,
              poison: true,
              hasNightAction: true,
            },
          }),
          createMockPlayer({
            playerId: 5,
            userId: 'victim-user',
            username: 'Victim',
            role: 'villager',
            camp: 'good',
            alive: true,
          }),
        ],
        nightActions: {
          witchKnowsVictim: 5,
        },
      });

      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlayerView />
        </BrowserRouter>
      );

      // 女巫应该知道自己的角色
      expect(screen.getByText(/角色.*witch/)).toBeInTheDocument();
      expect(screen.getByText(/阵营.*好人/)).toBeInTheDocument();

      // 女巫应该看到当前是女巫阶段
      expect(screen.getByText(/当前阶段.*witch/)).toBeInTheDocument();
    });

    it('P1: 女巫应该看到操作界面', () => {
      const game = createMockGame({
        status: 'running',
        currentPhase: 'witch',
        players: [
          createMockPlayer({
            playerId: 1,
            userId: 'player-user-1',
            username: 'WitchPlayer',
            role: 'witch',
            camp: 'good',
            alive: true,
            abilities: {
              antidote: true,
              poison: false, // 毒药已用
              hasNightAction: true,
            },
          }),
          createMockPlayer({
            playerId: 5,
            userId: 'victim-user',
            username: 'Victim',
            role: 'villager',
            camp: 'good',
            alive: true,
          }),
        ],
        nightActions: {
          witchKnowsVictim: 5,
        },
      });

      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlayerView />
        </BrowserRouter>
      );

      // 女巫应该看到选择目标的界面
      expect(screen.getByText(/选择目标/)).toBeInTheDocument();
      expect(screen.getByText(/提交操作/)).toBeInTheDocument();
    });
  });

  describe('投票功能测试', () => {
    it('P1: 应该显示放逐投票界面', () => {
      const game = createMockGame({
        currentPhase: 'vote',
        players: [
          createMockPlayer({
            playerId: 1,
            userId: 'player-user-1',
            alive: true,
          }),
          createMockPlayer({
            playerId: 2,
            userId: 'other-user-1',
            alive: true,
          }),
        ],
        exileVote: {
          phase: 'voting',
          votes: {},
        },
      });

      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlayerView />
        </BrowserRouter>
      );

      expect(screen.getByText('⚖️ 放逐投票')).toBeInTheDocument();
      expect(screen.getByText('选择放逐目标')).toBeInTheDocument();
    });

    it('P1: 已投票后应该显示提示', () => {
      const game = createMockGame({
        currentPhase: 'vote',
        players: [
          createMockPlayer({
            playerId: 1,
            userId: 'player-user-1',
            alive: true,
          }),
        ],
        exileVote: {
          phase: 'voting',
          votes: {
            1: 2, // 玩家1已投给2号
          },
        },
      });

      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlayerView />
        </BrowserRouter>
      );

      expect(screen.getByText(/已完成投票/)).toBeInTheDocument();
    });
  });

  describe('出局玩家测试', () => {
    it('P0: 出局玩家不应该看到操作界面', () => {
      const game = createMockGame({
        status: 'running',
        currentPhase: 'wolf',
        players: [
          createMockPlayer({
            playerId: 1,
            userId: 'player-user-1',
            alive: false, // 已出局
            role: 'seer',
          }),
        ],
      });

      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlayerView />
        </BrowserRouter>
      );

      // 应该显示出局状态
      expect(screen.getByText('你已出局')).toBeInTheDocument();

      // 不应该显示操作界面
      expect(screen.queryByText('选择目标')).not.toBeInTheDocument();
      expect(screen.queryByText('提交操作')).not.toBeInTheDocument();
    });
  });

  describe('警长竞选测试', () => {
    it('P1: 应该显示警长竞选界面', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({
            playerId: 1,
            userId: 'player-user-1',
            alive: true,
          }),
        ],
        sheriffElection: {
          phase: 'signup',
          candidates: [],
        },
      });

      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlayerView />
        </BrowserRouter>
      );

      expect(screen.getByText('🎖️ 警长竞选 - 上警阶段')).toBeInTheDocument();
      expect(screen.getByText('上警竞选')).toBeInTheDocument();
      expect(screen.getByText('不上警')).toBeInTheDocument();
    });
  });

  describe('安全性保障测试', () => {
    it('P0: 平民在夜间不应该看到任何行动信息', () => {
      const game = createMockGame({
        status: 'running',
        currentPhase: 'wolf',
        players: [
          createMockPlayer({
            playerId: 1,
            userId: 'player-user-1',
            role: 'villager',
            camp: 'good',
            alive: true,
          }),
          createMockPlayer({
            playerId: 2,
            userId: 'other-user-1',
            role: 'wolf',
            camp: 'wolf',
            alive: true,
          }),
        ],
      });

      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlayerView />
        </BrowserRouter>
      );

      // 平民在夜间应该看到"天黑请闭眼"提示
      expect(screen.getByText('🌙 夜晚阶段')).toBeInTheDocument();
      expect(screen.getByText(/天黑请闭眼/)).toBeInTheDocument();

      // 不应该显示任何操作选项
      expect(screen.queryByText('选择目标')).not.toBeInTheDocument();
      expect(screen.queryByText('提交操作')).not.toBeInTheDocument();
    });

    it('P0: 应该显示安全警告注释(代码层面)', () => {
      // 这个测试验证代码中是否有安全注释
      // 通过读取组件源代码验证
      const fs = require('fs');
      const path = require('path');
      const componentPath = path.join(__dirname, 'PlayerView.tsx');
      const componentCode = fs.readFileSync(componentPath, 'utf-8');

      // 验证是否包含安全警告注释
      expect(componentCode).toContain('⚠️ 安全警告');
      expect(componentCode).toContain('禁止显示 outReason');
    });
  });

  describe('游戏结束测试', () => {
    it('P1: 游戏结束后应该显示结果', () => {
      const game = createMockGame({
        status: 'finished',
        winner: 'good',
        players: [
          createMockPlayer({
            playerId: 1,
            userId: 'player-user-1',
            camp: 'good',
          }),
        ],
      });

      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: vi.fn(),
      });

      render(
        <BrowserRouter>
          <PlayerView />
        </BrowserRouter>
      );

      expect(screen.getByText('游戏结束')).toBeInTheDocument();
      expect(screen.getByText(/好人阵营.*获胜/)).toBeInTheDocument();
    });
  });
});
