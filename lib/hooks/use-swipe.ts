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
  const startYRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const currentXRef = useRef<number>(0);
  const verticalThreshold = 20; // pixels of Y drift allowed

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    // Don't preventDefault here - allow native scrolling to start

    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    startTimeRef.current = Date.now();
    currentXRef.current = e.clientX;
    setIsSwiping(true);
  }, [disabled]);

  const handlePointerCancel = useCallback(() => {
    startXRef.current = null;
    startYRef.current = null;
    setIsSwiping(false);
    setSwipeOffset(0);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (disabled || startXRef.current === null || !isSwiping) return;

    // Cancel if vertical drift too large
    if (startYRef.current !== null) {
      const verticalDrift = Math.abs(e.clientY - startYRef.current);
      if (verticalDrift > verticalThreshold) {
        handlePointerCancel();
        return;
      }
    }

    const diff = e.clientX - startXRef.current;
    const horizontalDrift = Math.abs(diff);

    // Only preventDefault after horizontal swipe detected (not on every move)
    if (horizontalDrift > 10) {
      e.preventDefault(); // Now we're definitely swiping horizontally
    }

    currentXRef.current = e.clientX;
    // Cap maximum swipe distance
    const cappedDiff = Math.max(diff, -120);
    setSwipeOffset(cappedDiff);
  }, [disabled, isSwiping, verticalThreshold, handlePointerCancel]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (disabled || startXRef.current === null) return;

    const distance = currentXRef.current - startXRef.current;
    const duration = Date.now() - startTimeRef.current;
    const velocity = Math.abs(distance) / duration;

    // Only preventDefault if we were actually swiping
    if (Math.abs(distance) > 10) {
      e.preventDefault();
    }

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
    startYRef.current = null;
    setIsSwiping(false);
    setSwipeOffset(0);

    return actionTriggered;
  }, [disabled, threshold, velocityThreshold, onSwipeLeft, onSwipeRight]);

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
