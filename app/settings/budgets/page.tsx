import { getBudgetsForMonth } from '@/lib/actions/budgets';
import { BudgetForm } from '@/components/budget-form';
import { MonthPicker } from '@/components/month-picker';
import { getCurrentYearMonth } from '@/lib/utils';

type PageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function BudgetsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const yearMonth = params.month || getCurrentYearMonth();
  const budgets = await getBudgetsForMonth(yearMonth);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Budgets</h1>
        <MonthPicker currentMonth={yearMonth} />
      </div>

      <BudgetForm yearMonth={yearMonth} budgets={budgets} />
    </div>
  );
}
