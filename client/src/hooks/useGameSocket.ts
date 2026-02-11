import { useEffect, useRef } from 'react';
import { useGameStore } from '../stores/gameStore';
import { wsService } from '../services/websocket';
import { ServerMessage } from '../../../shared/src/types';

/**
 * 统一处理 WebSocket 游戏消息的 hook
 * 处理 ROOM_JOINED, GAME_STATE_UPDATE, PLAYER_JOINED 等通用消息
 * 页面级组件只需处理页面特定的消息（如 ROLE_ASSIGNED, ROOM_CREATED 等）
 */
export function useGameSocket(
  onPageMessage?: (message: ServerMessage) => void
) {
  const { setGame } = useGameStore();
  const onPageMessageRef = useRef(onPageMessage);
  onPageMessageRef.current = onPageMessage;

  useEffect(() => {
    const unsubscribe = wsService.onMessage((message: ServerMessage) => {
      // 通用消息处理
      switch (message.type) {
        case 'ROOM_JOINED':
          setGame(message.game);
          break;
        case 'GAME_STATE_UPDATE':
          setGame(message.game);
          break;
        case 'PLAYER_JOINED': {
          const currentGame = useGameStore.getState().currentGame;
          if (currentGame) {
            const updatedGame = { ...currentGame };
            updatedGame.players = [...updatedGame.players, message.player];
            setGame(updatedGame);
          }
          break;
        }
      }

      // 页面特定消息处理
      onPageMessageRef.current?.(message);
    });

    return unsubscribe;
  }, [setGame]);
}
