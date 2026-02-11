import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * 内联确认 hook：按钮点击后进入"确认中"状态，再次点击执行操作。
 * 超时（默认3秒）自动恢复初始状态。
 *
 * @param onConfirm 确认后执行的回调
 * @param timeout 超时时间（毫秒），超时后自动取消确认状态
 * @returns { confirming, handleClick, cancel }
 */
export function useInlineConfirm(onConfirm: () => void, timeout = 3000) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const cancel = useCallback(() => {
    setConfirming(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const handleClick = useCallback(() => {
    if (!confirming) {
      setConfirming(true);
      timerRef.current = setTimeout(() => {
        setConfirming(false);
      }, timeout);
    } else {
      cancel();
      onConfirm();
    }
  }, [confirming, onConfirm, timeout, cancel]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { confirming, handleClick, cancel };
}
