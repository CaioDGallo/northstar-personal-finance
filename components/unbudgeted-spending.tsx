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
      <CardContent className="flex items-center justify-between gap-3 p-3 md:p-4">
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 md:size-12 shrink-0 items-center justify-center rounded-full text-white"
            style={{ backgroundColor: categoryColor }}
          >
            <CategoryIcon icon={categoryIcon} />
          </div>
          <span className="font-medium">{categoryName}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium text-gray-700">
              {formatCurrency(spent)}
            </div>
          </div>
          <Link
            href={`/settings/budgets?month=${yearMonth}`}
            className="text-blue-600 hover:bg-blue-50 rounded-full p-1.5 transition-colors"
            title={t('addBudget')}
          >
            <HugeiconsIcon icon={Add01Icon} className="size-5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
