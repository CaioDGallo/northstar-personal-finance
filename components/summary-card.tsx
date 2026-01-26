'use client';

import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';

type SummaryCardProps = {
  spent: number; // cents
  replenished: number; // cents
  budget: number; // cents
};

export function SummaryCard({ spent, replenished, budget }: SummaryCardProps) {
  const t = useTranslations('summary');
  const tBudgets = useTranslations('budgets');
  const netSpent = spent - replenished;
  const percentage = budget > 0 ? (netSpent / budget) * 100 : 0;
  const remaining = budget - netSpent;
  const noBudget = budget === 0;
  const isOverBudget = !noBudget && remaining < 0;

  return (
    <Card data-slot="summary-card">
      <CardHeader>
        <CardTitle>{t('monthlySummary')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-xs text-gray-500">{t('totalSpent')}</div>
          <div className="text-3xl font-bold">{formatCurrency(netSpent)}</div>
          {replenished > 0 && (
            <div className="text-xs text-gray-500 mt-1">
              {tBudgets('spent')}: {formatCurrency(spent)} • {tBudgets('replenished')}: -{formatCurrency(replenished)}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs text-gray-500">{t('totalBudget')}</div>
          <div className="text-2xl font-semibold text-gray-700">
            {formatCurrency(budget)}
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="text-xs text-gray-500">
            {noBudget ? t('unbudgeted') : isOverBudget ? t('overBudget') : t('remaining')}
          </div>
          <div
            className={`text-2xl font-semibold ${
              noBudget ? 'text-gray-600' : isOverBudget ? 'text-red-600' : 'text-green-600'
            }`}
          >
            {formatCurrency(Math.abs(remaining))}
          </div>
        </div>

        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-[width] duration-300 motion-reduce:transition-none ${
              isOverBudget
                ? 'bg-red-500'
                : percentage >= 80
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <div className="text-center text-xs text-gray-500">
          {percentage.toFixed(1)}% {t('budgetUsed')}
        </div>
      </CardContent>
    </Card>
  );
}
