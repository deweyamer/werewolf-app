import { ScriptV2 } from '../../../../shared/src/types';

interface RoomLobbyProps {
  scripts: ScriptV2[];
  selectedScript: string;
  setSelectedScript: (value: string) => void;
  onCreateRoom: () => void;
  onCreateTestGame: () => void;
  onJoinRoom: () => void;
  roomCode: string;
  setRoomCode: (value: string) => void;
  onShowRoleSelector: () => void;
}

export default function RoomLobby({
  scripts,
  selectedScript,
  setSelectedScript,
  onCreateRoom,
  onCreateTestGame,
  onJoinRoom,
  roomCode,
  setRoomCode,
  onShowRoleSelector,
}: RoomLobbyProps) {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
      <h2 className="text-2xl font-bold text-white mb-6">创建或加入房间</h2>

      <div className="grid md:grid-cols-2 gap-8">
        <div>
          <h3 className="text-xl font-bold text-white mb-4">创建新房间</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-white text-sm font-medium mb-2">选择剧本</label>
              <select
                value={selectedScript}
                onChange={(e) => setSelectedScript(e.target.value)}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white"
              >
                {scripts.map((script) => (
                  <option key={script.id} value={script.id} className="text-gray-900 bg-white">
                    {script.name} ({script.playerCount}人)
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={onCreateRoom}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition"
            >
              创建房间
            </button>
            <div className="flex gap-2 mt-2">
              <button
                onClick={onCreateTestGame}
                className="flex-1 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-lg transition"
              >
                一键测试游戏
              </button>
              <button
                onClick={onShowRoleSelector}
                className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg transition"
              >
                + 自定义剧本
              </button>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-xl font-bold text-white mb-4">加入已有房间</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-white text-sm font-medium mb-2">房间码</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white uppercase"
                placeholder="输入6位房间码"
                maxLength={6}
              />
            </div>
            <button
              onClick={onJoinRoom}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
            >
              加入房间
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
