'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import type { Account } from '@/lib/schema';
import type { RecentAccount } from '@/lib/actions/accounts';
import { accountTypeConfig } from '@/lib/account-type-config';
import { BankLogo } from '@/components/bank-logo';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const RECENT_LIMIT = 3;

type AccountPickerProps = {
  accounts: Account[];
  recentAccounts: RecentAccount[];
  value: number;
  onChange: (value: number) => void;
  triggerId?: string;
};

function resolveAccountOptions(accounts: Account[]) {
  return accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    bankLogo: account.bankLogo ?? null,
  }));
}

export function AccountPicker({
  accounts,
  recentAccounts,
  value,
  onChange,
  triggerId,
}: AccountPickerProps) {
  const t = useTranslations('form');
  const [open, setOpen] = useState(false);
  const accountOptions = useMemo(() => resolveAccountOptions(accounts), [accounts]);
  const selectedAccount = accountOptions.find((account) => account.id === value) || null;

  const recentOptions = useMemo(() => {
    if (recentAccounts.length === 0) return [];
    const used = new Set<number>();

    return recentAccounts
      .filter((account) => accounts.some((item) => item.id === account.id))
      .filter((account) => {
        if (used.has(account.id)) return false;
        used.add(account.id);
        return true;
      })
      .slice(0, RECENT_LIMIT)
      .map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        bankLogo: account.bankLogo ?? null,
      }));
  }, [accounts, recentAccounts]);

  const handleSelect = (accountId: number) => {
    onChange(accountId);
    setOpen(false);
  };

  return (
    <>
      <button
        id={triggerId}
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2',
          'text-sm ring-offset-background transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'w-full'
        )}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedAccount ? (
            <>
              <AccountIconTrigger type={selectedAccount.type} bankLogo={selectedAccount.bankLogo} />
              <span className="truncate">{selectedAccount.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{t('selectAccount')}</span>
          )}
        </div>
        <HugeiconsIcon icon={ArrowDown01Icon} className="size-4 opacity-50 shrink-0" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] flex flex-col">
          <SheetHeader>
            <SheetTitle>{t('selectAccount')}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {recentOptions.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-muted-foreground px-4 py-2">
                  {t('recent')}
                </h3>
                <div className="flex flex-col">
                  {recentOptions.map((account) => {
                    const isSelected = account.id === value;
                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => handleSelect(account.id)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 transition-all',
                          'hover:bg-muted touch-manipulation',
                          isSelected && 'bg-muted'
                        )}
                      >
                        <AccountIcon type={account.type} bankLogo={account.bankLogo} />
                        <span className="flex-1 text-left text-sm">
                          {account.name}
                        </span>
                        {isSelected && (
                          <HugeiconsIcon
                            icon={Tick02Icon}
                            className="size-5 text-primary shrink-0"
                            strokeWidth={2}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-muted-foreground px-4 py-2">
                {t('all')}
              </h3>
              <div className="flex flex-col">
                {accountOptions.length > 0 ? (
                  accountOptions.map((account) => {
                    const isSelected = account.id === value;
                    return (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => handleSelect(account.id)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 transition-all',
                          'hover:bg-muted touch-manipulation',
                          isSelected && 'bg-muted'
                        )}
                      >
                        <AccountIcon type={account.type} bankLogo={account.bankLogo} />
                        <span className="flex-1 text-left text-sm">
                          {account.name}
                        </span>
                        {isSelected && (
                          <HugeiconsIcon
                            icon={Tick02Icon}
                            className="size-5 text-primary shrink-0"
                            strokeWidth={2}
                          />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {t('noAccountsFound')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function AccountIcon({ type, bankLogo }: { type: Account['type']; bankLogo: string | null }) {
  if (bankLogo) {
    return (
      <div className="size-10 rounded-full flex items-center justify-center bg-white p-1">
        <BankLogo logo={bankLogo} size={32} />
      </div>
    );
  }

  const config = accountTypeConfig[type];

  return (
    <div
      className="size-10 rounded-full flex items-center justify-center"
      style={{ backgroundColor: config.color }}
    >
      <HugeiconsIcon icon={config.icon} size={20} className="text-white" strokeWidth={2} />
    </div>
  );
}

function AccountIconTrigger({ type, bankLogo }: { type: Account['type']; bankLogo: string | null }) {
  if (bankLogo) {
    return (
      <div className="size-5 rounded-full flex items-center justify-center bg-white p-0.5">
        <BankLogo logo={bankLogo} size={16} />
      </div>
    );
  }

  const config = accountTypeConfig[type];

  return (
    <div
      className="size-5 rounded-full flex items-center justify-center"
      style={{ backgroundColor: config.color }}
    >
      <HugeiconsIcon icon={config.icon} size={12} className="text-white" strokeWidth={2} />
    </div>
  );
}
