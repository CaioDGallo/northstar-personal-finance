import { useCallback, useRef, useEffect } from 'react';

type UseLongPressOptions = {
  onLongPress: () => void;
  onTap?: () => void;
  threshold?: number; // milliseconds, default 500
  disabled?: boolean;
};

export function useLongPress({
  onLongPress,
  onTap,
  threshold = 500,
  disabled = false,
}: UseLongPressOptions) {
  const timerRef = useRef<number | undefined>(undefined);
  const isLongPressRef = useRef(false);

  const start = useCallback(() => {
    if (disabled) return;

    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();

      // Haptic feedback if supported
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, threshold) as unknown as number;
  }, [onLongPress, threshold, disabled]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  const end = useCallback(() => {
    cancel();
    // If not long press and not disabled, treat as tap
    if (!disabled && !isLongPressRef.current && onTap) {
      onTap();
    }
  }, [cancel, onTap, disabled]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: end,
    onMouseLeave: cancel,
    onTouchStart: start,
    onTouchEnd: end,
    onTouchCancel: cancel,
  };
}
