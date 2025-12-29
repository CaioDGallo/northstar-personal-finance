import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { CategoryIcon } from '@/components/icon-picker';

type BudgetProgressProps = {
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  spent: number; // cents
  budget: number; // cents
};

export function BudgetProgress({
  categoryName,
  categoryColor,
  categoryIcon,
  spent,
  budget,
}: BudgetProgressProps) {
  const percentage = budget > 0 ? (spent / budget) * 100 : 0;
  const isOverBudget = percentage > 100;
  const isWarning = percentage >= 80 && percentage <= 100;

  const barColor = isOverBudget
    ? 'bg-red-500'
    : isWarning
    ? 'bg-yellow-500'
    : 'bg-green-500';

  const textColor = isOverBudget
    ? 'text-red-700'
    : isWarning
    ? 'text-yellow-700'
    : 'text-green-700';

  return (
    <Card data-slot="budget-progress">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex size-12 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: categoryColor }}
            >
              <CategoryIcon icon={categoryIcon} />
            </div>
            <span className="font-medium">{categoryName}</span>
          </div>
          <div className="text-right">
            <div className={`text-sm font-medium ${textColor}`}>
              {formatCurrency(spent)} / {formatCurrency(budget)}
            </div>
            <div className="text-xs text-gray-500">{percentage.toFixed(0)}%</div>
          </div>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all ${barColor}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
