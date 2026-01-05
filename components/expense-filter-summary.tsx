'use client';

import { useSearchParams } from 'next/navigation';
import { useExpenseContext } from '@/lib/contexts/expense-context';
import { formatCurrency } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export function ExpenseFilterSummary() {
  const { expenses } = useExpenseContext();
  const searchParams = useSearchParams();
  const t = useTranslations('filters');

  // Check if any filter (besides month) is active
  const hasActiveFilters =
    searchParams.has('category') ||
    searchParams.has('account') ||
    (searchParams.has('status') && searchParams.get('status') !== 'all');

  if (!hasActiveFilters) return null;

  const count = expenses.length;
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="mb-4 text-sm text-muted-foreground">
      {t('summaryCount', { count })} • {formatCurrency(total)}
    </div>
  );
}
