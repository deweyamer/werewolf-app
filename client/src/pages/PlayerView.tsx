import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useGameStore } from '../stores/gameStore';
import { wsService } from '../services/websocket';
import { ServerMessage, GamePlayer, WolfChatMessage } from '../../../shared/src/types';
import { useToast } from '../components/Toast';
import { getRoleName, getPhaseLabel } from '../utils/phaseLabels';
import { useGameSocket } from '../hooks/useGameSocket';
import JoinRoomView from '../components/player/JoinRoomView';
import GameView from '../components/player/GameView';
import ConfirmBottomSheet from '../components/ConfirmBottomSheet';

export default function PlayerView() {
  const { user, clearAuth } = useAuthStore();
  const { currentGame, clearGame } = useGameStore();
  const toast = useToast();
  const [myPlayer, setMyPlayer] = useState<GamePlayer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wolfChatMessages, setWolfChatMessages] = useState<WolfChatMessage[]>([]);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // 页面特定消息处理（公共事件已由 useGameSocket + eventFeedUtils 处理）
  const handlePageMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case 'ROLE_ASSIGNED':
        toast(`你的角色是: ${getRoleName(message.role)} (${message.camp === 'wolf' ? '狼人阵营' : '好人阵营'})`, 'info', 5000);
        break;
      case 'PHASE_CHANGED':
        setIsSubmitting(false);
        if (message.phase !== 'wolf') {
          setWolfChatMessages([]);
        }
        toast(`${getPhaseLabel(message.phase)}`, 'info');
        break;
      case 'WOLF_CHAT_MESSAGE':
        setWolfChatMessages(prev => [...prev, message.message]);
        break;
      case 'GAME_FINISHED':
        toast(`游戏结束！${message.winner === 'wolf' ? '狼人' : '好人'}获胜！`, 'info', 8000);
        break;
      case 'SHERIFF_VOTE_RESULT': {
        const voteResult = message as any;
        if (voteResult.winnerId) {
          toast(`警长选举: ${voteResult.winnerId}号当选`, 'info', 5000);
        } else if (voteResult.isTie) {
          toast('警长选举平票', 'warning', 5000);
        } else {
          toast('无人当选警长', 'info', 5000);
        }
        break;
      }
      case 'ACTION_RESULT':
        setIsSubmitting(false);
        if (message.success) {
          if (message.data?.seerResult) {
            toast(`查验结果：${message.data.seerResult.message}`, 'info', 6000);
          } else if (message.data?.gravekeeperResult) {
            const gkInfo = message.data.gravekeeperResult;
            toast(`验尸结果：${gkInfo.message}`, 'info', 6000);
          } else if (message.data?.victimInfo) {
            // 女巫的被刀信息在 UI 中显示
          } else {
            toast('操作成功', 'success');
          }
        } else {
          toast(message.message, 'error');
        }
        break;
    }
  }, [toast]);

  useGameSocket(handlePageMessage);

  useEffect(() => {
    if (currentGame && user) {
      const player = currentGame.players.find(p => p.userId === user.userId);
      setMyPlayer(player || null);
    }
  }, [currentGame, user]);

  const handleLeaveRoom = () => {
    setShowLeaveConfirm(true);
  };

  const doLeaveRoom = () => {
    setShowLeaveConfirm(false);
    wsService.send({ type: 'LEAVE_ROOM' });
    wsService.clearRoomCode();
    clearGame();
    setMyPlayer(null);
  };

  const handleLogout = () => {
    wsService.disconnect();
    clearAuth();
    clearGame();
  };

  // 未加入游戏：显示加入房间
  if (!currentGame) {
    return (
      <div className="relative">
        <JoinRoomView />
        {/* 退出登录按钮 */}
        <button
          onClick={handleLogout}
          className="fixed top-3 right-3 z-50 px-3 py-1.5 bg-gray-800/80 text-gray-400 text-xs rounded-lg hover:text-white transition"
        >
          退出
        </button>
      </div>
    );
  }

  // 无玩家信息时的加载态
  if (!myPlayer) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-gray-500">
        加载中...
      </div>
    );
  }

  // 正式游戏视图
  return (
    <>
      <GameView
        game={currentGame}
        myPlayer={myPlayer}
        onLeaveRoom={handleLeaveRoom}
        wolfChatMessages={wolfChatMessages}
        isSubmitting={isSubmitting}
        setIsSubmitting={setIsSubmitting}
      />
      <ConfirmBottomSheet
        open={showLeaveConfirm}
        title="确定离开房间吗？"
        description="离开后需要重新加入房间。"
        variant="warning"
        confirmLabel="离开"
        cancelLabel="留下"
        onConfirm={doLeaveRoom}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </>
  );
}
