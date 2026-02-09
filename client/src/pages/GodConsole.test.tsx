import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import GodConsole from './GodConsole';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { createMockFullGame, createMockGame, createMockPlayer } from '../test/mockData/gameMocks';
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
    onStatusChange: vi.fn(() => vi.fn()),
  },
}));

// Mock config
vi.mock('../config', () => ({
  config: { apiUrl: 'http://localhost:3000' },
}));

// Mock child components as stubs
vi.mock('../components/god/RoomLobby', () => ({
  default: (props: any) => (
    <div data-testid="room-lobby">
      <button onClick={props.onCreateRoom}>创建房间</button>
      <button onClick={props.onJoinRoom}>加入房间</button>
    </div>
  ),
}));

vi.mock('../components/god/MiniOverviewSidebar', () => ({
  default: () => <div data-testid="mini-overview-sidebar" />,
}));

vi.mock('../components/god/PlayerTableDrawer', () => ({
  default: () => <div data-testid="player-table-drawer" />,
}));

vi.mock('../components/replay/GameReplayViewer', () => ({
  default: () => <div data-testid="game-replay-viewer" />,
}));

vi.mock('../components/god/RoleAssignmentModal', () => ({
  default: () => <div data-testid="role-assignment-modal" />,
}));

vi.mock('../components/god/SheriffElectionPanel', () => ({
  default: () => <div data-testid="sheriff-election-panel" />,
}));

vi.mock('../components/god/ExileVotePanel', () => ({
  default: () => <div data-testid="exile-vote-panel" />,
}));

vi.mock('../components/god/NightActionsPanel', () => ({
  default: () => <div data-testid="night-actions-panel" />,
}));

vi.mock('../components/god/GameHistoryPanel', () => ({
  default: () => <div data-testid="game-history-panel" />,
}));

vi.mock('../components/RoleSelector', () => ({
  default: () => <div data-testid="role-selector" />,
}));

vi.mock('../hooks/useReplayData', () => ({
  useReplayData: () => ({ generateReplayData: vi.fn() }),
}));

const { wsService } = await import('../services/websocket');

// Mock fetch for scripts API
global.fetch = vi.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ success: true, data: { scripts: [] } }),
  })
) as any;

function renderGodConsole() {
  return render(
    <BrowserRouter>
      <ToastProvider>
        <GodConsole />
      </ToastProvider>
    </BrowserRouter>
  );
}

const mockClearAuth = vi.fn();
const mockClearGame = vi.fn();

describe('GodConsole', () => {
  const mockUser = {
    userId: 'god-user-1',
    username: 'GodPlayer',
    role: 'god',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (useAuthStore as any).mockReturnValue({
      user: mockUser,
      token: 'test-token',
      clearAuth: mockClearAuth,
    });

    (useGameStore as any).mockReturnValue({
      currentGame: null,
      setGame: vi.fn(),
      clearGame: mockClearGame,
    });
  });

  describe('渲染', () => {
    it('应该渲染标题和用户名', () => {
      renderGodConsole();

      expect(screen.getByText('上帝控制台')).toBeInTheDocument();
      expect(screen.getByText(/欢迎.*GodPlayer/)).toBeInTheDocument();
    });

    it('无游戏时应该渲染RoomLobby', () => {
      renderGodConsole();

      expect(screen.getByTestId('room-lobby')).toBeInTheDocument();
    });
  });

  describe('退出登录', () => {
    it('点击退出登录应该调用disconnect + clearAuth + clearGame', async () => {
      renderGodConsole();

      await userEvent.click(screen.getByText('退出登录'));

      expect(wsService.disconnect).toHaveBeenCalled();
      expect(mockClearAuth).toHaveBeenCalled();
      expect(mockClearGame).toHaveBeenCalled();
    });
  });

  describe('游戏等待阶段', () => {
    beforeEach(() => {
      const game = createMockFullGame();
      game.status = 'waiting';
      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: mockClearGame,
      });
    });

    it('应该显示分配角色和开始游戏按钮', () => {
      renderGodConsole();

      expect(screen.getByText('分配角色')).toBeInTheDocument();
      expect(screen.getByText('开始游戏')).toBeInTheDocument();
    });

    it('确认开始游戏应该发送GOD_START_GAME', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderGodConsole();

      await userEvent.click(screen.getByText('开始游戏'));

      expect(wsService.send).toHaveBeenCalledWith({ type: 'GOD_START_GAME' });
    });

    it('取消开始游戏不应该发送消息', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderGodConsole();

      await userEvent.click(screen.getByText('开始游戏'));

      expect(wsService.send).not.toHaveBeenCalled();
    });

    it('应该显示玩家状态表格', () => {
      renderGodConsole();

      expect(screen.getByText('玩家状态')).toBeInTheDocument();
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('全知视角应该显示所有角色', () => {
      renderGodConsole();

      expect(screen.getByText('噩梦之影')).toBeInTheDocument();
      expect(screen.getByText('预言家')).toBeInTheDocument();
      expect(screen.getByText('女巫')).toBeInTheDocument();
    });

    it('应该显示死亡原因', () => {
      renderGodConsole();

      expect(screen.getByText('🗳️ 被投票放逐')).toBeInTheDocument();
      expect(screen.getByText('🐺 被狼刀')).toBeInTheDocument();
    });
  });

  describe('游戏进行阶段', () => {
    beforeEach(() => {
      const game = createMockFullGame();
      game.status = 'running';
      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: mockClearGame,
      });
    });

    it('应该显示进入下一阶段按钮', () => {
      renderGodConsole();

      expect(screen.getByText('进入下一阶段')).toBeInTheDocument();
    });

    it('点击进入下一阶段应该发送GOD_ADVANCE_PHASE', async () => {
      renderGodConsole();

      await userEvent.click(screen.getByText('进入下一阶段'));

      expect(wsService.send).toHaveBeenCalledWith({ type: 'GOD_ADVANCE_PHASE' });
    });

    it('确认强制结束应该发送GOD_FORCE_END_GAME', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderGodConsole();

      await userEvent.click(screen.getByText('强制结束'));

      expect(wsService.send).toHaveBeenCalledWith({ type: 'GOD_FORCE_END_GAME' });
    });

    it('取消强制结束不应该发送消息', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderGodConsole();

      await userEvent.click(screen.getByText('强制结束'));

      expect(wsService.send).not.toHaveBeenCalled();
    });

    it('应该渲染子组件: NightActionsPanel, MiniOverviewSidebar', () => {
      renderGodConsole();

      expect(screen.getByTestId('night-actions-panel')).toBeInTheDocument();
      expect(screen.getByTestId('mini-overview-sidebar')).toBeInTheDocument();
    });
  });

  describe('导出复盘', () => {
    it('应该显示导出JSON按钮', () => {
      const game = createMockFullGame();
      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: mockClearGame,
      });
      renderGodConsole();

      expect(screen.getByText(/导出JSON/)).toBeInTheDocument();
    });

    it('点击导出JSON应该创建下载', async () => {
      const game = createMockFullGame();
      (useGameStore as any).mockReturnValue({
        currentGame: game,
        setGame: vi.fn(),
        clearGame: mockClearGame,
      });

      const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
      const mockRevokeObjectURL = vi.fn();
      global.URL.createObjectURL = mockCreateObjectURL;
      global.URL.revokeObjectURL = mockRevokeObjectURL;

      renderGodConsole();

      await userEvent.click(screen.getByText(/导出JSON/));

      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalled();
    });
  });
});
