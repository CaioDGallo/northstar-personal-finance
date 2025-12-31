import { renderHook, act } from '@testing-library/react';
import { useLongPress } from '@/lib/hooks/use-long-press';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

      act(() => result.current.onMouseDown());
      act(() => vi.advanceTimersByTime(500));

      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it('triggers tap if released before threshold', () => {
      const onLongPress = vi.fn();
      const onTap = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress, onTap }));

      act(() => result.current.onMouseDown());
      act(() => vi.advanceTimersByTime(300));
      act(() => result.current.onMouseUp());

      expect(onLongPress).not.toHaveBeenCalled();
      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('respects custom threshold', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress, threshold: 1000 }));

      act(() => result.current.onMouseDown());
      act(() => vi.advanceTimersByTime(500));

      expect(onLongPress).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(500));
      expect(onLongPress).toHaveBeenCalledTimes(1);
    });

    it('does not trigger tap after long press', () => {
      const onLongPress = vi.fn();
      const onTap = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress, onTap }));

      act(() => result.current.onMouseDown());
      act(() => vi.advanceTimersByTime(500)); // Long press fires

      act(() => result.current.onMouseUp());

      expect(onLongPress).toHaveBeenCalledTimes(1);
      expect(onTap).not.toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('does not trigger when disabled=true', () => {
      const onLongPress = vi.fn();
      const onTap = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress, onTap, disabled: true }));

      act(() => result.current.onMouseDown());
      act(() => vi.advanceTimersByTime(500));

      expect(onLongPress).not.toHaveBeenCalled();

      act(() => result.current.onMouseUp());
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

      act(() => result.current.onMouseDown());
      act(() => vi.advanceTimersByTime(300));

      // Disable before release
      rerender({ disabled: true });

      act(() => result.current.onMouseUp());

      expect(onLongPress).not.toHaveBeenCalled();
      expect(onTap).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('clears timeout on mouse leave', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      act(() => result.current.onMouseDown());
      act(() => vi.advanceTimersByTime(300));
      act(() => result.current.onMouseLeave());

      act(() => vi.advanceTimersByTime(500));
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('clears timeout on touch cancel', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      act(() => result.current.onTouchStart());
      act(() => vi.advanceTimersByTime(300));
      act(() => result.current.onTouchCancel());

      act(() => vi.advanceTimersByTime(500));
      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('cleans up timer on unmount', () => {
      const onLongPress = vi.fn();
      const { result, unmount } = renderHook(() => useLongPress({ onLongPress }));

      act(() => result.current.onMouseDown());
      unmount();
      act(() => vi.advanceTimersByTime(500));

      expect(onLongPress).not.toHaveBeenCalled();
    });

    it('handles rapid press/release cycles without leaking timers', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      // Rapid interactions
      for (let i = 0; i < 10; i++) {
        act(() => result.current.onMouseDown());
        act(() => vi.advanceTimersByTime(100));
        act(() => result.current.onMouseUp());
      }

      // Only the timers that complete should fire
      act(() => vi.advanceTimersByTime(1000));
      expect(onLongPress).not.toHaveBeenCalled();
    });
  });

  describe('touch vs mouse events', () => {
    it('works with touch events', () => {
      const onLongPress = vi.fn();
      const onTap = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress, onTap }));

      act(() => result.current.onTouchStart());
      act(() => vi.advanceTimersByTime(300));
      act(() => result.current.onTouchEnd());

      expect(onLongPress).not.toHaveBeenCalled();
      expect(onTap).toHaveBeenCalledTimes(1);
    });

    it('supports touch long press', () => {
      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      act(() => result.current.onTouchStart());
      act(() => vi.advanceTimersByTime(500));

      expect(onLongPress).toHaveBeenCalledTimes(1);

      act(() => result.current.onTouchEnd());
    });
  });

  describe('haptic feedback', () => {
    it('calls navigator.vibrate on long press if available', () => {
      const vibrate = vi.fn();
      global.navigator.vibrate = vibrate;

      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      act(() => result.current.onMouseDown());
      act(() => vi.advanceTimersByTime(500));

      expect(vibrate).toHaveBeenCalledWith(50);
    });

    it('does not crash if navigator.vibrate unavailable', () => {
      const originalVibrate = global.navigator.vibrate;
      // @ts-ignore
      delete global.navigator.vibrate;

      const onLongPress = vi.fn();
      const { result } = renderHook(() => useLongPress({ onLongPress }));

      expect(() => {
        act(() => result.current.onMouseDown());
        act(() => vi.advanceTimersByTime(500));
      }).not.toThrow();

      expect(onLongPress).toHaveBeenCalledTimes(1);

      // Restore
      global.navigator.vibrate = originalVibrate;
    });
  });
});
