// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { useLongPress } from '@/lib/hooks/use-long-press';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Helper to create mock pointer events
const createPointerEvent = (clientX = 0, clientY = 0): Partial<React.PointerEvent> => ({
  clientX,
  clientY,
  preventDefault: vi.fn(),
  stopPropagation: vi.fn(),
} as Partial<React.PointerEvent>);

describe('useLongPress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('threshold detection', () => {
    it('triggers long press after threshold (500ms default)', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      act(() => result.current.onPointerDown(createPointerEvent() as React.PointerEvent));
      act(() => vi.advanceTimersByTime(500));

      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it('triggers tap if released before threshold', () => {
      const onLongPress = vi.fn();
      const onTap = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress, onTap }));

      act(() => result.current.onPointerDown(createPointerEvent() as React.PointerEvent));
      act(() => vi.advanceTimersByTime(300));
      act(() => result.current.onPointerUp(createPointerEvent() as React.PointerEvent));

      expect(onLongPress).not.toHaveBeenCalled();
      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('respects custom threshold', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress, threshold: 1000 }));

      act(() => result.current.onPointerDown(createPointerEvent() as React.PointerEvent));
      act(() => vi.advanceTimersByTime(500));

      expect(onLongPress).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(500));
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it('does not trigger tap after long press', () => {
      const onLongPress = vi.fn();
      const onTap = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress, onTap }));

      act(() => result.current.onPointerDown(createPointerEvent() as React.PointerEvent));
      act(() => vi.advanceTimersByTime(500)); // Long press fires

      act(() => result.current.onPointerUp(createPointerEvent() as React.PointerEvent));

      expect(onLongPress).toHaveBeenCalledTimes(1);
      expect(onTap).not.toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('does not trigger when disabled=true', () => {
      const onLongPress = vi.fn();
      const onTap = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress, onTap, disabled: true }));

      act(() => result.current.onPointerDown(createPointerEvent() as React.PointerEvent));
      act(() => vi.advanceTimersByTime(500));

      expect(onLongPress).not.toHaveBeenCalled();

      act(() => result.current.onPointerUp(createPointerEvent() as React.PointerEvent));
      expect(onTap).not.toHaveBeenCalled();
    });

    it('does not trigger tap when disabled mid-interaction', () => {
      const onLongPress = vi.fn();
      const onTap = vi.fn();

      // Start enabled
      const { result, rerender } = renderHook(
        ({ disabled }) => useLongPress({ onLongPress, onTap, disabled }),
        { initialProps: { disabled: false } }
      );

      act(() => result.current.onPointerDown(createPointerEvent() as React.PointerEvent));
      act(() => vi.advanceTimersByTime(300));

      // Disable before release
      rerender({ disabled: true });

      act(() => result.current.onPointerUp(createPointerEvent() as React.PointerEvent));

      expect(onLongPress).not.toHaveBeenCalled();
      expect(onTap).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('clears timeout on pointer leave', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      act(() => result.current.onPointerDown(createPointerEvent() as React.PointerEvent));
      act(() => vi.advanceTimersByTime(300));
      act(() => result.current.onPointerLeave(createPointerEvent() as React.PointerEvent));

      act(() => vi.advanceTimersByTime(500));
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('clears timeout on pointer cancel', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      act(() => result.current.onPointerDown(createPointerEvent() as React.PointerEvent));
      act(() => vi.advanceTimersByTime(300));
      act(() => result.current.onPointerCancel(createPointerEvent() as React.PointerEvent));

      act(() => vi.advanceTimersByTime(500));
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('cleans up timer on unmount', () => {
      const onLongPress = vi.fn();
      const { result, unmount } = renderHook(() => useLongPress({ onLongPress }));

      act(() => result.current.onPointerDown(createPointerEvent() as React.PointerEvent));
      unmount();
      act(() => vi.advanceTimersByTime(500));

      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('handles rapid press/release cycles without leaking timers', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      // Rapid interactions
      for (let i = 0; i < 10; i++) {
        act(() => result.current.onPointerDown(createPointerEvent() as React.PointerEvent));
        act(() => vi.advanceTimersByTime(100));
        act(() => result.current.onPointerUp(createPointerEvent() as React.PointerEvent));
      }

      // Only the timers that complete should fire
      act(() => vi.advanceTimersByTime(1000));
      expect(onLongPress).not.toHaveBeenCalled();
    });
  });

  describe('movement tracking', () => {
    it('cancels long press if pointer moves beyond threshold (default 10px)', () => {
      const onLongPress = vi.fn();
      const onTap = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress, onTap }));

      act(() => result.current.onPointerDown(createPointerEvent(0, 0) as React.PointerEvent));
      act(() => vi.advanceTimersByTime(300));

      // Move pointer 15px (beyond 10px threshold)
      act(() => result.current.onPointerMove(createPointerEvent(15, 0) as React.PointerEvent));

      act(() => vi.advanceTimersByTime(500));
      expect(onLongPress).not.toHaveBeenCalled();

      // Should not trigger tap either (cancelled by movement)
      act(() => result.current.onPointerUp(createPointerEvent(15, 0) as React.PointerEvent));
      expect(onTap).not.toHaveBeenCalled();
    });

    it('does not cancel if movement is within threshold', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      act(() => result.current.onPointerDown(createPointerEvent(0, 0) as React.PointerEvent));

      // Move pointer 5px (within 10px threshold)
      act(() => result.current.onPointerMove(createPointerEvent(5, 0) as React.PointerEvent));
      act(() => vi.advanceTimersByTime(500));

      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it('respects custom moveThreshold', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress, moveThreshold: 20 }));

      act(() => result.current.onPointerDown(createPointerEvent(0, 0) as React.PointerEvent));

      // Move 15px (within custom 20px threshold)
      act(() => result.current.onPointerMove(createPointerEvent(15, 0) as React.PointerEvent));
      act(() => vi.advanceTimersByTime(500));

      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it('cancels on vertical movement (scroll simulation)', () => {
      const onLongPress = vi.fn();
      const onTap = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress, onTap }));

      act(() => result.current.onPointerDown(createPointerEvent(0, 0) as React.PointerEvent));
      act(() => vi.advanceTimersByTime(200));

      // Simulate vertical scroll (move 20px down)
      act(() => result.current.onPointerMove(createPointerEvent(0, 20) as React.PointerEvent));

      act(() => vi.advanceTimersByTime(500));
      expect(onLongPress).not.toHaveBeenCalled();

      act(() => result.current.onPointerUp(createPointerEvent(0, 20) as React.PointerEvent));
      expect(onTap).not.toHaveBeenCalled();
    });

    it('cancels on diagonal movement', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      act(() => result.current.onPointerDown(createPointerEvent(0, 0) as React.PointerEvent));

      // Move 11px horizontally and 5px vertically (horizontal exceeds 10px threshold)
      act(() => result.current.onPointerMove(createPointerEvent(11, 5) as React.PointerEvent));
      act(() => vi.advanceTimersByTime(500));

      // 11px horizontal exceeds 10px threshold, should cancel
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('prevents further cancellation after already cancelled', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      act(() => result.current.onPointerDown(createPointerEvent(0, 0) as React.PointerEvent));

      // First move cancels
      act(() => result.current.onPointerMove(createPointerEvent(15, 0) as React.PointerEvent));

      // Second move should be no-op (already cancelled)
      act(() => result.current.onPointerMove(createPointerEvent(30, 0) as React.PointerEvent));

      act(() => vi.advanceTimersByTime(500));
      expect(onLongPress).not.toHaveBeenCalled();
    });
  });

  describe('haptic feedback', () => {
    it('calls navigator.vibrate on long press if available', () => {
      const vibrate = vi.fn();
      global.navigator.vibrate = vibrate;

      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      act(() => result.current.onPointerDown(createPointerEvent() as React.PointerEvent));
      act(() => vi.advanceTimersByTime(500));

      expect(vibrate).toHaveBeenCalledWith(50);
    });

    it('does not crash if navigator.vibrate unavailable', () => {
      const originalVibrate = global.navigator.vibrate;
      // @ts-expect-error - Testing graceful degradation
      delete global.navigator.vibrate;

      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      expect(() => {
        act(() => result.current.onPointerDown(createPointerEvent() as React.PointerEvent));
        act(() => vi.advanceTimersByTime(500));
      }).not.toThrow();

      expect(onLongPress).toHaveBeenCalledTimes(1);

      // Restore
      global.navigator.vibrate = originalVibrate;
    });
  });
});
