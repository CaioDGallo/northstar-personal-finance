import { getTranslations } from 'next-intl/server';
import { MonthPicker } from '@/components/month-picker';
import { SummaryCard } from '@/components/summary-card';
import { BudgetProgress } from '@/components/budget-progress';
import { UnbudgetedSpending } from '@/components/unbudgeted-spending';
import { CopyBudgetsButton } from '@/components/copy-budgets-button';
import { getBudgetsWithSpending } from '@/lib/actions/budgets';
import { getCurrentYearMonth } from '@/lib/utils';
import { OnboardingTooltip } from '@/components/onboarding/onboarding-tooltip';
import Link from 'next/link';

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const t = await getTranslations('budgets');
  const tOnboarding = await getTranslations('onboarding.hints');
  const { month } = await searchParams;
  const yearMonth = month || getCurrentYearMonth();
  const data = await getBudgetsWithSpending(yearMonth);

  const hasNoBudgets = data.budgets.length === 0;

  return (
    <div>
      <OnboardingTooltip hintKey="budgets" className="mb-4">
        {tOnboarding('budgets')}
      </OnboardingTooltip>

      <div className="mb-6 flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
        <h1 className="text-2xl font-bold hidden md:flex">{t('title')}</h1>
        <MonthPicker currentMonth={yearMonth} />
      </div>

      {/* Actions row */}
      <div className="mb-6 flex items-center justify-between">
        <CopyBudgetsButton currentMonth={yearMonth} />
        <Link
          href="/settings/budgets"
          className="text-sm text-blue-600 hover:underline"
        >
          {t('editBudgets')}
        </Link>
      </div>

      {hasNoBudgets ? (
        <div className="rounded-none border border-gray-200 p-12 text-center">
          <h2 className="mb-2 text-xl font-semibold">{t('noBudgets')}</h2>
          <p className="mb-6 text-gray-600">
            {t('copyFrom')}
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/settings/budgets"
              className="inline-block rounded-none bg-blue-600 px-6 py-3 text-sm text-white hover:bg-blue-700"
            >
              {t('setBudgets')}
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Card */}
          <SummaryCard spent={data.totalSpent} replenished={data.totalReplenished} budget={data.totalBudget} />

          {/* Budget Progress List */}
          <div>
            <h2 className="mb-4 text-lg font-semibold">{t('budgetByCategory')}</h2>
            <div className="space-y-4">
              {data.budgets.map((budget) => (
                <BudgetProgress
                  key={budget.categoryId}
                  categoryName={budget.categoryName}
                  categoryColor={budget.categoryColor}
                  categoryIcon={budget.categoryIcon}
                  spent={budget.spent}
                  replenished={budget.replenished}
                  budget={budget.budget}
                />
              ))}
            </div>
          </div>

          {/* Unbudgeted Spending Section */}
          {data.unbudgeted.length > 0 && (
            <div>
              <h2 className="mb-4 text-lg font-semibold text-gray-600">
                {t('expensesWithoutBudget')}
              </h2>
              <div className="space-y-4">
                {data.unbudgeted.map((item) => (
                  <UnbudgetedSpending
                    key={item.categoryId}
                    categoryName={item.categoryName}
                    categoryColor={item.categoryColor}
                    categoryIcon={item.categoryIcon}
                    spent={item.spent}
                    yearMonth={yearMonth}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
