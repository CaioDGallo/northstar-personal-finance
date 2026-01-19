'use client';

import { useIncomeContext } from '@/lib/contexts/income-context';
import { TransactionFilters } from '@/components/transaction-filters';
import type { Account, Category } from '@/lib/schema';

type IncomeFiltersWrapperProps = {
  accounts: Account[];
  categories: Category[];
  categoryFilter: string;
  accountFilter: string;
  statusFilter: string;
  onCategoryChange: (value: string) => void;
  onAccountChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  currentMonth: string;
};

export function IncomeFiltersWrapper({
  accounts,
  categories,
  categoryFilter,
  accountFilter,
  statusFilter,
  onCategoryChange,
  onAccountChange,
  onStatusChange,
  currentMonth,
}: IncomeFiltersWrapperProps) {
  const { setSearchQuery } = useIncomeContext();

  return (
    <TransactionFilters
      variant="income"
      accounts={accounts}
      categories={categories}
      setSearchQuery={setSearchQuery}
      categoryFilter={categoryFilter}
      accountFilter={accountFilter}
      statusFilter={statusFilter}
      onCategoryChange={onCategoryChange}
      onAccountChange={onAccountChange}
      onStatusChange={onStatusChange}
      currentMonth={currentMonth}
    />
  );
}
