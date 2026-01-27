'use client';

import { useState, useEffect, useRef } from 'react';
import { useIncomeContext, IncomeListProvider } from '@/lib/contexts/income-context';
import { IncomeCard } from '@/components/income-card';
import { formatDate } from '@/lib/utils';
import { useSelection } from '@/lib/hooks/use-selection';
import { SelectionActionBar } from '@/components/selection-action-bar';
import { CategoryQuickPicker } from '@/components/category-quick-picker';
import { toast } from 'sonner';
import { triggerHaptic, HapticPatterns } from '@/lib/utils/haptics';
import { usePullToRefresh } from '@/lib/hooks/use-pull-to-refresh';
import { refreshUserData } from '@/lib/actions/refresh';
import { PullToRefreshIndicator } from '@/components/pull-to-refresh-indicator';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export { IncomeListProvider };

export function IncomeList() {
  const tCommon = useTranslations('common');
  const context = useIncomeContext();
  const { filteredIncome, accounts, recentAccounts, categories, recentCategories, filters, searchQuery } = context;
  const selection = useSelection();
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);
  const router = useRouter();

  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      triggerHaptic(HapticPatterns.light);
      await refreshUserData();
      router.refresh();
      await new Promise(resolve => setTimeout(resolve, 300));
    },
    disabled: selection.isSelectionMode,
  });

  // Group by date (same logic as original page)
  const groupedByDate = filteredIncome.reduce(
    (acc, inc) => {
      const date = inc.receivedDate;
      if (!acc[date]) acc[date] = [];
      acc[date].push(inc);
      return acc;
    },
    {} as Record<string, typeof filteredIncome>
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

  if (filteredIncome.length === 0) {
    // Show different message when searching vs no data
    if (searchQuery.trim()) {
      return (
        <div className="space-y-4">
          <PullToRefreshIndicator
            isRefreshing={pullToRefresh.isRefreshing}
            pullDistance={pullToRefresh.pullDistance}
            label={tCommon('pullToRefresh')}
            refreshingLabel={tCommon('refreshing')}
          />
          <div className="py-12 text-center">
            <p className="text-gray-500">No income found matching &ldquo;{searchQuery}&rdquo;</p>
            <p className="mt-2 text-sm text-gray-400">Try a different search term</p>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <PullToRefreshIndicator
          isRefreshing={pullToRefresh.isRefreshing}
          pullDistance={pullToRefresh.pullDistance}
          label={tCommon('pullToRefresh')}
          refreshingLabel={tCommon('refreshing')}
        />
        <div className="py-12 text-center">
          <p className="text-gray-500">No income found for this period.</p>
          <p className="mt-2 text-sm text-gray-400">Use the + button to add income</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PullToRefreshIndicator
        isRefreshing={pullToRefresh.isRefreshing}
        pullDistance={pullToRefresh.pullDistance}
        label={tCommon('pullToRefresh')}
        refreshingLabel={tCommon('refreshing')}
      />

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
            {groupedByDate[date].map((inc) =>
              selection.isSelectionMode ? (
                <IncomeCard
                  key={inc._tempId || inc.id}
                  income={inc}
                  categories={categories}
                  accounts={accounts}
                  recentAccounts={recentAccounts}
                  recentCategories={recentCategories}
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
                  accounts={accounts}
                  recentAccounts={recentAccounts}
                  recentCategories={recentCategories}
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
