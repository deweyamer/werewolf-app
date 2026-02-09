import { useState, useEffect } from 'react';
import { wsService, ConnectionStatus as ConnStatus } from '../services/websocket';

const STATUS_CONFIG: Record<ConnStatus, { color: string; text: string; pulse: boolean }> = {
  connected: { color: 'bg-green-500', text: '已连接', pulse: false },
  connecting: { color: 'bg-yellow-500', text: '连接中...', pulse: true },
  reconnecting: { color: 'bg-yellow-500', text: '重连中...', pulse: true },
  disconnected: { color: 'bg-red-500', text: '已断线', pulse: false },
};

export default function ConnectionStatusIndicator() {
  const [status, setStatus] = useState<ConnStatus>(wsService.status);

  useEffect(() => {
    return wsService.onStatusChange(setStatus);
  }, []);

  // 连接正常时不显示（不干扰正常游戏）
  if (status === 'connected') return null;

  const cfg = STATUS_CONFIG[status];

  return (
    <div className="fixed bottom-4 left-4 z-[9998] flex items-center gap-2 px-4 py-2 bg-black/80 backdrop-blur-md rounded-full border border-white/20 text-sm text-white">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${cfg.color} ${cfg.pulse ? 'animate-pulse' : ''}`} />
      <span>{cfg.text}</span>
    </div>
  );
}
