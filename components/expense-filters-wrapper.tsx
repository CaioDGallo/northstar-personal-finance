'use client';

import { useExpenseContext } from '@/lib/contexts/expense-context';
import { TransactionFilters } from '@/components/transaction-filters';
import type { Account, Category } from '@/lib/schema';

type ExpenseFiltersWrapperProps = {
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

export function ExpenseFiltersWrapper({
  accounts,
  categories,
  categoryFilter,
  accountFilter,
  statusFilter,
  onCategoryChange,
  onAccountChange,
  onStatusChange,
  currentMonth,
}: ExpenseFiltersWrapperProps) {
  const { setSearchQuery } = useExpenseContext();

  return (
    <TransactionFilters
      variant="expense"
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
