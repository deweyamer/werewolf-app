// 环境配置文件
const isDev = import.meta.env.DEV;

export const config = {
  // API基础URL - 生产环境使用相对路径 /api，通过nginx代理
  apiUrl: isDev
    ? 'http://localhost:3001/api'
    : (import.meta.env.VITE_API_URL ?? '/api'),

  // WebSocket URL - 生产环境使用相对路径，自动拼接当前host
  wsUrl: isDev
    ? 'ws://localhost:3001'
    : '',  // 空字符串让 socket.io 自动使用当前页面的 host

  // 环境
  isDev,
  isProd: !isDev,
};
