import { getExpenses, type ExpenseFilters as ExpenseFiltersType } from '@/lib/actions/expenses';
import { getAccounts, getRecentAccounts } from '@/lib/actions/accounts';
import { getCategories, getRecentCategories } from '@/lib/actions/categories';
import { getUnpaidFaturas } from '@/lib/actions/faturas';
import { getCurrentYearMonth } from '@/lib/utils';
import { ExpensesClient } from '../../expenses/expenses-client';

export default async function QuickAddExpense({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; category?: string; account?: string; status?: string }>
}) {
  const params = await searchParams;
  const yearMonth = params.month || getCurrentYearMonth();

  // Build filters from URL params
  const filters: ExpenseFiltersType = {
    yearMonth,
    categoryId: params.category ? parseInt(params.category) : undefined,
    accountId: params.account ? parseInt(params.account) : undefined,
    status: (params.status as 'all' | 'paid' | 'pending') || 'all',
  };

  // Fetch all data in parallel (same as expenses page)
  const [expenses, accounts, recentAccounts, categories, recentCategories, unpaidFaturas] = await Promise.all([
    getExpenses(filters),
    getAccounts(),
    getRecentAccounts(),
    getCategories('expense'),
    getRecentCategories('expense'),
    getUnpaidFaturas(),
  ]);

  return (
    <ExpensesClient
      initialExpenses={expenses}
      accounts={accounts}
      recentAccounts={recentAccounts}
      categories={categories}
      recentCategories={recentCategories}
      unpaidFaturas={unpaidFaturas}
      filters={filters}
      currentMonth={yearMonth}
      initialDialogOpen={true}
    />
  );
}
