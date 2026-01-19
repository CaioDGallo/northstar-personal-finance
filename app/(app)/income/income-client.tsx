'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { IncomeFilters as IncomeFiltersType } from '@/lib/actions/income';
import { MonthPicker } from '@/components/month-picker';
import { IncomeList, IncomeListProvider } from '@/components/income-list';
import { IncomeFiltersWrapper } from '@/components/income-filters-wrapper';
import { IncomeFilterSummary } from '@/components/income-filter-summary';
import { ImportModal } from '@/components/import/import-modal';
import { AddIncomeButton } from '@/components/add-income-button';
import type { Account, Category } from '@/lib/schema';
import type { IncomeEntry } from '@/lib/contexts/income-context';

type IncomeClientProps = {
  initialIncome: IncomeEntry[];
  accounts: Account[];
  categories: Category[];
  filters: IncomeFiltersType;
  currentMonth: string;
};

export function IncomeClient({
  initialIncome,
  accounts,
  categories,
  filters,
  currentMonth,
}: IncomeClientProps) {
  const t = useTranslations('income');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filter change handlers update URL
  const handleCategoryChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('category');
    } else {
      params.set('category', value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleAccountChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('account');
    } else {
      params.set('account', value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleStatusChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'all') {
      params.delete('status');
    } else {
      params.set('status', value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const categoryFilter = filters.categoryId?.toString() || 'all';
  const accountFilter = filters.accountId?.toString() || 'all';
  const statusFilter = filters.status || 'all';

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <MonthPicker currentMonth={currentMonth} />
      </div>

      <div className="mb-6 flex gap-2 justify-end">
        <ImportModal accounts={accounts} categories={categories} />
        <AddIncomeButton accounts={accounts} categories={categories} />
      </div>

      <IncomeListProvider
        initialIncome={initialIncome}
        accounts={accounts}
        categories={categories}
        filters={filters}
      >
        <IncomeFiltersWrapper
          accounts={accounts}
          categories={categories}
          categoryFilter={categoryFilter}
          accountFilter={accountFilter}
          statusFilter={statusFilter}
          onCategoryChange={handleCategoryChange}
          onAccountChange={handleAccountChange}
          onStatusChange={handleStatusChange}
          currentMonth={currentMonth}
        />
        <IncomeFilterSummary />
        <IncomeList />
      </IncomeListProvider>
    </div>
  );
}
