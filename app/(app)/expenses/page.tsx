import { getExpenses, type ExpenseFilters as ExpenseFiltersType } from '@/lib/actions/expenses';
import { getAccounts } from '@/lib/actions/accounts';
import { getCategories } from '@/lib/actions/categories';
import { getUnpaidFaturas } from '@/lib/actions/faturas';
import { getCurrentYearMonth } from '@/lib/utils';
import { ExpensesClient } from './expenses-client';

export default async function ExpensesPage({
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

  // Fetch all data in parallel
  const [expenses, accounts, categories, unpaidFaturas] = await Promise.all([
    getExpenses(filters),
    getAccounts(),
    getCategories('expense'),
    getUnpaidFaturas(),
  ]);

  return (
    <ExpensesClient
      initialExpenses={expenses}
      accounts={accounts}
      categories={categories}
      unpaidFaturas={unpaidFaturas}
      filters={filters}
      currentMonth={yearMonth}
    />
  );
}
