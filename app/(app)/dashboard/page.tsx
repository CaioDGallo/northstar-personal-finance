import { getTranslations } from 'next-intl/server';
import { MonthPicker } from '@/components/month-picker';
import { SummaryCard } from '@/components/summary-card';
import { BalanceSummary } from '@/components/balance-summary';
import { CashFlowReport } from '@/components/cash-flow-report';
import { BudgetProgress } from '@/components/budget-progress';
import { RecentExpenses } from '@/components/recent-expenses';
import { NetWorthSummary } from '@/components/net-worth-summary';
import { getDashboardData, getNetWorth } from '@/lib/actions/dashboard';
import { getCurrentYearMonth } from '@/lib/utils';
import Link from 'next/link';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const t = await getTranslations('dashboard');
  const { month } = await searchParams;
  const currentMonth = month || getCurrentYearMonth();
  const [data, netWorth] = await Promise.all([
    getDashboardData(currentMonth),
    getNetWorth(),
  ]);

  const hasNoBudgets = data.categoryBreakdown.length === 0;

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <MonthPicker currentMonth={currentMonth} />
      </div>

      {hasNoBudgets ? (
        <div className="rounded-none border border-gray-200 p-12 text-center">
          <h2 className="mb-2 text-xl font-semibold">{t('noBudgets')}</h2>
          <p className="mb-6 text-gray-600">
            {t('noBudgetsDescription')}
          </p>
          <Link
            href="/settings/budgets"
            className="inline-block rounded-none bg-blue-600 px-6 py-3 text-sm text-white hover:bg-blue-700"
          >
            {t('setBudgets')}
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column - Summary */}
          <div className="space-y-6">
            <BalanceSummary
              income={data.totalIncome}
              expenses={data.totalSpent}
              netBalance={data.netBalance}
            />
            <NetWorthSummary
              totalAssets={netWorth.totalAssets}
              totalLiabilities={netWorth.totalLiabilities}
              netWorth={netWorth.netWorth}
              byType={netWorth.byType}
            />
            <CashFlowReport
              income={data.totalIncome}
              expenses={data.totalSpent}
              transfersIn={data.totalTransfersIn}
              transfersOut={data.totalTransfersOut}
              net={data.cashFlowNet}
            />
            <SummaryCard spent={data.totalSpent} replenished={data.totalReplenished} budget={data.totalBudget} />
            <RecentExpenses expenses={data.recentExpenses} />
          </div>

          {/* Right column - Category breakdown */}
          <div className="lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold">{t('budgetByCategory')}</h2>
            <div className="space-y-4">
              {data.categoryBreakdown.map((category) => (
                <BudgetProgress
                  key={category.categoryId}
                  categoryName={category.categoryName}
                  categoryColor={category.categoryColor}
                  categoryIcon={category.categoryIcon}
                  spent={category.spent}
                  replenished={category.replenished}
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
