import { ReactNode } from 'react';

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

/**
 * 通用玻璃面板组件
 * 替代重复的 `bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20` 类组合
 */
export default function GlassPanel({ children, className = '', padding = 'lg' }: GlassPanelProps) {
  const paddingClass = padding === 'sm' ? 'p-4' : padding === 'md' ? 'p-6' : 'p-8';
  return (
    <div className={`glass-panel ${paddingClass} ${className}`}>
      {children}
    </div>
  );
}
