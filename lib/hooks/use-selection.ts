import { useState, useCallback } from 'react';

type UseSelectionOptions = {
  onModeChange?: (isActive: boolean) => void;
};

export function useSelection(options?: UseSelectionOptions) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Extract callback to avoid unstable dependencies
  const onModeChange = options?.onModeChange;

  const enterSelectionMode = useCallback((initialId: number) => {
    setSelectedIds(new Set([initialId]));
    setIsSelectionMode(true);
    onModeChange?.(true);
  }, [onModeChange]);

  const exitSelectionMode = useCallback(() => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    onModeChange?.(false);
  }, [onModeChange]);

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Auto-exit if nothing selected
        if (next.size === 0) {
          setIsSelectionMode(false);
          onModeChange?.(false);
        }
      } else {
        next.add(id);
      }
      return next;
    });
  }, [onModeChange]);

  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const isSelected = useCallback((id: number) => selectedIds.has(id), [selectedIds]);

  const getSelectedIds = useCallback(() => Array.from(selectedIds), [selectedIds]);

  return {
    // Hide mutable Set, expose derived values
    selectedCount: selectedIds.size,
    getSelectedIds,
    isSelectionMode,
    isSelected,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelection,
    selectAll,
  };
}
