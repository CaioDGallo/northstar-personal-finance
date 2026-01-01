'use client';

import { useState, useEffect, useRef } from 'react';
import { useIncomeContext, IncomeListProvider } from '@/lib/contexts/income-context';
import { IncomeCard } from '@/components/income-card';
import { formatDate } from '@/lib/utils';
import { useSelection } from '@/lib/hooks/use-selection';
import { SelectionActionBar } from '@/components/selection-action-bar';
import { CategoryQuickPicker } from '@/components/category-quick-picker';
import { toast } from 'sonner';

export { IncomeListProvider };

export function IncomeList() {
  const context = useIncomeContext();
  const { income, categories, filters } = context;
  const selection = useSelection();
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);

  // Group by date (same logic as original page)
  const groupedByDate = income.reduce(
    (acc, inc) => {
      const date = inc.receivedDate;
      if (!acc[date]) acc[date] = [];
      acc[date].push(inc);
      return acc;
    },
    {} as Record<string, typeof income>
  );

  const dates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  // Watch filter changes (clear selection when month changes)
  const prevYearMonthRef = useRef(filters.yearMonth);
  const { exitSelectionMode } = selection;

  useEffect(() => {
    if (prevYearMonthRef.current !== filters.yearMonth) {
      exitSelectionMode();
    }
    prevYearMonthRef.current = filters.yearMonth;
  }, [filters.yearMonth, exitSelectionMode]);

  // Bulk category handler
  const handleBulkCategoryChange = async (categoryId: number) => {
    setBulkPickerOpen(false);

    // Filter out optimistic items (negative IDs)
    const realIncomeIds = selection.getSelectedIds().filter((id) => id > 0);

    if (realIncomeIds.length === 0) {
      toast.error('Cannot update pending items');
      return;
    }

    try {
      await context.bulkUpdateCategory(realIncomeIds, categoryId);
      selection.exitSelectionMode();
    } catch (error) {
      console.error('Bulk update failed:', error);
      // Error already toasted by context
      // Keep selection active so user can retry
    }
  };

  if (income.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">No income found for this period.</p>
        <p className="mt-2 text-sm text-gray-400">Use the + button to add income</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {dates.map((date) => (
        <div key={date}>
          <h2 className="mb-3 text-sm font-medium text-gray-500">
            {formatDate(date, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </h2>
          <div className="space-y-2">
            {groupedByDate[date].map((inc) =>
              selection.isSelectionMode ? (
                <IncomeCard
                  key={inc._tempId || inc.id}
                  income={inc}
                  categories={categories}
                  isOptimistic={inc._optimistic}
                  selectionMode={true}
                  isSelected={selection.isSelected(inc.id)}
                  onLongPress={() => selection.enterSelectionMode(inc.id)}
                  onToggleSelection={() => selection.toggleSelection(inc.id)}
                />
              ) : (
                <IncomeCard
                  key={inc._tempId || inc.id}
                  income={inc}
                  categories={categories}
                  isOptimistic={inc._optimistic}
                  selectionMode={false}
                  onLongPress={() => selection.enterSelectionMode(inc.id)}
                />
              )
            )}
          </div>
        </div>
      ))}

      {/* Selection action bar */}
      {selection.isSelectionMode && (
        <SelectionActionBar
          selectedCount={selection.selectedCount}
          onChangeCategory={() => setBulkPickerOpen(true)}
          onCancel={selection.exitSelectionMode}
        />
      )}

      {/* Bulk category picker */}
      <CategoryQuickPicker
        categories={categories}
        currentCategoryId={0}
        open={bulkPickerOpen}
        onOpenChange={setBulkPickerOpen}
        onSelect={handleBulkCategoryChange}
      />
    </div>
  );
}
