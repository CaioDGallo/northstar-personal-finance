'use client';

import { useState, useEffect, useRef } from 'react';
import { useExpenseContext, ExpenseListProvider } from '@/lib/contexts/expense-context';
import { ExpenseCard } from '@/components/expense-card';
import { useSelection } from '@/lib/hooks/use-selection';
import { SelectionActionBar } from '@/components/selection-action-bar';
import { CategoryQuickPicker } from '@/components/category-quick-picker';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { triggerHaptic, HapticPatterns } from '@/lib/utils/haptics';
import { usePullToRefresh } from '@/lib/hooks/use-pull-to-refresh';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export { ExpenseListProvider };

export function ExpenseList() {
  const t = useTranslations('expenses');
  const context = useExpenseContext();
  const { expenses, filteredExpenses, accounts, recentAccounts, categories, recentCategories, unpaidFaturas, filters, searchQuery } = context;
  const selection = useSelection();
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);
  const router = useRouter();

  // Pull-to-refresh functionality
  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      triggerHaptic(HapticPatterns.light);
      router.refresh();
      // Wait a bit for the refresh to complete
      await new Promise(resolve => setTimeout(resolve, 500));
    },
    disabled: selection.isSelectionMode, // Disable during selection mode
  });

  // Group by date (same logic as original page)
  const groupedByDate = filteredExpenses.reduce(
    (acc, expense) => {
      const date = expense.purchaseDate;
      if (!acc[date]) acc[date] = [];
      acc[date].push(expense);
      return acc;
    },
    {} as Record<string, typeof filteredExpenses>
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
        toast.error(t('cannotUpdatePendingItems'));
      } else {
        toast.error(t('noValidItemsToUpdate'));
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
      triggerHaptic(HapticPatterns.success);
      selection.exitSelectionMode();
    } catch (error) {
      console.error('Bulk update failed:', error);
      triggerHaptic(HapticPatterns.heavy);
      // Error already toasted by context
      // Keep selection active so user can retry
    }
  };

  if (filteredExpenses.length === 0) {
    // Show different message when searching vs no data
    if (searchQuery.trim()) {
      return (
        <div className="py-12 text-center">
          <p className="text-gray-500">{t('noExpensesFound', { query: searchQuery })}</p>
          <p className="mt-2 text-sm text-gray-400">{t('tryDifferentSearch')}</p>
        </div>
      );
    }
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500">{t('noExpensesThisPeriod')}</p>
        <p className="mt-2 text-sm text-gray-400">{t('useButtonToAdd')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Pull-to-refresh indicator */}
      {(pullToRefresh.isRefreshing || pullToRefresh.pullDistance > 0) && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex justify-center"
          style={{
            transform: `translateY(${Math.min(pullToRefresh.pullDistance, 80)}px)`,
            transition: pullToRefresh.isRefreshing ? 'transform 0.3s ease-out' : 'none',
          }}
        >
          <div className="bg-gray-900/90 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm">
            {pullToRefresh.isRefreshing ? t('refreshing') : t('pullToRefresh')}
          </div>
        </div>
      )}

      {dates.map((date) => (
        <div key={date}>
          <h2 className="mb-2 text-sm font-medium text-gray-500">
            {formatDate(date, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </h2>
          <div className="space-y-1">
            {groupedByDate[date].map((expense) =>
              selection.isSelectionMode ? (
                <ExpenseCard
                  key={expense._tempId || expense.id}
                  entry={expense}
                  categories={categories}
                  accounts={accounts}
                  recentAccounts={recentAccounts}
                  recentCategories={recentCategories}
                  isOptimistic={expense._optimistic}
                  selectionMode={true}
                  isSelected={selection.isSelected(expense.id)}
                  onLongPress={() => selection.enterSelectionMode(expense.id)}
                  onToggleSelection={() => selection.toggleSelection(expense.id)}
                  unpaidFaturas={unpaidFaturas}
                />
              ) : (
                <ExpenseCard
                  key={expense._tempId || expense.id}
                  entry={expense}
                  categories={categories}
                  accounts={accounts}
                  recentAccounts={recentAccounts}
                  recentCategories={recentCategories}
                  isOptimistic={expense._optimistic}
                  selectionMode={false}
                  onLongPress={() => selection.enterSelectionMode(expense.id)}
                  unpaidFaturas={unpaidFaturas}
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
