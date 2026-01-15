'use client';

import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useTranslations } from 'next-intl';

type NetWorthSummaryProps = {
  totalAssets: number; // cents
  totalLiabilities: number; // cents
  netWorth: number; // cents
  byType: Record<string, number>; // cents
};

export function NetWorthSummary({
  totalAssets,
  totalLiabilities,
  netWorth,
  byType,
}: NetWorthSummaryProps) {
  const t = useTranslations('netWorth');
  const isPositive = netWorth >= 0;

  return (
    <Card data-slot="net-worth-summary">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-xs text-gray-500">{t('totalAssets')}</div>
          <div className="text-3xl font-bold text-green-600">
            {formatCurrency(totalAssets)}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500">{t('totalLiabilities')}</div>
          <div className="text-2xl font-semibold text-red-600">
            {totalLiabilities > 0 ? '-' : ''}{formatCurrency(totalLiabilities)}
          </div>
        </div>

        <div className="border-t pt-4">
          <div className="text-xs text-gray-500">{t('netWorth')}</div>
          <div
            className={`text-2xl font-semibold ${
              isPositive ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {isPositive ? '+' : ''}{formatCurrency(netWorth)}
          </div>
        </div>

        {Object.entries(byType).length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <div className="text-xs text-gray-500">{t('byAccountType')}</div>
            {Object.entries(byType).map(([type, balance]) => (
              <div key={type} className="flex justify-between text-sm">
                <span className="capitalize text-gray-600">
                  {t(`accountType.${type}`)}
                </span>
                <span
                  className={`font-medium ${
                    balance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
