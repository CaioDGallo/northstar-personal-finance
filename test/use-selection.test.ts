// @vitest-environment happy-dom
import { renderHook, act } from '@testing-library/react';
import { useSelection } from '@/lib/hooks/use-selection';
import { describe, it, expect, vi } from 'vitest';

describe('useSelection', () => {
  describe('auto-exit on empty', () => {
    it('exits selection mode when last item is deselected', () => {
      const { result } = renderHook(() => useSelection());

      // Enter with item 1
      act(() => result.current.enterSelectionMode(1));
      expect(result.current.isSelectionMode).toBe(true);
      expect(result.current.selectedCount).toBe(1);

      // Toggle item 1 (should auto-exit)
      act(() => result.current.toggleSelection(1));
      expect(result.current.isSelectionMode).toBe(false);
      expect(result.current.selectedCount).toBe(0);
    });

    it('calls onModeChange(false) during auto-exit', () => {
      const onModeChange = vi.fn();
      const { result } = renderHook(() => useSelection({ onModeChange }));

      act(() => result.current.enterSelectionMode(1));
      expect(onModeChange).toHaveBeenCalledWith(true);

      onModeChange.mockClear();
      act(() => result.current.toggleSelection(1));
      expect(onModeChange).toHaveBeenCalledWith(false);
    });

    it('clears selectedIds when auto-exiting', () => {
      const { result } = renderHook(() => useSelection());

      act(() => result.current.enterSelectionMode(1));
      expect(result.current.selectedCount).toBe(1);

      act(() => result.current.toggleSelection(1));
      expect(result.current.getSelectedIds()).toEqual([]);
    });
  });

  describe('encapsulation', () => {
    it('does not expose mutable Set', () => {
      const { result } = renderHook(() => useSelection());

      // Should not have selectedIds property (mutable Set)
      expect(result.current).not.toHaveProperty('selectedIds');

      // Should have selectedCount and getSelectedIds
      expect(result.current.selectedCount).toBe(0);
      expect(result.current.getSelectedIds()).toEqual([]);
    });

    it('getSelectedIds returns immutable array', () => {
      const { result } = renderHook(() => useSelection());

      act(() => result.current.enterSelectionMode(1));
      act(() => result.current.toggleSelection(2));

      const ids1 = result.current.getSelectedIds();
      const ids2 = result.current.getSelectedIds();

      // Should return new array each time (not same reference)
      expect(ids1).not.toBe(ids2);
      expect(ids1).toEqual(ids2);
      expect(ids1).toEqual([1, 2]);
    });
  });

  describe('multi-select behavior', () => {
    it('can select multiple items', () => {
      const { result } = renderHook(() => useSelection());

      act(() => result.current.enterSelectionMode(1));
      act(() => result.current.toggleSelection(2));
      act(() => result.current.toggleSelection(3));

      expect(result.current.selectedCount).toBe(3);
      expect(result.current.getSelectedIds().sort()).toEqual([1, 2, 3]);
    });

    it('does not auto-exit when deselecting but others remain', () => {
      const onModeChange = vi.fn();
      const { result } = renderHook(() => useSelection({ onModeChange }));

      act(() => result.current.enterSelectionMode(1));
      act(() => result.current.toggleSelection(2));

      onModeChange.mockClear();
      act(() => result.current.toggleSelection(2));

      // Should still be in selection mode
      expect(result.current.isSelectionMode).toBe(true);
      expect(result.current.selectedCount).toBe(1);
      expect(onModeChange).not.toHaveBeenCalled();
    });
  });

  describe('selectAll', () => {
    it('selects multiple items at once', () => {
      const { result } = renderHook(() => useSelection());

      act(() => result.current.selectAll([1, 2, 3, 4, 5]));

      expect(result.current.selectedCount).toBe(5);
      expect(result.current.getSelectedIds().sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it('replaces existing selection', () => {
      const { result } = renderHook(() => useSelection());

      act(() => result.current.enterSelectionMode(1));
      act(() => result.current.toggleSelection(2));

      act(() => result.current.selectAll([10, 20, 30]));

      expect(result.current.selectedCount).toBe(3);
      expect(result.current.getSelectedIds().sort()).toEqual([10, 20, 30]);
    });
  });

  describe('isSelected', () => {
    it('returns true for selected items', () => {
      const { result } = renderHook(() => useSelection());

      act(() => result.current.enterSelectionMode(1));
      act(() => result.current.toggleSelection(2));

      expect(result.current.isSelected(1)).toBe(true);
      expect(result.current.isSelected(2)).toBe(true);
      expect(result.current.isSelected(3)).toBe(false);
    });
  });
});
