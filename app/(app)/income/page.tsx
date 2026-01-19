import { getIncome, type IncomeFilters as IncomeFiltersType } from '@/lib/actions/income';
import { getAccounts } from '@/lib/actions/accounts';
import { getCategories } from '@/lib/actions/categories';
import { getCurrentYearMonth } from '@/lib/utils';
import { IncomeClient } from './income-client';

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; category?: string; account?: string; status?: string }>
}) {
  const params = await searchParams;
  const yearMonth = params.month || getCurrentYearMonth();

  // Build filters from URL params
  const filters: IncomeFiltersType = {
    yearMonth,
    categoryId: params.category ? parseInt(params.category) : undefined,
    accountId: params.account ? parseInt(params.account) : undefined,
    status: (params.status as 'all' | 'received' | 'pending') || 'all',
  };

  // Fetch all data in parallel
  const [income, accounts, categories] = await Promise.all([
    getIncome(filters),
    getAccounts(),
    getCategories('income'),
  ]);

  return (
    <IncomeClient
      initialIncome={income}
      accounts={accounts}
      categories={categories}
      filters={filters}
      currentMonth={yearMonth}
    />
  );
}
