import { getExpenses, type ExpenseFilters as ExpenseFiltersType } from '@/lib/actions/expenses';
import { getAccounts } from '@/lib/actions/accounts';
import { getCategories } from '@/lib/actions/categories';
import { ExpenseCard } from '@/components/expense-card';
import { ExpenseFilters } from '@/components/expense-filters';
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
    getCategories(),
  ]);

  // Group entries by date
  const groupedByDate = expenses.reduce(
    (acc, expense) => {
      const date = expense.dueDate;
      if (!acc[date]) acc[date] = [];
      acc[date].push(expense);
      return acc;
    },
    {} as Record<string, typeof expenses>
  );

  const dates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Expenses</h1>
      </div>

      <ExpenseFilters
        accounts={accounts}
        categories={categories}
        currentMonth={currentMonth}
      />

      {expenses.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-gray-500">No expenses found for this period.</p>
          <p className="mt-2 text-sm text-gray-400">
            Use the + button to add an expense
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {dates.map((date) => (
            <div key={date}>
              <h2 className="mb-3 text-sm font-medium text-gray-500">
                {new Date(date).toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </h2>
              <div className="space-y-3">
                {groupedByDate[date].map((expense) => (
                  <ExpenseCard key={expense.id} entry={expense} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
