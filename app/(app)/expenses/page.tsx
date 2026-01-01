import { getTranslations } from 'next-intl/server';
import { getExpenses, type ExpenseFilters as ExpenseFiltersType } from '@/lib/actions/expenses';
import { getAccounts } from '@/lib/actions/accounts';
import { getCategories } from '@/lib/actions/categories';
import { ExpenseList, ExpenseListProvider } from '@/components/expense-list';
import { ExpenseFilters } from '@/components/expense-filters';
import { ImportModal } from '@/components/import-expenses/import-modal';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Upload02Icon } from '@hugeicons/core-free-icons';
import { getCurrentYearMonth } from '@/lib/utils';

type PageProps = {
  searchParams: Promise<{
    month?: string;
    category?: string;
    account?: string;
    status?: 'pending' | 'paid' | 'all';
  }>;
};

export default async function ExpensesPage({ searchParams }: PageProps) {
  const t = await getTranslations('expenses');
  const params = await searchParams;
  const currentMonth = params.month || getCurrentYearMonth();

  const filters: ExpenseFiltersType = {
    yearMonth: currentMonth,
    categoryId: params.category ? parseInt(params.category) : undefined,
    accountId: params.account ? parseInt(params.account) : undefined,
    status: params.status || 'all',
  };

  const [expenses, accounts, categories] = await Promise.all([
    getExpenses(filters),
    getAccounts(),
    getCategories('expense'),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <ImportModal
          accounts={accounts}
          categories={categories}
          trigger={
            <Button variant="hollow" size="sm">
              <HugeiconsIcon icon={Upload02Icon} className="mr-2 size-4" />
              {t('import')}
            </Button>
          }
        />
      </div>

      <ExpenseFilters
        accounts={accounts}
        categories={categories}
        currentMonth={currentMonth}
      />

      <ExpenseListProvider
        initialExpenses={expenses}
        accounts={accounts}
        categories={categories}
        filters={filters}
      >
        <ExpenseList />
      </ExpenseListProvider>
    </div>
  );
}
