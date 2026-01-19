'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ExpenseFilters as ExpenseFiltersType } from '@/lib/actions/expenses';
import { MonthPicker } from '@/components/month-picker';
import { ExpenseList, ExpenseListProvider } from '@/components/expense-list';
import { ExpenseFiltersWrapper } from '@/components/expense-filters-wrapper';
import { ExpenseFilterSummary } from '@/components/expense-filter-summary';
import { ImportModal } from '@/components/import/import-modal';
import { AddExpenseButton } from '@/components/add-expense-button';
import type { Account, Category } from '@/lib/schema';
import type { UnpaidFatura } from '@/lib/actions/faturas';
import type { ExpenseEntry } from '@/lib/contexts/expense-context';

type ExpensesClientProps = {
  initialExpenses: ExpenseEntry[];
  accounts: Account[];
  categories: Category[];
  unpaidFaturas: UnpaidFatura[];
  filters: ExpenseFiltersType;
  currentMonth: string;
};

export function ExpensesClient({
  initialExpenses,
  accounts,
  categories,
  unpaidFaturas,
  filters,
  currentMonth,
}: ExpensesClientProps) {
  const t = useTranslations('expenses');
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
        <AddExpenseButton accounts={accounts} categories={categories} />
      </div>

      <ExpenseListProvider
        initialExpenses={initialExpenses}
        accounts={accounts}
        categories={categories}
        filters={filters}
        unpaidFaturas={unpaidFaturas}
      >
        <ExpenseFiltersWrapper
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
        <ExpenseFilterSummary />
        <ExpenseList />
      </ExpenseListProvider>
    </div>
  );
}
