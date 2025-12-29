import { getBudgetsWithSpending } from '@/lib/actions/budgets';
import { getCurrentYearMonth } from '@/lib/utils';
import { MonthPicker } from '@/components/month-picker';
import { SummaryCard } from '@/components/summary-card';
import { BudgetProgress } from '@/components/budget-progress';
import { CopyBudgetsButton } from '@/components/copy-budgets-button';
import Link from 'next/link';

type PageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function BudgetsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const yearMonth = params.month || getCurrentYearMonth();
  const data = await getBudgetsWithSpending(yearMonth);

  const hasNoBudgets = data.budgets.length === 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <MonthPicker currentMonth={yearMonth} />
      </div>

      {/* Actions row */}
      <div className="mb-6 flex items-center justify-between">
        <CopyBudgetsButton currentMonth={yearMonth} />
        <Link
          href={`/settings/budgets?month=${yearMonth}`}
          className="text-sm text-blue-600 hover:underline"
        >
          Edit Budgets
        </Link>
      </div>

      {hasNoBudgets ? (
        <div className="rounded-none border border-gray-200 p-12 text-center">
          <h2 className="mb-2 text-xl font-semibold">No budgets set for this month</h2>
          <p className="mb-6 text-gray-600">
            Copy budgets from last month or set up new budgets to start tracking your spending.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href={`/settings/budgets?month=${yearMonth}`}
              className="inline-block rounded-none bg-blue-600 px-6 py-3 text-sm text-white hover:bg-blue-700"
            >
              Set Budgets
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Card */}
          <SummaryCard spent={data.totalSpent} budget={data.totalBudget} />

          {/* Budget Progress List */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">Budget by Category</h2>
            <div className="space-y-4">
              {data.budgets.map((budget) => (
                <BudgetProgress
                  key={budget.categoryId}
                  categoryName={budget.categoryName}
                  categoryColor={budget.categoryColor}
                  categoryIcon={budget.categoryIcon}
                  spent={budget.spent}
                  budget={budget.budget}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
