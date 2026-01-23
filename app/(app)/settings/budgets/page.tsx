import { getTranslations } from 'next-intl/server';
import { getBudgetsForMonth, getMonthlyBudget } from '@/lib/actions/budgets';
import { BudgetForm } from '@/components/budget-form';
import { MonthPicker } from '@/components/month-picker';
import { getCurrentYearMonth } from '@/lib/utils';
import { OnboardingTooltip } from '@/components/onboarding/onboarding-tooltip';

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const t = await getTranslations('budgets');
  const tOnboarding = await getTranslations('onboarding.hints');
  const { month } = await searchParams;
  const yearMonth = month || getCurrentYearMonth();

  const [budgets, monthlyBudget] = await Promise.all([
    getBudgetsForMonth(yearMonth),
    getMonthlyBudget(yearMonth),
  ]);

  return (
    <div>
      <OnboardingTooltip hintKey="budgetsSettings" className="mb-4">
        {tOnboarding('budgetsSettings')}
      </OnboardingTooltip>
      <div className="mb-6 flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <MonthPicker currentMonth={yearMonth} />
      </div>

      <BudgetForm yearMonth={yearMonth} budgets={budgets} monthlyBudget={monthlyBudget} />
    </div>
  );
}
