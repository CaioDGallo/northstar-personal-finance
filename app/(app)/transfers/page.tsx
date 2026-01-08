import { getTranslations } from 'next-intl/server';
import { getTransfers } from '@/lib/actions/transfers';
import { getAccounts } from '@/lib/actions/accounts';
import { TransferList } from '@/components/transfer-list';
import { AddTransferButton } from '@/components/add-transfer-button';
import { BackfillTransfersButton } from '@/components/backfill-transfers-button';

export default async function TransfersPage() {
  const t = await getTranslations('transfers');
  const [transfers, accounts] = await Promise.all([
    getTransfers(),
    getAccounts(),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-col md:flex-row space-y-4 md:space-y-0">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex gap-2 w-full justify-end">
          <BackfillTransfersButton />
          <AddTransferButton accounts={accounts} />
        </div>
      </div>

      <TransferList transfers={transfers} accounts={accounts} />
    </div>
  );
}
