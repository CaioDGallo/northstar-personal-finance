import { getTranslations } from 'next-intl/server';
import { getAccountsWithBalances, reconcileCurrentUserBalances } from '@/lib/actions/accounts';
import { AccountForm } from '@/components/account-form';
import { AccountCard } from '@/components/account-card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default async function AccountsPage() {
  const t = await getTranslations('accounts');
  const accounts = await getAccountsWithBalances();

  // Group accounts by type
  const creditCardAccounts = accounts.filter(acc => acc.type === 'credit_card');
  const checkingAccounts = accounts.filter(acc => acc.type === 'checking');
  const savingsAccounts = accounts.filter(acc => acc.type === 'savings');
  const cashAccounts = accounts.filter(acc => acc.type === 'cash');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <form action={reconcileCurrentUserBalances}>
            <Button variant="outline">{t('recalculateBalances')}</Button>
          </form>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="hollow">{t('addAccount')}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent closeOnBackdropClick>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('addAccount')}</AlertDialogTitle>
              </AlertDialogHeader>
              <AccountForm />
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="space-y-8">
        {/* Credit Card Accounts */}
        {creditCardAccounts.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-medium text-gray-500">{t('creditCards')}</h2>
            <div className="space-y-3">
              {creditCardAccounts.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
            </div>
          </div>
        )}

        {/* Checking Accounts */}
        {checkingAccounts.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-medium text-gray-500">{t('checkingAccounts')}</h2>
            <div className="space-y-3">
              {checkingAccounts.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
            </div>
          </div>
        )}

        {/* Savings Accounts */}
        {savingsAccounts.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-medium text-gray-500">{t('savingsAccounts')}</h2>
            <div className="space-y-3">
              {savingsAccounts.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
            </div>
          </div>
        )}

        {/* Cash Accounts */}
        {cashAccounts.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-medium text-gray-500">{t('cash')}</h2>
            <div className="space-y-3">
              {cashAccounts.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {accounts.length === 0 && (
          <p className="text-sm text-gray-500">{t('noAccountsYet')}</p>
        )}
      </div>
    </div>
  );
}
