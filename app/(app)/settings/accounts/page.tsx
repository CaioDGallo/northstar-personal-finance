'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { getAccountsWithBalances, reconcileCurrentUserBalances } from '@/lib/actions/accounts';
import type { Account } from '@/lib/schema';
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
import { OnboardingTooltip } from '@/components/onboarding/onboarding-tooltip';

export default function AccountsPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const t = useTranslations('accounts');
  const tOnboarding = useTranslations('onboarding.hints');

  async function loadAccounts() {
    setIsLoading(true);
    const data = await getAccountsWithBalances();
    setAccounts(data);
    setIsLoading(false);
  }

  async function handleAccountsChanged() {
    await loadAccounts();
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAccounts();
  }, []);

  // Group accounts by type
  const creditCardAccounts = accounts.filter(acc => acc.type === 'credit_card');
  const checkingAccounts = accounts.filter(acc => acc.type === 'checking');
  const savingsAccounts = accounts.filter(acc => acc.type === 'savings');
  const cashAccounts = accounts.filter(acc => acc.type === 'cash');

  return (
    <div>
      <OnboardingTooltip hintKey="accounts" className="mb-4">
        {tOnboarding('accounts')}
      </OnboardingTooltip>
      <div className="mb-6 flex items-center flex-col md:flex-row space-y-4 md:space-y-0 justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex items-center gap-2">
          <form action={reconcileCurrentUserBalances}>
            <Button variant="popout" className='hover:text-gray-900'>{t('recalculateBalances')}</Button>
          </form>
          <AlertDialog open={addOpen} onOpenChange={setAddOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="hollow">{t('addAccount')}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent closeOnBackdropClick>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('addAccount')}</AlertDialogTitle>
              </AlertDialogHeader>
              <AccountForm
                onSuccess={async () => {
                  await handleAccountsChanged();
                  setAddOpen(false);
                }}
              />
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="space-y-8">
        {isLoading ? (
          <div className="animate-pulse space-y-6">
            {Array.from({ length: 3 }).map((_, sectionIndex) => (
              <div key={sectionIndex} className="space-y-3">
                <div className="h-4 w-40 bg-muted rounded" />
                <div className="space-y-3">
                  {Array.from({ length: 2 }).map((_, itemIndex) => (
                    <div key={itemIndex} className="h-20 bg-muted rounded-lg" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Credit Card Accounts */}
            {creditCardAccounts.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-medium text-gray-500">{t('creditCards')}</h2>
                <div className="space-y-3">
                  {creditCardAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onChange={handleAccountsChanged}
                    />
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
                    <AccountCard
                      key={account.id}
                      account={account}
                      onChange={handleAccountsChanged}
                    />
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
                    <AccountCard
                      key={account.id}
                      account={account}
                      onChange={handleAccountsChanged}
                    />
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
                    <AccountCard
                      key={account.id}
                      account={account}
                      onChange={handleAccountsChanged}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {accounts.length === 0 && (
              <p className="text-sm text-gray-500">{t('noAccountsYet')}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
