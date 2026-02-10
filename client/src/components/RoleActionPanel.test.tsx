import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RoleActionPanel from './RoleActionPanel';
import { createMockGame, createMockPlayer } from '../test/mockData/gameMocks';
import { Game, GamePlayer } from '../../../shared/src/types';

// Mock wsService for skip actions
vi.mock('../services/websocket', () => ({
  wsService: {
    send: vi.fn(),
  },
}));

const { wsService } = await import('../services/websocket');

function defaultProps(overrides?: Partial<{
  myPlayer: GamePlayer;
  currentGame: Game;
  selectedTarget: number;
  setSelectedTarget: ReturnType<typeof vi.fn>;
  witchAction: 'none' | 'antidote' | 'poison';
  setWitchAction: ReturnType<typeof vi.fn>;
  showPoisonModal: boolean;
  setShowPoisonModal: ReturnType<typeof vi.fn>;
  poisonTarget: number;
  setPoisonTarget: ReturnType<typeof vi.fn>;
  onSubmitAction: ReturnType<typeof vi.fn>;
  onWitchSubmit: ReturnType<typeof vi.fn>;
  isSubmitting: boolean;
}>) {
  const players = [
    createMockPlayer({ playerId: 1, userId: 'me', username: 'Me', role: 'villager', camp: 'good', abilities: {} }),
    createMockPlayer({ playerId: 2, username: 'P2', role: 'wolf', camp: 'wolf' }),
    createMockPlayer({ playerId: 3, username: 'P3', role: 'villager', camp: 'good' }),
    createMockPlayer({ playerId: 4, username: 'P4', role: 'villager', camp: 'good', alive: false, outReason: 'wolf_kill' }),
  ];

  return {
    myPlayer: overrides?.myPlayer ?? players[0],
    currentGame: overrides?.currentGame ?? createMockGame({ players, currentPhase: 'wolf' }),
    selectedTarget: overrides?.selectedTarget ?? 0,
    setSelectedTarget: overrides?.setSelectedTarget ?? vi.fn(),
    witchAction: overrides?.witchAction ?? ('none' as const),
    setWitchAction: overrides?.setWitchAction ?? vi.fn(),
    showPoisonModal: overrides?.showPoisonModal ?? false,
    setShowPoisonModal: overrides?.setShowPoisonModal ?? vi.fn(),
    poisonTarget: overrides?.poisonTarget ?? 0,
    setPoisonTarget: overrides?.setPoisonTarget ?? vi.fn(),
    onSubmitAction: overrides?.onSubmitAction ?? vi.fn(),
    onWitchSubmit: overrides?.onWitchSubmit ?? vi.fn(),
    isSubmitting: overrides?.isSubmitting ?? false,
  };
}

describe('RoleActionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('平民/无夜间行动', () => {
    it('夜间应该显示"天黑请闭眼"', () => {
      const props = defaultProps({
        myPlayer: createMockPlayer({
          playerId: 1, role: 'villager', camp: 'good', abilities: {},
        }),
      });
      render(<RoleActionPanel {...props} />);
      expect(screen.getByText(/天黑请闭眼/)).toBeInTheDocument();
    });

    it('无hasNightAction的角色在夜间应该显示等待', () => {
      const props = defaultProps({
        myPlayer: createMockPlayer({
          playerId: 1, role: 'seer', camp: 'good', abilities: {},
        }),
        currentGame: createMockGame({
          currentPhase: 'seer',
          players: [createMockPlayer({ playerId: 1, role: 'seer', camp: 'good', abilities: {} })],
        }),
      });
      render(<RoleActionPanel {...props} />);
      expect(screen.getByText(/天黑请闭眼/)).toBeInTheDocument();
    });
  });

  describe('噩梦之影 - 恐惧阶段', () => {
    function nightmareProps(overrides?: Record<string, any>) {
      const players = [
        createMockPlayer({ playerId: 1, userId: 'me', username: 'Nightmare', role: 'nightmare', camp: 'wolf', abilities: { hasNightAction: true } }),
        createMockPlayer({ playerId: 2, username: 'P2', role: 'seer', camp: 'good' }),
        createMockPlayer({ playerId: 3, username: 'P3', role: 'villager', camp: 'good' }),
      ];
      return defaultProps({
        myPlayer: players[0],
        currentGame: createMockGame({ currentPhase: 'fear', players }),
        ...overrides,
      });
    }

    it('应该渲染恐惧面板', () => {
      render(<RoleActionPanel {...nightmareProps()} />);
      expect(screen.getByText(/恐惧阶段/)).toBeInTheDocument();
      expect(screen.getByText(/噩梦之影/)).toBeInTheDocument();
    });

    it('选择目标后应该启用确认按钮', async () => {
      const setSelectedTarget = vi.fn();
      const props = nightmareProps({ setSelectedTarget });
      render(<RoleActionPanel {...props} />);

      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, '2');
      expect(setSelectedTarget).toHaveBeenCalledWith(2);
    });

    it('放弃恐惧应该调用submitAction skip', async () => {
      const props = nightmareProps();
      render(<RoleActionPanel {...props} />);

      const skipBtn = screen.getByText('放弃恐惧');
      await userEvent.click(skipBtn);

      expect((wsService.send as any)).toHaveBeenCalledWith({
        type: 'PLAYER_SUBMIT_ACTION',
        action: {
          phase: 'fear',
          playerId: 1,
          actionType: 'skip',
          target: 0,
        },
      });
    });
  });

  describe('摄梦人 - 梦游阶段', () => {
    function dreamerProps(overrides?: Record<string, any>) {
      const players = [
        createMockPlayer({ playerId: 1, userId: 'me', username: 'Dreamer', role: 'dreamer', camp: 'good', abilities: { hasNightAction: true } }),
        createMockPlayer({ playerId: 2, username: 'P2', role: 'wolf', camp: 'wolf' }),
        createMockPlayer({ playerId: 3, username: 'P3', role: 'villager', camp: 'good' }),
      ];
      return defaultProps({
        myPlayer: players[0],
        currentGame: createMockGame({ currentPhase: 'dream', players }),
        ...overrides,
      });
    }

    it('应该渲染梦游面板', () => {
      render(<RoleActionPanel {...dreamerProps()} />);
      expect(screen.getByText(/梦游阶段/)).toBeInTheDocument();
    });

    it('有lastDreamTarget时应该显示上晚梦游目标提示', () => {
      const myPlayer = createMockPlayer({
        playerId: 1, userId: 'me', role: 'dreamer', camp: 'good',
        abilities: { hasNightAction: true, lastDreamTarget: 3 },
      });
      render(<RoleActionPanel {...dreamerProps({ myPlayer })} />);
      expect(screen.getByText(/上一晚梦游了 3号/)).toBeInTheDocument();
    });

    it('选择目标并提交', async () => {
      const onSubmitAction = vi.fn();
      const setSelectedTarget = vi.fn();
      const props = dreamerProps({ onSubmitAction, setSelectedTarget });
      render(<RoleActionPanel {...props} />);

      const select = screen.getByRole('combobox');
      await userEvent.selectOptions(select, '2');
      expect(setSelectedTarget).toHaveBeenCalledWith(2);
    });
  });

  describe('守卫 - 守护阶段', () => {
    function guardProps(overrides?: Record<string, any>) {
      const players = [
        createMockPlayer({ playerId: 1, userId: 'me', username: 'Guard', role: 'guard', camp: 'good', abilities: { hasNightAction: true } }),
        createMockPlayer({ playerId: 2, username: 'P2', role: 'wolf', camp: 'wolf' }),
        createMockPlayer({ playerId: 3, username: 'P3', role: 'villager', camp: 'good' }),
      ];
      return defaultProps({
        myPlayer: players[0],
        currentGame: createMockGame({ currentPhase: 'guard', players }),
        ...overrides,
      });
    }

    it('应该渲染守护面板', () => {
      render(<RoleActionPanel {...guardProps()} />);
      expect(screen.getByText(/守护阶段/)).toBeInTheDocument();
    });

    it('目标选择应该包含自己(includeSelf)', () => {
      render(<RoleActionPanel {...guardProps()} />);
      const select = screen.getByRole('combobox');
      const options = within(select).getAllByRole('option');
      // 0=placeholder, 1=Guard(self), 2=P2, 3=P3
      const optionTexts = options.map(o => o.textContent);
      expect(optionTexts.some(t => t?.includes('1号'))).toBe(true);
    });

    it('有lastGuardTarget时应该显示上晚守护提示', () => {
      const myPlayer = createMockPlayer({
        playerId: 1, userId: 'me', role: 'guard', camp: 'good',
        abilities: { hasNightAction: true, lastGuardTarget: 3 },
      });
      render(<RoleActionPanel {...guardProps({ myPlayer })} />);
      expect(screen.getByText(/上一晚守护了 3号/)).toBeInTheDocument();
    });
  });

  describe('预言家 - 查验阶段', () => {
    function seerProps(overrides?: Record<string, any>) {
      const players = [
        createMockPlayer({ playerId: 1, userId: 'me', username: 'Seer', role: 'seer', camp: 'good', abilities: { hasNightAction: true } }),
        createMockPlayer({ playerId: 2, username: 'P2', role: 'wolf', camp: 'wolf' }),
        createMockPlayer({ playerId: 3, username: 'P3', role: 'villager', camp: 'good' }),
      ];
      return defaultProps({
        myPlayer: players[0],
        currentGame: createMockGame({ currentPhase: 'seer', players }),
        ...overrides,
      });
    }

    it('应该渲染查验面板', () => {
      render(<RoleActionPanel {...seerProps()} />);
      expect(screen.getByText(/查验阶段 - 预言家/)).toBeInTheDocument();
    });

    it('选择目标并提交', async () => {
      const setSelectedTarget = vi.fn();
      const onSubmitAction = vi.fn();
      const props = seerProps({ setSelectedTarget, onSubmitAction, selectedTarget: 2 });
      render(<RoleActionPanel {...props} />);

      const submitBtn = screen.getByText('确认查验');
      await userEvent.click(submitBtn);
      expect(onSubmitAction).toHaveBeenCalled();
    });
  });

  describe('石像鬼 - 查验阶段', () => {
    it('应该渲染石像鬼面板', () => {
      const players = [
        createMockPlayer({ playerId: 1, userId: 'me', role: 'gargoyle', camp: 'wolf', abilities: { hasNightAction: true } }),
        createMockPlayer({ playerId: 2, username: 'P2', role: 'seer', camp: 'good' }),
      ];
      const props = defaultProps({
        myPlayer: players[0],
        currentGame: createMockGame({ currentPhase: 'gargoyle', players }),
      });
      render(<RoleActionPanel {...props} />);
      expect(screen.getByText(/查验阶段 - 石像鬼/)).toBeInTheDocument();
    });
  });

  describe('守墓人 - 验尸阶段', () => {
    function gravekeeperProps(overrides?: Record<string, any>) {
      const players = [
        createMockPlayer({ playerId: 1, userId: 'me', username: 'GK', role: 'gravekeeper', camp: 'good', abilities: { hasNightAction: true } }),
        createMockPlayer({ playerId: 2, username: 'P2', role: 'wolf', camp: 'wolf' }),
        createMockPlayer({ playerId: 3, username: 'P3', role: 'villager', camp: 'good', alive: false, outReason: 'exile' }),
        createMockPlayer({ playerId: 4, username: 'P4', role: 'villager', camp: 'good' }),
      ];
      return defaultProps({
        myPlayer: players[0],
        currentGame: createMockGame({ currentPhase: 'gravekeeper', players }),
        ...overrides,
      });
    }

    it('应该渲染验尸面板', () => {
      render(<RoleActionPanel {...gravekeeperProps()} />);
      expect(screen.getByText(/验尸阶段/)).toBeInTheDocument();
    });

    it('只应该包含已出局玩家作为选项', () => {
      render(<RoleActionPanel {...gravekeeperProps()} />);
      const select = screen.getByRole('combobox');
      const options = within(select).getAllByRole('option');
      // placeholder + 1 dead player (P3)
      expect(options).toHaveLength(2);
      expect(options[1].textContent).toContain('3号');
      expect(options[1].textContent).toContain('已出局');
    });

    it('放弃验尸应该发送skip', async () => {
      render(<RoleActionPanel {...gravekeeperProps()} />);

      const skipBtn = screen.getByText('放弃验尸');
      await userEvent.click(skipBtn);

      expect((wsService.send as any)).toHaveBeenCalledWith({
        type: 'PLAYER_SUBMIT_ACTION',
        action: {
          phase: 'gravekeeper',
          playerId: 1,
          actionType: 'skip',
          target: 0,
        },
      });
    });
  });

  describe('狼美人 - 魅惑阶段', () => {
    function wolfBeautyProps(overrides?: Record<string, any>) {
      const players = [
        createMockPlayer({ playerId: 1, userId: 'me', username: 'WB', role: 'wolf_beauty', camp: 'wolf', abilities: { hasNightAction: true } }),
        createMockPlayer({ playerId: 2, username: 'P2', role: 'seer', camp: 'good' }),
        createMockPlayer({ playerId: 3, username: 'P3', role: 'villager', camp: 'good' }),
      ];
      return defaultProps({
        myPlayer: players[0],
        currentGame: createMockGame({ currentPhase: 'wolf_beauty', players }),
        ...overrides,
      });
    }

    it('应该渲染魅惑面板', () => {
      render(<RoleActionPanel {...wolfBeautyProps()} />);
      expect(screen.getByText(/魅惑阶段/)).toBeInTheDocument();
    });

    it('放弃魅惑应该发送skip', async () => {
      render(<RoleActionPanel {...wolfBeautyProps()} />);

      const skipBtn = screen.getByText('放弃魅惑');
      await userEvent.click(skipBtn);

      expect((wsService.send as any)).toHaveBeenCalledWith({
        type: 'PLAYER_SUBMIT_ACTION',
        action: {
          phase: 'wolf_beauty',
          playerId: 1,
          actionType: 'skip',
          target: 0,
        },
      });
    });
  });

  describe('女巫 - 用药阶段', () => {
    function witchProps(overrides?: Record<string, any>) {
      const players = [
        createMockPlayer({
          playerId: 1, userId: 'me', username: 'Witch', role: 'witch', camp: 'good',
          abilities: { hasNightAction: true, antidote: true, poison: true },
        }),
        createMockPlayer({ playerId: 2, username: 'P2', role: 'wolf', camp: 'wolf' }),
        createMockPlayer({ playerId: 3, username: 'P3', role: 'villager', camp: 'good' }),
      ];
      return defaultProps({
        myPlayer: players[0],
        currentGame: createMockGame({
          currentPhase: 'witch',
          players,
          nightActions: { witchKnowsVictim: 3 },
        }),
        ...overrides,
      });
    }

    it('应该显示被刀信息', () => {
      render(<RoleActionPanel {...witchProps()} />);
      expect(screen.getByText(/昨晚被刀: 3号/)).toBeInTheDocument();
    });

    it('应该显示解药/毒药状态', () => {
      render(<RoleActionPanel {...witchProps()} />);
      expect(screen.getByText(/解药 ✓ 可用/)).toBeInTheDocument();
      expect(screen.getByText(/毒药 ✓ 可用/)).toBeInTheDocument();
    });

    it('解药已用时应该禁用使用解药按钮', () => {
      const myPlayer = createMockPlayer({
        playerId: 1, userId: 'me', role: 'witch', camp: 'good',
        abilities: { hasNightAction: true, antidote: false, poison: true },
      });
      render(<RoleActionPanel {...witchProps({ myPlayer })} />);
      expect(screen.getByText('使用解药')).toBeDisabled();
    });

    it('点击使用解药应该调用setWitchAction("antidote")', async () => {
      const setWitchAction = vi.fn();
      render(<RoleActionPanel {...witchProps({ setWitchAction })} />);

      await userEvent.click(screen.getByText('使用解药'));
      expect(setWitchAction).toHaveBeenCalledWith('antidote');
    });

    it('点击使用毒药应该调用setWitchAction和setShowPoisonModal', async () => {
      const setWitchAction = vi.fn();
      const setShowPoisonModal = vi.fn();
      render(<RoleActionPanel {...witchProps({ setWitchAction, setShowPoisonModal })} />);

      await userEvent.click(screen.getByText('使用毒药'));
      expect(setWitchAction).toHaveBeenCalledWith('poison');
      expect(setShowPoisonModal).toHaveBeenCalledWith(true);
    });

    it('毒药模态框应该显示存活玩家', () => {
      const props = witchProps({ showPoisonModal: true });
      render(<RoleActionPanel {...props} />);
      expect(screen.getByText('选择毒药目标')).toBeInTheDocument();
      // Should show alive players in the modal select
      const selects = screen.getAllByRole('combobox');
      // The last select is the poison modal one
      const poisonSelect = selects[selects.length - 1];
      const options = within(poisonSelect).getAllByRole('option');
      // placeholder + alive players (1, 2, 3)
      expect(options.length).toBeGreaterThanOrEqual(2);
    });

    it('提交应该调用onWitchSubmit', async () => {
      const onWitchSubmit = vi.fn();
      render(<RoleActionPanel {...witchProps({ onWitchSubmit })} />);

      await userEvent.click(screen.getByText('提交操作'));
      expect(onWitchSubmit).toHaveBeenCalled();
    });

    it('isSubmitting时应该禁用提交按钮', () => {
      render(<RoleActionPanel {...witchProps({ isSubmitting: true })} />);
      expect(screen.getByText('提交中...')).toBeDisabled();
    });
  });

  describe('狼人 - 刀人阶段', () => {
    function wolfProps(overrides?: Record<string, any>) {
      const players = [
        createMockPlayer({ playerId: 1, userId: 'me', username: 'Wolf1', role: 'wolf', camp: 'wolf', abilities: { hasNightAction: true } }),
        createMockPlayer({ playerId: 2, username: 'Wolf2', role: 'nightmare', camp: 'wolf', abilities: { hasNightAction: true } }),
        createMockPlayer({ playerId: 3, username: 'Good1', role: 'seer', camp: 'good' }),
        createMockPlayer({ playerId: 4, username: 'Good2', role: 'villager', camp: 'good' }),
      ];
      return defaultProps({
        myPlayer: players[0],
        currentGame: createMockGame({ currentPhase: 'wolf', players }),
        ...overrides,
      });
    }

    it('应该显示狼人队友列表', () => {
      render(<RoleActionPanel {...wolfProps()} />);
      expect(screen.getByText(/狼人队友/)).toBeInTheDocument();
      // Numbers may appear in both teammate list and select, use getAllByText
      expect(screen.getAllByText(/1号/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/2号/).length).toBeGreaterThan(0);
    });

    it('自己的卡片应该有"(你)"标记', () => {
      render(<RoleActionPanel {...wolfProps()} />);
      expect(screen.getByText(/\(你\)/)).toBeInTheDocument();
    });

    it('选择目标并提交刀人', async () => {
      const setSelectedTarget = vi.fn();
      const onSubmitAction = vi.fn();
      render(<RoleActionPanel {...wolfProps({ setSelectedTarget, onSubmitAction, selectedTarget: 3 })} />);

      const submitBtn = screen.getByText('确认刀人');
      await userEvent.click(submitBtn);
      expect(onSubmitAction).toHaveBeenCalled();
    });

    it('未选目标时确认按钮应该禁用', () => {
      render(<RoleActionPanel {...wolfProps({ selectedTarget: 0 })} />);
      expect(screen.getByText('确认刀人')).toBeDisabled();
    });
  });

  describe('通用fallback', () => {
    it('未匹配的组合应该显示通用面板', () => {
      const players = [
        createMockPlayer({ playerId: 1, userId: 'me', role: 'hunter', camp: 'good', abilities: { hasNightAction: true } }),
        createMockPlayer({ playerId: 2, username: 'P2', role: 'wolf', camp: 'wolf' }),
      ];
      const props = defaultProps({
        myPlayer: players[0],
        currentGame: createMockGame({ currentPhase: 'hunter', players }),
      });
      render(<RoleActionPanel {...props} />);
      expect(screen.getByText('提交操作')).toBeInTheDocument();
    });
  });
});
