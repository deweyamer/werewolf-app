import { useEffect, useRef } from 'react';

interface ConfirmBottomSheetProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_STYLES = {
  danger: {
    icon: '⚠',
    titleColor: 'text-red-400',
    confirmBtn: 'bg-red-600 hover:bg-red-500 active:bg-red-700',
    iconBg: 'bg-red-500/10 border-red-500/30',
  },
  warning: {
    icon: '⚡',
    titleColor: 'text-yellow-400',
    confirmBtn: 'bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-700',
    iconBg: 'bg-yellow-500/10 border-yellow-500/30',
  },
  default: {
    icon: '?',
    titleColor: 'text-white',
    confirmBtn: 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700',
    iconBg: 'bg-blue-500/10 border-blue-500/30',
  },
};

export default function ConfirmBottomSheet({
  open,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmBottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const style = VARIANT_STYLES[variant];

  // 按 Escape 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  // 阻止背景滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <>
      {/* 遮罩层 */}
      <div
        className={`fixed inset-0 bg-black/50 backdrop-blur-sm z-[9000] transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onCancel}
      />

      {/* 底部面板 */}
      <div
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 z-[9001] transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto max-w-lg">
          <div className="bg-gray-900/95 backdrop-blur-xl border-t border-x border-white/10 rounded-t-2xl shadow-2xl p-5 pb-8 safe-bottom">
            {/* 拖拽指示条 */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />

            {/* 图标 + 标题 */}
            <div className="flex items-start gap-3 mb-4">
              <div className={`shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center text-lg ${style.iconBg}`}>
                {style.icon}
              </div>
              <div>
                <h3 className={`text-base font-bold ${style.titleColor}`}>{title}</h3>
                {description && (
                  <p className="text-sm text-gray-400 mt-1">{description}</p>
                )}
              </div>
            </div>

            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-3 bg-white/10 hover:bg-white/15 active:bg-white/5 text-gray-300 text-sm font-bold rounded-xl transition"
              >
                {cancelLabel}
              </button>
              <button
                onClick={onConfirm}
                className={`flex-1 py-3 text-white text-sm font-bold rounded-xl transition ${style.confirmBtn}`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
