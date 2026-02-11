import { ReactNode } from 'react';

interface ActionOverlayProps {
  isVisible: boolean;
  children: ReactNode;
}

export default function ActionOverlay({ isVisible, children }: ActionOverlayProps) {
  return (
    <div
      className={`absolute bottom-0 left-0 right-0 z-30 bg-gray-900/95 backdrop-blur-md rounded-t-2xl border-t border-white/10 max-h-[60vh] overflow-y-auto transition-transform duration-300 ease-out ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="px-4 pt-3 pb-4">
        {/* 拖拽指示条 */}
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        {children}
      </div>
    </div>
  );
}
