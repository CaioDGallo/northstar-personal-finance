import { getTranslations } from 'next-intl/server';
import { getIncome, type IncomeFilters as IncomeFiltersType } from '@/lib/actions/income';
import { getAccounts } from '@/lib/actions/accounts';
import { getCategories } from '@/lib/actions/categories';
import { IncomeList, IncomeListProvider } from '@/components/income-list';
import { IncomeFilters } from '@/components/income-filters';
import { getCurrentYearMonth } from '@/lib/utils';

type PageProps = {
  searchParams: Promise<{
    month?: string;
    category?: string;
    account?: string;
    status?: 'pending' | 'received' | 'all';
  }>;
};

export default async function IncomePage({ searchParams }: PageProps) {
  const t = await getTranslations('income');
  const params = await searchParams;
  const currentMonth = params.month || getCurrentYearMonth();

  const filters: IncomeFiltersType = {
    yearMonth: currentMonth,
    categoryId: params.category ? parseInt(params.category) : undefined,
    accountId: params.account ? parseInt(params.account) : undefined,
    status: params.status || 'all',
  };

  const [income, accounts, categories] = await Promise.all([
    getIncome(filters),
    getAccounts(),
    getCategories('income'),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      <IncomeFilters
        accounts={accounts}
        categories={categories}
        currentMonth={currentMonth}
      />

      <IncomeListProvider
        initialIncome={income}
        accounts={accounts}
        categories={categories}
        filters={filters}
      >
        <IncomeList />
      </IncomeListProvider>
    </div>
  );
}
