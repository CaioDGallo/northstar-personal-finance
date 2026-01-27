import { AddTransferButton } from '@/components/add-transfer-button';
import { TransferList } from '@/components/transfer-list';
import { getAccounts } from '@/lib/actions/accounts';
import { getTransfers } from '@/lib/actions/transfers';
import { getTranslations } from 'next-intl/server';
import { OnboardingTooltip } from '@/components/onboarding/onboarding-tooltip';
import { PullToRefreshWrapper } from '@/components/pull-to-refresh-wrapper';

export default async function TransfersPage() {
  const t = await getTranslations('transfers');
  const tOnboarding = await getTranslations('onboarding.hints');
  const [transfers, accounts] = await Promise.all([
    getTransfers(),
    getAccounts(),
  ]);

  return (
    <PullToRefreshWrapper>
      <div>
        <OnboardingTooltip hintKey="transfers" className="mb-4">
          {tOnboarding('transfers')}
        </OnboardingTooltip>

        <div className="mb-6 flex items-center justify-between flex-col md:flex-row space-y-4 md:space-y-0">
          <h1 className="text-2xl font-bold hidden md:flex">{t('title')}</h1>
          <div className="flex gap-2 w-full justify-end flex-col md:flex-row">
            {/* <BackfillTransfersButton /> */}
            <AddTransferButton accounts={accounts} />
          </div>
        </div>

        <TransferList transfers={transfers} accounts={accounts} />
      </div>
    </PullToRefreshWrapper>
  );
}
