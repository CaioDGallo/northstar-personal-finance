'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { useTranslations } from 'next-intl';

type CashFlowReportProps = {
  income: number;
  expenses: number;
  transfersIn: number;
  transfersOut: number;
  net: number;
};

export function CashFlowReport({ income, expenses, transfersIn, transfersOut, net }: CashFlowReportProps) {
  const t = useTranslations('cashFlow');
  const netPositive = net >= 0;

  return (
    <Card data-slot="cash-flow-report">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{t('income')}</span>
          <span className="font-semibold text-green-600">+{formatCurrency(income)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{t('expenses')}</span>
          <span className="font-semibold text-red-600">-{formatCurrency(expenses)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{t('transfersIn')}</span>
          <span className="font-semibold text-green-600">+{formatCurrency(transfersIn)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">{t('transfersOut')}</span>
          <span className="font-semibold text-red-600">-{formatCurrency(transfersOut)}</span>
        </div>

        <div className="border-t pt-3 flex items-center justify-between text-sm">
          <span className="text-gray-500">{t('net')}</span>
          <span className={`font-semibold ${netPositive ? 'text-green-600' : 'text-red-600'}`}>
            {netPositive ? '+' : ''}{formatCurrency(net)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
