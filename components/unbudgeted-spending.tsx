import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { CategoryIcon } from '@/components/icon-picker';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon } from '@hugeicons/core-free-icons';

type UnbudgetedSpendingProps = {
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  spent: number; // cents
  yearMonth: string;
};

export function UnbudgetedSpending({
  categoryName,
  categoryColor,
  categoryIcon,
  spent,
  yearMonth,
}: UnbudgetedSpendingProps) {
  const t = useTranslations('budgets');

  return (
    <Card data-slot="unbudgeted-spending">
      <CardContent className="flex items-center justify-between gap-3 p-3 md:p-4 min-w-0">
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
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium text-gray-700">
              {formatCurrency(spent)}
            </div>
          </div>
          <Link
            href={`/settings/budgets?month=${yearMonth}`}
            className="text-blue-600 hover:bg-blue-50 rounded-full p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            title={t('addBudget')}
            aria-label={t('addBudget')}
          >
            <HugeiconsIcon icon={Add01Icon} className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
