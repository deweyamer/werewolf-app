import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';

// ============================================
// Toast 通知系统 - 替代 alert()
// ============================================

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let globalToastFn: ((message: string, type?: ToastType, duration?: number) => void) | null = null;

/**
 * 全局 toast 函数，可在组件外使用（如 websocket handler）
 */
export function showToast(message: string, type: ToastType = 'info', duration = 3000) {
  if (globalToastFn) {
    globalToastFn(message, type, duration);
  }
}

/**
 * Hook: 在组件内使用 toast
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx.toast;
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'bg-green-600/90 border-green-400',
  error: 'bg-red-600/90 border-red-400',
  info: 'bg-blue-600/90 border-blue-400',
  warning: 'bg-yellow-600/90 border-yellow-400',
};

const TYPE_ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✗',
  info: 'ℹ',
  warning: '⚠',
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: number) => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setIsExiting(true), toast.duration - 300);
    const removeTimer = setTimeout(() => onRemove(toast.id), toast.duration);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id, toast.duration, onRemove]);

  return (
    <div
      className={`flex items-center gap-3 px-5 py-3 rounded-xl border backdrop-blur-md shadow-2xl text-white text-sm transition-all duration-300 ${
        TYPE_STYLES[toast.type]
      } ${isExiting ? 'opacity-0 translate-x-8' : 'opacity-100 translate-x-0'}`}
      role="alert"
    >
      <span className="text-lg font-bold">{TYPE_ICONS[toast.type]}</span>
      <span>{toast.message}</span>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idCounter = useRef(0);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = ++idCounter.current;
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 注册全局 toast 函数
  useEffect(() => {
    globalToastFn = addToast;
    return () => { globalToastFn = null; };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast 容器 - 右上角固定 */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
