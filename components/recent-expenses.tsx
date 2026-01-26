'use client';

import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CategoryIcon } from '@/components/icon-picker';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

type RecentExpensesProps = {
  expenses: {
    entryId: number;
    description: string | null;
    amount: number;
    dueDate: string;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string | null;
    accountName: string;
  }[];
};

export function RecentExpenses({ expenses }: RecentExpensesProps) {
  const t = useTranslations('recentExpenses');

  if (expenses.length === 0) {
    return (
      <Card data-slot="recent-expenses">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500">{t('noExpenses')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-slot="recent-expenses">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t('title')}</CardTitle>
          <Link
            href="/expenses"
            className="text-xs text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {t('viewAll')}
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {expenses.map((expense) => (
          <div
            key={expense.entryId}
            className="flex items-center justify-between gap-4 border-b border-gray-100 pb-3 last:border-0 min-w-0"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: expense.categoryColor }}
              >
                <span aria-hidden="true">
                  <CategoryIcon icon={expense.categoryIcon} />
                </span>
              </div>
              <div className="min-w-0">
                <div className="font-medium truncate">{expense.description}</div>
                <div className="text-xs text-gray-500 truncate">
                  {expense.categoryName} • {expense.accountName}
                </div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-semibold">{formatCurrency(expense.amount)}</div>
              <div className="text-xs text-gray-500">
                {formatDate(expense.dueDate, {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
