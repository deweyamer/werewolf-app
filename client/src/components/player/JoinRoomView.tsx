import { useState } from 'react';
import { wsService } from '../../services/websocket';
import { useToast } from '../Toast';

export default function JoinRoomView() {
  const toast = useToast();
  const [roomCode, setRoomCode] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<number>(0);

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      toast('请输入房间码', 'warning');
      return;
    }
    wsService.send({
      type: 'JOIN_ROOM',
      roomCode: roomCode.trim().toUpperCase(),
      playerId: selectedPlayerId > 0 ? selectedPlayerId : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h2 className="text-xl font-bold text-white mb-6 text-center">加入房间</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 text-xs mb-1">房间码</label>
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white text-center text-lg tracking-widest uppercase"
              placeholder="输入6位房间码"
              maxLength={6}
            />
          </div>
          <div>
            <label className="block text-gray-400 text-xs mb-1">
              选择号位 <span className="text-gray-500">(可选)</span>
            </label>
            <div className="grid grid-cols-6 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(seatId => (
                <button
                  key={seatId}
                  onClick={() => setSelectedPlayerId(selectedPlayerId === seatId ? 0 : seatId)}
                  className={`h-10 rounded-lg text-sm font-bold transition ${
                    selectedPlayerId === seatId
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {seatId}
                </button>
              ))}
            </div>
            <p className="text-gray-500 text-xs mt-1">
              {selectedPlayerId > 0
                ? `已选 ${selectedPlayerId}号位`
                : '未选择，将自动分配'}
            </p>
          </div>
          <button
            onClick={handleJoinRoom}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
          >
            加入房间
          </button>
        </div>
      </div>
    </div>
  );
}
