import { getDashboardData } from '@/lib/actions/dashboard';
import { getCurrentYearMonth } from '@/lib/utils';
import { MonthPicker } from '@/components/month-picker';
import { SummaryCard } from '@/components/summary-card';
import { BudgetProgress } from '@/components/budget-progress';
import { RecentExpenses } from '@/components/recent-expenses';
import Link from 'next/link';

type PageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const yearMonth = params.month || getCurrentYearMonth();
  const data = await getDashboardData(yearMonth);

  const hasNoBudgets = data.categoryBreakdown.length === 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <MonthPicker currentMonth={yearMonth} />
      </div>

      {hasNoBudgets ? (
        <div className="rounded-none border border-gray-200 p-12 text-center">
          <h2 className="mb-2 text-xl font-semibold">No budgets set for this month</h2>
          <p className="mb-6 text-gray-600">
            Set up your monthly budgets to start tracking your spending.
          </p>
          <Link
            href="/settings/budgets"
            className="inline-block rounded-none bg-blue-600 px-6 py-3 text-sm text-white hover:bg-blue-700"
          >
            Set Budgets
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column - Summary */}
          <div className="space-y-6">
            <SummaryCard spent={data.totalSpent} budget={data.totalBudget} />
            <RecentExpenses expenses={data.recentExpenses} />
          </div>

          {/* Right column - Category breakdown */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold">Budget by Category</h2>
            <div className="space-y-4">
              {data.categoryBreakdown.map((category) => (
                <BudgetProgress
                  key={category.categoryId}
                  categoryName={category.categoryName}
                  categoryColor={category.categoryColor}
                  categoryIcon={category.categoryIcon}
                  spent={category.spent}
                  budget={category.budget}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
