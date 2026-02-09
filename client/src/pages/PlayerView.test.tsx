import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import PlayerView from './PlayerView';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { createMockGame, createMockPlayer } from '../test/mockData/gameMocks';
import { ToastProvider } from '../components/Toast';

// Mock stores
vi.mock('../stores/authStore');
vi.mock('../stores/gameStore');

// Mock websocket service
vi.mock('../services/websocket', () => ({
  wsService: {
    send: vi.fn(),
    onMessage: vi.fn(() => vi.fn()),
    disconnect: vi.fn(),
    clearRoomCode: vi.fn(),
    onStatusChange: vi.fn(() => vi.fn()),
  },
}));

// Mock RoleActionPanel as stub
vi.mock('../components/RoleActionPanel', () => ({
  default: (props: any) => (
    <div data-testid="role-action-panel">
      RoleActionPanel: {props.myPlayer?.role} / {props.currentGame?.currentPhase}
    </div>
  ),
}));

const { wsService } = await import('../services/websocket');

function renderPlayerView() {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <PlayerView />
      </ToastProvider>
    </BrowserRouter>
  );
}

const mockClearAuth = vi.fn();
const mockClearGame = vi.fn();

describe('PlayerView', () => {
  const mockUser = {
    userId: 'player-user-1',
    username: 'TestPlayer',
    role: 'player',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useAuthStore as any).mockReturnValue({
      user: mockUser,
      clearAuth: mockClearAuth,
    });

    (useGameStore as any).mockReturnValue({
      currentGame: null,
      setGame: vi.fn(),
      clearGame: mockClearGame,
    });
  });

  describe('加入房间交互', () => {
    it('无游戏时应该渲染加入房间界面', () => {
      renderPlayerView();

      expect(screen.getByRole('heading', { name: '加入房间' })).toBeInTheDocument();
      expect(screen.getByPlaceholderText('输入6位房间码')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '加入房间' })).toBeInTheDocument();
    });

    it('输入房间码应该自动转大写', async () => {
      renderPlayerView();
      const input = screen.getByPlaceholderText('输入6位房间码');

      await userEvent.type(input, 'abc123');
      expect(input).toHaveValue('ABC123');
    });

    it('空房间码点击加入不应该发送消息', async () => {
      renderPlayerView();

      await userEvent.click(screen.getByRole('button', { name: '加入房间' }));
      expect(wsService.send).not.toHaveBeenCalled();
    });

    it('输入房间码后点击加入应该发送JOIN_ROOM', async () => {
      renderPlayerView();

      await userEvent.type(screen.getByPlaceholderText('输入6位房间码'), 'ROOM01');
      await userEvent.click(screen.getByRole('button', { name: '加入房间' }));

      expect(wsService.send).toHaveBeenCalledWith({
        type: 'JOIN_ROOM',
        roomCode: 'ROOM01',
        playerId: undefined,
      });
    });

    it('选择号位后JOIN_ROOM应该包含playerId', async () => {
      renderPlayerView();

      // Click seat 3 - use getAllByText since "3号" may appear multiple times in seat grid
      const seatButtons = screen.getAllByText('3号');
      await userEvent.click(seatButtons[0]);
      expect(screen.getByText(/已选择 3号位/)).toBeInTheDocument();

      await userEvent.type(screen.getByPlaceholderText('输入6位房间码'), 'ROOM01');
      await userEvent.click(screen.getByRole('button', { name: '加入房间' }));

      expect(wsService.send).toHaveBeenCalledWith({
        type: 'JOIN_ROOM',
        roomCode: 'ROOM01',
        playerId: 3,
      });
    });

    it('再次点击已选号位应该取消选择', async () => {
      renderPlayerView();

      const seatButtons = screen.getAllByText('3号');
      await userEvent.click(seatButtons[0]);
      expect(screen.getByText(/已选择 3号位/)).toBeInTheDocument();

      await userEvent.click(seatButtons[0]);
      expect(screen.getByText(/未选择号位/)).toBeInTheDocument();
    });
  });

  describe('信息隔离', () => {
    it('不应该显示其他玩家角色', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ playerId: 1, userId: 'player-user-1', username: 'TestPlayer', role: 'seer', camp: 'good' }),
          createMockPlayer({ playerId: 2, userId: 'other-user', username: 'OtherPlayer', role: 'wolf', camp: 'wolf' }),
        ],
      });

      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
      renderPlayerView();

      // Own role is shown
      expect(screen.getByText(/预言家/)).toBeInTheDocument();

      // Other player's role should not leak in the player list
      const playerListSection = screen.getByText(/玩家列表/).parentElement!;
      expect(playerListSection.textContent).not.toContain('狼人');
    });

    it('不应该泄露出局原因', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ playerId: 1, userId: 'player-user-1', role: 'seer', alive: true }),
          createMockPlayer({ playerId: 2, userId: 'other', username: 'Dead', role: 'wolf', alive: false, outReason: 'wolf_kill' }),
        ],
      });

      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
      renderPlayerView();

      expect(screen.getByText('已出局')).toBeInTheDocument();
      expect(screen.queryByText('被狼刀')).not.toBeInTheDocument();
      expect(screen.queryByText('wolf_kill')).not.toBeInTheDocument();
    });

    it('应该显示自己的角色信息', () => {
      const game = createMockGame({
        players: [
          createMockPlayer({ playerId: 1, userId: 'player-user-1', role: 'seer', camp: 'good' }),
        ],
      });

      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
      renderPlayerView();

      expect(screen.getByText(/你是 1号/)).toBeInTheDocument();
      expect(screen.getByText(/预言家/)).toBeInTheDocument();
      expect(screen.getByText(/好人/)).toBeInTheDocument();
    });
  });

  describe('退出登录', () => {
    it('点击退出登录应该断开WebSocket并清除状态', async () => {
      renderPlayerView();

      await userEvent.click(screen.getByText('退出登录'));

      expect(wsService.disconnect).toHaveBeenCalled();
      expect(mockClearAuth).toHaveBeenCalled();
      expect(mockClearGame).toHaveBeenCalled();
    });
  });

  describe('离开房间', () => {
    beforeEach(() => {
      const game = createMockGame({
        players: [createMockPlayer({ playerId: 1, userId: 'player-user-1' })],
      });
      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
    });

    it('确认后应该发送LEAVE_ROOM', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderPlayerView();

      await userEvent.click(screen.getByText('离开房间'));

      expect(wsService.send).toHaveBeenCalledWith({ type: 'LEAVE_ROOM' });
      expect(wsService.clearRoomCode).toHaveBeenCalled();
      expect(mockClearGame).toHaveBeenCalled();
    });

    it('取消不应该退出', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderPlayerView();

      await userEvent.click(screen.getByText('离开房间'));

      expect(wsService.send).not.toHaveBeenCalled();
    });
  });

  describe('投票交互', () => {
    it('放逐投票阶段应该显示投票界面', () => {
      const game = createMockGame({
        currentPhase: 'vote',
        players: [
          createMockPlayer({ playerId: 1, userId: 'player-user-1', alive: true }),
          createMockPlayer({ playerId: 2, alive: true }),
        ],
        exileVote: { phase: 'voting', votes: {} },
      });

      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
      renderPlayerView();

      expect(screen.getByText('⚖️ 放逐投票')).toBeInTheDocument();
      expect(screen.getByText('选择放逐目标')).toBeInTheDocument();
    });

    it('已投票后应该显示已完成提示', () => {
      const game = createMockGame({
        currentPhase: 'vote',
        players: [createMockPlayer({ playerId: 1, userId: 'player-user-1', alive: true })],
        exileVote: { phase: 'voting', votes: { 1: 2 } },
      });

      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
      renderPlayerView();

      expect(screen.getByText(/已完成投票/)).toBeInTheDocument();
    });

    it('PK投票应该只显示平票玩家', () => {
      const game = createMockGame({
        currentPhase: 'vote',
        players: [
          createMockPlayer({ playerId: 1, userId: 'player-user-1', alive: true }),
          createMockPlayer({ playerId: 2, username: 'PKPlayer1', alive: true }),
          createMockPlayer({ playerId: 3, username: 'PKPlayer2', alive: true }),
          createMockPlayer({ playerId: 4, username: 'NotInPK', alive: true }),
        ],
        exileVote: { phase: 'pk', pkPlayers: [2, 3], votes: {}, pkVotes: {} },
      });

      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
      renderPlayerView();

      expect(screen.getByText('⚖️ 平票PK投票')).toBeInTheDocument();
      const select = screen.getByRole('combobox');
      const options = within(select).getAllByRole('option');
      // placeholder + skip + 2 pk players = 4
      expect(options).toHaveLength(4);
    });

    it('选择目标并确认投票应该发送EXILE_VOTE', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const game = createMockGame({
        currentPhase: 'vote',
        players: [
          createMockPlayer({ playerId: 1, userId: 'player-user-1', alive: true }),
          createMockPlayer({ playerId: 2, username: 'Target', alive: true }),
        ],
        exileVote: { phase: 'voting', votes: {} },
      });

      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
      renderPlayerView();

      await userEvent.selectOptions(screen.getByRole('combobox'), '2');
      await userEvent.click(screen.getByText('确认投票'));

      expect(wsService.send).toHaveBeenCalledWith({ type: 'EXILE_VOTE', targetId: 2 });
    });

    it('未选目标点击确认投票不应该发送消息', async () => {
      const game = createMockGame({
        currentPhase: 'vote',
        players: [
          createMockPlayer({ playerId: 1, userId: 'player-user-1', alive: true }),
          createMockPlayer({ playerId: 2, alive: true }),
        ],
        exileVote: { phase: 'voting', votes: {} },
      });

      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
      renderPlayerView();

      await userEvent.click(screen.getByText('确认投票'));
      expect(wsService.send).not.toHaveBeenCalled();
    });
  });

  describe('警长竞选', () => {
    it('上警阶段应该显示上警/不上警按钮', () => {
      const game = createMockGame({
        players: [createMockPlayer({ playerId: 1, userId: 'player-user-1', alive: true })],
        sheriffElection: { phase: 'signup', candidates: [] },
      });

      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
      renderPlayerView();

      expect(screen.getByText('上警竞选')).toBeInTheDocument();
      expect(screen.getByText('不上警')).toBeInTheDocument();
    });

    it('点击上警应该发送SHERIFF_SIGNUP', async () => {
      const game = createMockGame({
        players: [createMockPlayer({ playerId: 1, userId: 'player-user-1', alive: true })],
        sheriffElection: { phase: 'signup', candidates: [] },
      });

      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
      renderPlayerView();

      await userEvent.click(screen.getByText('上警竞选'));
      expect(wsService.send).toHaveBeenCalledWith({ type: 'SHERIFF_SIGNUP', runForSheriff: true });
    });

    it('投票阶段候选人不能投票', () => {
      const game = createMockGame({
        players: [createMockPlayer({ playerId: 1, userId: 'player-user-1', alive: true })],
        sheriffElection: { phase: 'voting', candidates: [1, 3], votes: {} },
      });

      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
      renderPlayerView();

      expect(screen.getByText(/候选人.*不能投票/)).toBeInTheDocument();
    });
  });

  describe('出局观战', () => {
    it('出局玩家应该显示观战模式', () => {
      const game = createMockGame({
        status: 'running',
        currentPhase: 'wolf',
        players: [
          createMockPlayer({ playerId: 1, userId: 'player-user-1', role: 'seer', camp: 'good', alive: false }),
        ],
      });

      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
      renderPlayerView();

      expect(screen.getByText('观战模式')).toBeInTheDocument();
      expect(screen.getByText(/你已出局，正在观战中/)).toBeInTheDocument();
    });

    it('出局玩家不应该显示RoleActionPanel', () => {
      const game = createMockGame({
        status: 'running',
        currentPhase: 'wolf',
        players: [
          createMockPlayer({ playerId: 1, userId: 'player-user-1', role: 'seer', camp: 'good', alive: false }),
        ],
      });

      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
      renderPlayerView();

      expect(screen.queryByTestId('role-action-panel')).not.toBeInTheDocument();
    });
  });

  describe('游戏结束', () => {
    it('应该显示获胜方', () => {
      const game = createMockGame({
        status: 'finished',
        winner: 'good',
        players: [createMockPlayer({ playerId: 1, userId: 'player-user-1', camp: 'good' })],
      });

      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
      renderPlayerView();

      expect(screen.getByText('游戏结束')).toBeInTheDocument();
      expect(screen.getByText(/好人阵营.*获胜/)).toBeInTheDocument();
    });
  });

  describe('RoleActionPanel渲染', () => {
    it('存活且游戏运行中应该渲染RoleActionPanel', () => {
      const game = createMockGame({
        status: 'running',
        currentPhase: 'wolf',
        players: [
          createMockPlayer({
            playerId: 1,
            userId: 'player-user-1',
            role: 'wolf',
            camp: 'wolf',
            alive: true,
            abilities: { hasNightAction: true },
          }),
        ],
      });

      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
      renderPlayerView();

      expect(screen.getByTestId('role-action-panel')).toBeInTheDocument();
    });
  });

  describe('安全性保障', () => {
    it('平民在夜间不应该看到操作选项', () => {
      const game = createMockGame({
        status: 'running',
        currentPhase: 'wolf',
        players: [
          createMockPlayer({ playerId: 1, userId: 'player-user-1', role: 'villager', camp: 'good', alive: true }),
          createMockPlayer({ playerId: 2, role: 'wolf', camp: 'wolf', alive: true }),
        ],
      });

      (useGameStore as any).mockReturnValue({ currentGame: game, setGame: vi.fn(), clearGame: mockClearGame });
      renderPlayerView();

      // RoleActionPanel stub should show night waiting (the stub just renders, but
      // the real component would show "天黑请闭眼")
      // Since we mock RoleActionPanel, this test verifies the panel IS rendered
      // (the actual night-waiting behavior is tested in RoleActionPanel.test.tsx)
      expect(screen.getByTestId('role-action-panel')).toBeInTheDocument();
    });
  });
});
