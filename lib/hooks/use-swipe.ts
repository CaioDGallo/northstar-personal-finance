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
  const [isRevealed, setIsRevealed] = useState(false);
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
    // Don't reset if actions are revealed - let user interact with them
    if (isRevealed) {
      startXRef.current = null;
      startYRef.current = null;
      setIsSwiping(false);
      return;
    }

    startXRef.current = null;
    startYRef.current = null;
    setIsSwiping(false);
    setSwipeOffset(0);
  }, [isRevealed]);

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
    const cappedDiff = Math.max(diff, -160);
    setSwipeOffset(cappedDiff);
  }, [disabled, isSwiping, verticalThreshold, handlePointerCancel]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (disabled || startXRef.current === null) return;

    const distance = currentXRef.current - startXRef.current;

    // Only preventDefault if we were actually swiping
    if (Math.abs(distance) > 10) {
      e.preventDefault();
    }

    // If swiped left past threshold, reveal and keep actions open
    if (distance < -threshold) {
      setIsRevealed(true);
      setSwipeOffset(-150);
      startXRef.current = null;
      startYRef.current = null;
      setIsSwiping(false);
      return;
    }

    // If swiped right past threshold, trigger right swipe callback
    if (distance > threshold && onSwipeRight) {
      onSwipeRight();
    }

    // Reset if threshold not met
    startXRef.current = null;
    startYRef.current = null;
    setIsSwiping(false);
    setSwipeOffset(0);
  }, [disabled, threshold, onSwipeRight]);

  const resetSwipe = useCallback(() => {
    setSwipeOffset(0);
    setIsRevealed(false);
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
    isRevealed,
    resetSwipe,
  };
}
