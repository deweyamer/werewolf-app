import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { wsService } from '../services/websocket';
import { ServerMessage } from '../../../shared/src/types';
import { deriveEventsFromStateDiff, deriveEventsFromHistory } from '../utils/eventFeedUtils';

/**
 * 统一处理 WebSocket 游戏消息的 hook
 * 处理 ROOM_JOINED, GAME_STATE_UPDATE, PLAYER_JOINED 等通用消息
 * 页面级组件只需处理页面特定的消息（如 ROLE_ASSIGNED, ROOM_CREATED 等）
 */
export function useGameSocket(
  onPageMessage?: (message: ServerMessage) => void
) {
  const { setGame, addEvents } = useGameStore();
  const onPageMessageRef = useRef(onPageMessage);
  onPageMessageRef.current = onPageMessage;

  useEffect(() => {
    const unsubscribe = wsService.onMessage((message: ServerMessage) => {
      // 通用消息处理
      switch (message.type) {
        case 'ROOM_JOINED': {
          const game = message.game;
          // 从游戏状态恢复事件（使用 roundHistory 结构化数据）
          const events = deriveEventsFromHistory(game);
          if (events.length > 0) {
            addEvents(events);
          }
          setGame(game);
          break;
        }
        case 'GAME_STATE_UPDATE': {
          const prevGame = useGameStore.getState().currentGame;
          const newGame = message.game;
          // 推导新事件
          const newEvents = deriveEventsFromStateDiff(prevGame, newGame);
          if (newEvents.length > 0) {
            addEvents(newEvents);
          }
          setGame(newGame);
          break;
        }
        case 'PLAYER_JOINED': {
          const currentGame = useGameStore.getState().currentGame;
          if (currentGame) {
            const updatedGame = { ...currentGame };
            updatedGame.players = [...updatedGame.players, message.player];
            setGame(updatedGame);
          }
          break;
        }
        case 'EXILE_VOTE_UPDATE': {
          const currentGame = useGameStore.getState().currentGame;
          if (currentGame) {
            setGame({ ...currentGame, exileVote: message.state });
          }
          break;
        }
      }

      // 页面特定消息处理
      onPageMessageRef.current?.(message);
    });

    return unsubscribe;
  }, [setGame, addEvents]);
}
