// 环境配置文件
const isDev = import.meta.env.DEV;

export const config = {
  // API基础URL
  apiUrl: isDev
    ? 'http://localhost:3001'
    : import.meta.env.VITE_API_URL || 'http://localhost:3001',

  // WebSocket URL
  wsUrl: isDev
    ? 'ws://localhost:3001'
    : import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || 'ws://localhost:3001',

  // 环境
  isDev,
  isProd: !isDev,
};
