'use client';

import { useTranslations } from 'next-intl';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { CategoryIcon } from '@/components/icon-picker';

type BudgetProgressProps = {
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  spent: number; // cents
  replenished: number; // cents
  budget: number; // cents
};

export function BudgetProgress({
  categoryName,
  categoryColor,
  categoryIcon,
  spent,
  replenished,
  budget,
}: BudgetProgressProps) {
  const t = useTranslations('budgets');
  const netSpent = spent - replenished;
  const percentage = budget > 0 ? (netSpent / budget) * 100 : 0;
  const isOverBudget = percentage > 100;
  const isWarning = percentage >= 80 && percentage <= 100;

  const barColor = isOverBudget
    ? 'bg-red-600'
    : isWarning
      ? 'bg-yellow-600'
      : 'bg-green-600';

  const textColor = isOverBudget
    ? 'text-red-700'
    : isWarning
      ? 'text-yellow-700'
      : 'text-green-700';

  return (
    <Card data-slot="budget-progress">
      <CardContent className="flex flex-col gap-2 md:gap-3 p-3 md:p-4">
        <div className="flex items-center justify-between gap-4 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex size-10 md:size-12 shrink-0 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: categoryColor }}
            >
              <span aria-hidden="true">
                <CategoryIcon icon={categoryIcon} />
              </span>
            </div>
            <span className="font-medium truncate">{categoryName}</span>
          </div>
          <div className="text-right shrink-0">
            <div className={`text-sm font-medium ${textColor}`}>
              {formatCurrency(netSpent)} / {formatCurrency(budget)}
            </div>
            {replenished > 0 && (
              <div className="text-xs text-gray-500">
                {t('spent')}: {formatCurrency(spent)} • {t('replenished')}: -{formatCurrency(replenished)}
              </div>
            )}
            <div className="text-xs text-gray-500">{percentage.toFixed(0)}%</div>
          </div>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-[width] duration-300 motion-reduce:transition-none ${barColor}`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
