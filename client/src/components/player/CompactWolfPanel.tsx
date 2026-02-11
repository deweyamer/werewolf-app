import { useState, useRef, useEffect } from 'react';
import { Game, GamePlayer, WolfChatMessage } from '../../../../shared/src/types';
import { wsService } from '../../services/websocket';
import TargetGrid from './TargetGrid';

interface CompactWolfPanelProps {
  myPlayer: GamePlayer;
  game: Game;
  wolfChatMessages: WolfChatMessage[];
  selectedTarget: number;
  setSelectedTarget: (v: number) => void;
  onSubmitAction: () => void;
  isSubmitting: boolean;
}

export default function CompactWolfPanel({
  myPlayer, game, wolfChatMessages,
  selectedTarget, setSelectedTarget, onSubmitAction, isSubmitting,
}: CompactWolfPanelProps) {
  const [chatExpanded, setChatExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatExpanded && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [wolfChatMessages.length, chatExpanded]);

  const wolves = game.players.filter(p => p.camp === 'wolf' && p.alive);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    wsService.send({ type: 'WOLF_CHAT_SEND', content: text });
    setInputText('');
  };

  const recentMessages = wolfChatMessages.slice(-2);

  return (
    <div className="space-y-3">
      {/* 狼队友（一行徽章） */}
      <div className="flex items-center gap-1.5">
        <span className="text-gray-500 text-xs">🐺</span>
        {wolves.map(w => (
          <span
            key={w.playerId}
            className={`px-1.5 py-0.5 rounded text-xs font-bold ${
              w.playerId === myPlayer.playerId
                ? 'bg-red-600/40 text-red-200'
                : 'bg-red-600/20 text-red-300'
            }`}
          >
            {w.playerId}号
          </span>
        ))}
      </div>

      {/* 密聊（默认折叠，显示最近2条） */}
      <div className="bg-black/20 rounded-lg overflow-hidden">
        <button
          onClick={() => setChatExpanded(!chatExpanded)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-gray-400 hover:text-gray-300"
        >
          <span>💬 密聊 {wolfChatMessages.length > 0 ? `(${wolfChatMessages.length})` : ''}</span>
          <span>{chatExpanded ? '▲' : '▼'}</span>
        </button>

        {!chatExpanded && recentMessages.length > 0 && (
          <div className="px-3 pb-2 space-y-1">
            {recentMessages.map((msg, idx) => (
              <div key={idx} className="text-xs text-gray-400 truncate">
                <span className="text-red-300/70">{msg.playerId}号:</span> {msg.content}
              </div>
            ))}
          </div>
        )}

        {chatExpanded && (
          <div className="px-3 pb-2">
            <div className="h-32 overflow-y-auto space-y-1 mb-2">
              {wolfChatMessages.length === 0 && (
                <p className="text-gray-600 text-xs text-center py-2">暂无消息</p>
              )}
              {wolfChatMessages.map((msg, idx) => {
                const isMine = msg.playerId === myPlayer.playerId;
                return (
                  <div key={idx} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded px-2 py-1 text-xs ${
                      isMine ? 'bg-red-600/30 text-white' : 'bg-gray-700/50 text-gray-200'
                    }`}>
                      {!isMine && <span className="text-red-300/70 mr-1">{msg.playerId}号</span>}
                      {msg.content}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                placeholder="输入消息..."
                className="flex-1 px-2 py-1.5 bg-gray-800 border border-gray-700 rounded text-white text-xs placeholder-gray-500"
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim()}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white text-xs font-bold rounded transition"
              >
                发送
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 刀人目标 */}
      <div className="text-gray-400 text-xs">选择目标</div>
      <TargetGrid
        players={game.players}
        myPlayerId={myPlayer.playerId}
        selected={selectedTarget}
        onSelect={setSelectedTarget}
      />
      <button
        onClick={onSubmitAction}
        disabled={selectedTarget === 0 || isSubmitting}
        className="w-full py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold rounded-lg transition"
      >
        {isSubmitting ? '提交中...' : '确认'}
      </button>
    </div>
  );
}
