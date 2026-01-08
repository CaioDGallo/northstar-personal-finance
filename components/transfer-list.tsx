'use client';

import { useTranslations } from 'next-intl';
import { TransferCard, type TransferListItem } from '@/components/transfer-card';
import type { Account } from '@/lib/schema';

type TransferListProps = {
  transfers: TransferListItem[];
  accounts: Account[];
};

export function TransferList({ transfers, accounts }: TransferListProps) {
  const t = useTranslations('transfers');

  if (transfers.length === 0) {
    return (
      <div className="rounded-none border border-gray-200 p-12 text-center">
        <p className="text-gray-500">{t('noTransfers')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transfers.map((transfer) => (
        <TransferCard key={transfer.id} transfer={transfer} accounts={accounts} />
      ))}
    </div>
  );
}
