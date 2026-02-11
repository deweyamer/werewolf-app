import { useState, useMemo, useCallback } from 'react';
import { Game, GamePlayer, NightSubPhase, WolfChatMessage } from '../../../../shared/src/types';
import { useGameStore } from '../../stores/gameStore';
import { wsService } from '../../services/websocket';
import TopBar from './TopBar';
import BottomBar from './BottomBar';
import EventFeed from './EventFeed';
import ActionOverlay from './ActionOverlay';
import CompactRoleActions from './CompactRoleActions';
import VotePanel from './VotePanel';
import SheriffTransferPanel from './SheriffTransferPanel';
import SpectatorView from './SpectatorView';
import GameFinishedView from './GameFinishedView';

const NIGHT_PHASES: NightSubPhase[] = [
  'fear', 'dream', 'gargoyle', 'guard', 'wolf', 'wolf_beauty', 'witch', 'seer', 'gravekeeper', 'settle'
];

interface GameViewProps {
  game: Game;
  myPlayer: GamePlayer;
  onLeaveRoom: () => void;
  wolfChatMessages: WolfChatMessage[];
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
}

function isMyNightPhase(phase: string, player: GamePlayer): boolean {
  const role = player.role;
  const isNight = NIGHT_PHASES.includes(phase as NightSubPhase);
  if (!isNight) return false;

  // 平民/无夜间行动 → 不是"我的"夜间阶段
  if (role === 'villager' || !player.abilities.hasNightAction) return false;

  // 角色-阶段映射
  if (role === 'nightmare' && phase === 'fear') return true;
  if (role === 'dreamer' && phase === 'dream') return true;
  if (role === 'guard' && phase === 'guard') return true;
  if (role === 'seer' && phase === 'seer') return true;
  if (role === 'gargoyle' && phase === 'gargoyle') return true;
  if (role === 'gravekeeper' && phase === 'gravekeeper') return true;
  if (role === 'wolf_beauty' && phase === 'wolf_beauty') return true;
  if (role === 'witch' && phase === 'witch') return true;
  if (player.camp === 'wolf' && phase === 'wolf') return true;

  return false;
}

function needsVoteAction(game: Game, player: GamePlayer): boolean {
  // 警长竞选（done 结果已通过 EventFeed 展示，不弹 overlay）
  if (game.sheriffElection) {
    const el = game.sheriffElection;
    if (el.phase === 'signup' && player.sheriffCandidate === undefined) return true;
    if (el.phase === 'campaign' && el.candidates.includes(player.playerId)) return true;
    if (el.phase === 'voting' && !el.candidates.includes(player.playerId) && !el.withdrawn.includes(player.playerId) && el.votes[player.playerId] === undefined) return true;
  }
  // 放逐投票（done 结果已通过 EventFeed 展示，不弹 overlay）
  if (game.exileVote) {
    const ev = game.exileVote;
    if (ev.phase === 'voting' && ev.votes[player.playerId] === undefined) return true;
    if (ev.phase === 'voting' && ev.votes[player.playerId] !== undefined) return true; // 已投也显示状态
    if (ev.phase === 'pk') return true;
  }
  return false;
}

export default function GameView({ game, myPlayer, onLeaveRoom, wolfChatMessages, isSubmitting, setIsSubmitting }: GameViewProps) {
  const { eventLog } = useGameStore();
  const [selectedTarget, setSelectedTarget] = useState(0);

  const handleSubmitAction = useCallback(() => {
    if (!myPlayer || !game || isSubmitting) return;
    setIsSubmitting(true);
    wsService.send({
      type: 'PLAYER_SUBMIT_ACTION',
      action: {
        phase: game.currentPhase,
        playerId: myPlayer.playerId,
        actionType: 'action',
        target: selectedTarget,
      },
    });
  }, [myPlayer, game, isSubmitting, selectedTarget, setIsSubmitting]);

  // 等待开始（大厅）
  if (game.status === 'waiting') {
    const totalSeats = 12;
    const joined = game.players.length;
    const seats = Array.from({ length: totalSeats }, (_, i) => {
      const seatId = i + 1;
      return game.players.find(p => p.playerId === seatId) || null;
    });

    return (
      <div className="h-screen flex flex-col bg-gradient-to-b from-gray-900 to-gray-950">
        <TopBar myPlayer={myPlayer} game={game} onLeaveRoom={onLeaveRoom} />

        <main className="flex-1 mt-12 flex flex-col items-center justify-center px-4">
          {/* 剧本 + 人数 */}
          <div className="text-center mb-6">
            <div className="text-gray-500 text-xs mb-1">{game.roomCode}</div>
            <div className="text-white text-lg font-bold">{game.scriptName}</div>
            <div className="text-gray-400 text-sm mt-1">
              <span className="text-blue-400 font-bold">{joined}</span>
              <span> / {totalSeats} 人已就座</span>
            </div>
          </div>

          {/* 座位网格 */}
          <div className="grid grid-cols-4 gap-2.5 w-full max-w-xs">
            {seats.map((player, idx) => {
              const seatId = idx + 1;
              const isSelf = player?.playerId === myPlayer.playerId;

              return (
                <div
                  key={seatId}
                  className={`h-14 rounded-xl flex flex-col items-center justify-center transition-all ${
                    player
                      ? isSelf
                        ? 'bg-blue-600/30 border border-blue-500/50'
                        : 'bg-white/10 border border-white/10'
                      : 'bg-white/[0.03] border border-dashed border-white/10'
                  }`}
                >
                  <span className={`text-sm font-bold ${
                    player ? (isSelf ? 'text-blue-200' : 'text-white') : 'text-gray-700'
                  }`}>
                    {seatId}
                  </span>
                  {player ? (
                    <span className={`text-[10px] mt-0.5 truncate max-w-[60px] ${
                      isSelf ? 'text-blue-300/80' : 'text-gray-400'
                    }`}>
                      {isSelf ? '我' : player.username}
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-700 mt-0.5">空位</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* 等待提示 */}
          <div className="mt-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 text-gray-400 text-sm">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              等待上帝开始游戏
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 游戏结束
  if (game.status === 'finished') {
    return (
      <div className="h-screen flex flex-col bg-gradient-to-b from-gray-900 to-gray-950">
        <TopBar myPlayer={myPlayer} game={game} onLeaveRoom={onLeaveRoom} />
        <div className="flex-1 mt-12 mb-16 flex flex-col">
          <GameFinishedView game={game} />
          <div className="flex-1 overflow-hidden">
            <EventFeed events={eventLog} className="h-full" />
          </div>
        </div>
        <BottomBar game={game} myPlayer={myPlayer} />
      </div>
    );
  }

  // 出局观战
  if (game.status === 'running' && !myPlayer.alive) {
    // 警徽传递仍然需要显示（出局后传递）
    const needsSheriffTransfer = game.pendingSheriffTransfer?.fromPlayerId === myPlayer.playerId &&
                                  game.pendingSheriffTransfer?.reason === 'death';

    return (
      <div className="h-screen flex flex-col bg-gradient-to-b from-gray-900 to-gray-950">
        <TopBar myPlayer={myPlayer} game={game} onLeaveRoom={onLeaveRoom} />
        <div className="flex-1 mt-12 mb-16 flex flex-col overflow-hidden">
          {needsSheriffTransfer ? (
            <SheriffTransferPanel game={game} myPlayer={myPlayer} />
          ) : null}
          <EventFeed events={eventLog} className="flex-1" />
        </div>
        <BottomBar game={game} myPlayer={myPlayer} />
      </div>
    );
  }

  // 正常游戏中
  const showNightAction = isMyNightPhase(game.currentPhase, myPlayer);
  const showVote = needsVoteAction(game, myPlayer);
  const needsSheriffTransfer = game.pendingSheriffTransfer?.fromPlayerId === myPlayer.playerId &&
                                game.pendingSheriffTransfer?.reason === 'death';
  // 狼人自爆在讨论阶段
  const canBoom = myPlayer.camp === 'wolf' && myPlayer.role !== 'wolf_beauty' && myPlayer.role !== 'black_wolf' && myPlayer.role !== 'gargoyle' && myPlayer.role !== 'nightmare';
  const showBoom = canBoom && game.currentPhase === 'discussion';

  const showOverlay = showNightAction || showVote || needsSheriffTransfer || showBoom;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-b from-gray-900 to-gray-950">
      <TopBar myPlayer={myPlayer} game={game} onLeaveRoom={onLeaveRoom} />

      {/* Zone B: 主内容区 */}
      <main className="flex-1 mt-12 mb-16 relative overflow-hidden">
        {/* 事件流（始终在底层） */}
        <EventFeed events={eventLog} className="h-full" />

        {/* 操作叠加层 */}
        <ActionOverlay isVisible={showOverlay}>
          {needsSheriffTransfer ? (
            <SheriffTransferPanel game={game} myPlayer={myPlayer} />
          ) : showVote ? (
            <VotePanel
              game={game}
              myPlayer={myPlayer}
              isSubmitting={isSubmitting}
              setIsSubmitting={setIsSubmitting}
            />
          ) : (showNightAction || showBoom) ? (
            <CompactRoleActions
              myPlayer={myPlayer}
              game={game}
              selectedTarget={selectedTarget}
              setSelectedTarget={setSelectedTarget}
              onSubmitAction={handleSubmitAction}
              isSubmitting={isSubmitting}
              setIsSubmitting={setIsSubmitting}
              wolfChatMessages={wolfChatMessages}
            />
          ) : null}
        </ActionOverlay>
      </main>

      <BottomBar game={game} myPlayer={myPlayer} />
    </div>
  );
}
