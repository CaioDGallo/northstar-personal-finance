import { getTranslations } from 'next-intl/server';
import { getAccounts } from '@/lib/actions/accounts';
import { getFaturasByMonth } from '@/lib/actions/faturas';
import { getCurrentYearMonth } from '@/lib/utils';
import { MonthPicker } from '@/components/month-picker';
import { FaturaList } from '@/components/fatura-list';

export default async function FaturasPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const t = await getTranslations('faturas');
  const { month } = await searchParams;

  // Faturas page defaults to next month if no month specified
  const yearMonth = month || getCurrentYearMonth(true);

  const [faturas, accounts] = await Promise.all([
    getFaturasByMonth(yearMonth),
    getAccounts(),
  ]);

  const checkingAccounts = accounts.filter(a => a.type !== 'credit_card');

  return (
    <div>
      <div className="mb-6 flex flex-col md:flex-row space-y-4 md:space-y-0 items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <MonthPicker currentMonth={yearMonth} />
      </div>

      <FaturaList
        faturas={faturas}
        checkingAccounts={checkingAccounts}
      />
    </div>
  );
}
