import { useCallback, useRef, useState } from 'react';

type UseSwipeOptions = {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number; // minimum swipe distance in pixels, default 100
  velocityThreshold?: number; // minimum swipe velocity, default 0.3
  disabled?: boolean;
};

export function useSwipe({
  onSwipeLeft,
  onSwipeRight,
  threshold = 100,
  velocityThreshold = 0.3,
  disabled = false,
}: UseSwipeOptions) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const currentXRef = useRef<number>(0);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;

    startXRef.current = e.clientX;
    startTimeRef.current = Date.now();
    currentXRef.current = e.clientX;
    setIsSwiping(true);
  }, [disabled]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (disabled || startXRef.current === null || !isSwiping) return;

    currentXRef.current = e.clientX;
    const diff = e.clientX - startXRef.current;
    setSwipeOffset(diff);
  }, [disabled, isSwiping]);

  const handlePointerUp = useCallback(() => {
    if (disabled || startXRef.current === null) return;

    const distance = currentXRef.current - startXRef.current;
    const duration = Date.now() - startTimeRef.current;
    const velocity = Math.abs(distance) / duration;

    let actionTriggered = false;

    // Check if swipe meets threshold
    if (Math.abs(distance) >= threshold && velocity >= velocityThreshold) {
      if (distance < 0 && onSwipeLeft) {
        onSwipeLeft();
        actionTriggered = true;
      } else if (distance > 0 && onSwipeRight) {
        onSwipeRight();
        actionTriggered = true;
      }
    }

    // Reset state
    startXRef.current = null;
    setIsSwiping(false);
    setSwipeOffset(0);

    return actionTriggered;
  }, [disabled, threshold, velocityThreshold, onSwipeLeft, onSwipeRight]);

  const handlePointerCancel = useCallback(() => {
    startXRef.current = null;
    setIsSwiping(false);
    setSwipeOffset(0);
  }, []);

  return {
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
      onPointerLeave: handlePointerCancel,
    },
    swipeOffset,
    isSwiping,
  };
}
