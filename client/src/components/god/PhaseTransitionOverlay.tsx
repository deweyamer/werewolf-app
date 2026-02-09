import { useEffect, useState } from 'react';
import { getPhaseLabel } from '../../utils/phaseLabels';

interface PhaseTransitionOverlayProps {
  phase: string;
  phaseType: 'night' | 'day' | 'transition';
  prompt: string;
  visible: boolean;
  onDismiss: () => void;
}

export default function PhaseTransitionOverlay({
  phase,
  phaseType,
  prompt,
  visible,
  onDismiss,
}: PhaseTransitionOverlayProps) {
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (visible) {
      // Fade in
      requestAnimationFrame(() => setOpacity(1));
      // Auto dismiss after 2.5s
      const timer = setTimeout(() => {
        setOpacity(0);
        setTimeout(onDismiss, 500);
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      setOpacity(0);
    }
  }, [visible, onDismiss]);

  if (!visible && opacity === 0) return null;

  const isNight = phaseType === 'night';
  const isDay = phaseType === 'day';

  const bgClass = isNight
    ? 'from-indigo-950 via-blue-950 to-gray-950'
    : isDay
      ? 'from-amber-500 via-orange-400 to-yellow-300'
      : 'from-purple-950 via-indigo-950 to-gray-950';

  const icon = isNight ? '\u{1F319}' : isDay ? '\u{2600}\u{FE0F}' : '\u{2696}\u{FE0F}';
  const title = isNight ? '天黑请闭眼' : isDay ? '天亮请睁眼' : '结算中';
  const textColor = isDay ? 'text-gray-900' : 'text-white';
  const subtextColor = isDay ? 'text-gray-700' : 'text-gray-300';

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-b ${bgClass} cursor-pointer`}
      style={{
        opacity,
        transition: 'opacity 500ms ease-in-out',
        pointerEvents: opacity > 0 ? 'auto' : 'none',
      }}
      onClick={() => {
        setOpacity(0);
        setTimeout(onDismiss, 500);
      }}
    >
      <div className="text-center space-y-6">
        <div className="text-8xl animate-pulse">{icon}</div>
        <h2 className={`text-5xl font-bold ${textColor}`}>{title}</h2>
        <p className={`text-2xl ${subtextColor}`}>{getPhaseLabel(phase)}</p>
        {prompt && (
          <p className={`text-lg ${subtextColor} opacity-80`}>{prompt}</p>
        )}
        <p className={`text-sm ${subtextColor} opacity-50 mt-8`}>点击任意处关闭</p>
      </div>
    </div>
  );
}
