'use client';

import { useState, useEffect, useRef } from 'react';
import { useExpenseContext, ExpenseListProvider } from '@/lib/contexts/expense-context';
import { ExpenseCard } from '@/components/expense-card';
import { useSelection } from '@/lib/hooks/use-selection';
import { SelectionActionBar } from '@/components/selection-action-bar';
import { CategoryQuickPicker } from '@/components/category-quick-picker';
import { toast } from 'sonner';

export { ExpenseListProvider };

export function ExpenseList() {
  const context = useExpenseContext();
  const { expenses, categories, filters } = context;
  const selection = useSelection();
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);

  // Group by date (same logic as original page)
  const groupedByDate = expenses.reduce(
    (acc, expense) => {
      const date = expense.dueDate;
      if (!acc[date]) acc[date] = [];
      acc[date].push(expense);
      return acc;
    },
    {} as Record<string, typeof expenses>
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

    // Validate and map entry IDs to transaction IDs with detailed tracking
    const realTransactionIds: number[] = [];
    const skippedCount = { optimistic: 0, notFound: 0, invalid: 0 };

    selection.getSelectedIds().forEach((id) => {
      if (id <= 0) {
        skippedCount.optimistic++;
        return;
      }

      const entry = expenses.find((e) => e.id === id);
      if (!entry) {
        skippedCount.notFound++;
        console.warn('Selected entry not found:', id);
        return;
      }

      if (!entry.transactionId || entry.transactionId <= 0) {
        skippedCount.invalid++;
        console.error('Entry has invalid transactionId:', { id, transactionId: entry.transactionId });
        return;
      }

      realTransactionIds.push(entry.transactionId);
    });

    // Deduplicate transaction IDs (multiple entries can share same transaction)
    const uniqueTransactionIds = [...new Set(realTransactionIds)];

    // Provide detailed feedback based on what was skipped
    if (uniqueTransactionIds.length === 0) {
      if (skippedCount.optimistic > 0) {
        toast.error('Cannot update pending items');
      } else {
        toast.error('No valid items to update');
        console.error('Selection failed:', skippedCount);
      }
      return;
    }

    if (skippedCount.notFound > 0 || skippedCount.invalid > 0) {
      toast.warning(`Updating ${uniqueTransactionIds.length} items (${skippedCount.notFound + skippedCount.invalid} skipped)`);
      console.warn('Some items skipped:', skippedCount);
    }

    try {
      await context.bulkUpdateCategory(uniqueTransactionIds, categoryId);
      selection.exitSelectionMode();
    } catch (error) {
      console.error('Bulk update failed:', error);
      // Error already toasted by context
      // Keep selection active so user can retry
    }
  };

  if (expenses.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">No expenses found for this period.</p>
        <p className="mt-2 text-sm text-gray-400">Use the + button to add an expense</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {dates.map((date) => (
        <div key={date}>
          <h2 className="mb-3 text-sm font-medium text-gray-500">
            {new Date(date).toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </h2>
          <div className="space-y-3">
            {groupedByDate[date].map((expense) =>
              selection.isSelectionMode ? (
                <ExpenseCard
                  key={expense._tempId || expense.id}
                  entry={expense}
                  categories={categories}
                  isOptimistic={expense._optimistic}
                  selectionMode={true}
                  isSelected={selection.isSelected(expense.id)}
                  onLongPress={() => selection.enterSelectionMode(expense.id)}
                  onToggleSelection={() => selection.toggleSelection(expense.id)}
                />
              ) : (
                <ExpenseCard
                  key={expense._tempId || expense.id}
                  entry={expense}
                  categories={categories}
                  isOptimistic={expense._optimistic}
                  selectionMode={false}
                  onLongPress={() => selection.enterSelectionMode(expense.id)}
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
