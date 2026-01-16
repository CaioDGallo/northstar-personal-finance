import { useCallback, useRef, useEffect } from 'react';

type UseLongPressOptions = {
  onLongPress: () => void;
  onTap?: () => void;
  threshold?: number; // milliseconds, default 500
  moveThreshold?: number; // pixels to cancel, default 10
  disabled?: boolean;
};

export function useLongPress({
  onLongPress,
  onTap,
  threshold = 500,
  moveThreshold = 10,
  disabled = false,
}: UseLongPressOptions) {
  const timerRef = useRef<number | undefined>(undefined);
  const isLongPressRef = useRef(false);
  const startPositionRef = useRef<{ x: number; y: number } | null>(null);
  const isCancelledRef = useRef(false);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    // Don't preventDefault - allow native scrolling to work
    // Text selection prevention is handled via CSS (touch-pan-y)

    isLongPressRef.current = false;
    isCancelledRef.current = false;
    startPositionRef.current = { x: e.clientX, y: e.clientY };

    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();

      // Haptic feedback if supported
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(50);
      }
    }, threshold) as unknown as number;
  }, [onLongPress, threshold, disabled]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!startPositionRef.current || isCancelledRef.current) return;
    // Don't preventDefault - allow native scrolling to work

    const dx = Math.abs(e.clientX - startPositionRef.current.x);
    const dy = Math.abs(e.clientY - startPositionRef.current.y);

    if (dx > moveThreshold || dy > moveThreshold) {
      cancel();
      isCancelledRef.current = true;
      startPositionRef.current = null;
    }
  }, [cancel, moveThreshold]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Don't preventDefault - allow native scrolling to work
    cancel();
    startPositionRef.current = null;

    // Only fire tap if: not disabled, not long press, not cancelled by movement
    if (!disabled && !isLongPressRef.current && !isCancelledRef.current && onTap) {
      onTap();
    }
  }, [cancel, onTap, disabled]);

  const handlePointerCancel = useCallback(() => {
    cancel();
    startPositionRef.current = null;
    isCancelledRef.current = true;
  }, [cancel]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    onPointerLeave: handlePointerCancel,
  };
}
