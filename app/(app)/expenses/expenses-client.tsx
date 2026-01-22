'use client';

import { useState, useEffect } from 'react';
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
import type { RecentAccount } from '@/lib/actions/accounts';
import type { RecentCategory } from '@/lib/actions/categories';

type ExpensesClientProps = {
  initialExpenses: ExpenseEntry[];
  accounts: Account[];
  recentAccounts: RecentAccount[];
  categories: Category[];
  recentCategories: RecentCategory[];
  unpaidFaturas: UnpaidFatura[];
  filters: ExpenseFiltersType;
  currentMonth: string;
};

export function ExpensesClient({
  initialExpenses,
  accounts,
  recentAccounts,
  categories,
  recentCategories,
  unpaidFaturas,
  filters,
  currentMonth,
}: ExpensesClientProps) {
  const t = useTranslations('expenses');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize from URL and sync on navigation
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(() => searchParams.get('add') === 'true');

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

  const handleAddExpenseChange = (open: boolean) => {
    setIsAddExpenseOpen(open);

    // Remove 'add' param when closing
    if (!open && searchParams.get('add') === 'true') {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('add');
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  // Clean up URL after dialog opens from deep link
  useEffect(() => {
    if (isAddExpenseOpen && searchParams.get('add') === 'true') {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('add');
      const newUrl = params.toString() ? `${pathname}?${params}` : pathname;
      router.replace(newUrl);
    }
  }, [isAddExpenseOpen, searchParams, pathname, router]);

  const categoryFilter = filters.categoryId?.toString() || 'all';
  const accountFilter = filters.accountId?.toString() || 'all';
  const statusFilter = filters.status || 'all';

  return (
    <div>
      <div className="mb-3 flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
        <h1 className="text-2xl font-bold hidden md:flex">{t('title')}</h1>
        <MonthPicker currentMonth={currentMonth} />
      </div>

      <div className="mb-3 flex gap-2 justify-end">
        <ImportModal accounts={accounts} categories={categories} />
        <AddExpenseButton
          accounts={accounts}
          categories={categories}
          recentAccounts={recentAccounts}
          recentCategories={recentCategories}
          open={isAddExpenseOpen}
          onOpenChange={handleAddExpenseChange}
        />
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
