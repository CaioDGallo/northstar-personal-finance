'use client';

import { useState } from 'react';
import { deleteAccount } from '@/lib/actions/accounts';
import type { Account } from '@/lib/schema';
import { AccountForm } from '@/components/account-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HugeiconsIcon } from '@hugeicons/react';
import { MoreVerticalIcon } from '@hugeicons/core-free-icons';
import { accountTypeConfig } from '@/lib/account-type-config';
import { formatCurrency } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { BankLogo } from '@/components/bank-logo';

type AccountCardProps = {
  account: Account;
  onChange?: () => void | Promise<void>;
};

export function AccountCard({ account, onChange }: AccountCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const t = useTranslations('accounts');
  const tCommon = useTranslations('common');
  const tAccountTypes = useTranslations('accountTypes');

  const config = accountTypeConfig[account.type];
  const isCreditCard = account.type === 'credit_card';

  // For credit cards, display debt and available credit
  const debt = isCreditCard ? Math.abs(account.currentBalance) : 0;
  const availableCredit = isCreditCard && account.creditLimit
    ? account.creditLimit - debt
    : null;

  const balanceLabel = account.currentBalance < 0 ? 'text-red-600' : 'text-green-600';
  const availableCreditLabel = availableCredit !== null && availableCredit < 0
    ? 'text-red-600'
    : 'text-green-600';

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteAccount(account.id);
      setDeleteOpen(false);
      await onChange?.();
    } catch (err) {
      console.error('[AccountCard] Delete failed:', err);
      setDeleteError(tCommon('unexpectedError'));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3">
        {/* Account icon (bank logo or type icon) */}
        {account.bankLogo ? (
          <div className="size-10 shrink-0 rounded-full flex items-center justify-center bg-white p-1.5">
            <BankLogo logo={account.bankLogo} size={32} />
          </div>
        ) : (
          <div
            className="size-10 shrink-0 rounded-full flex items-center justify-center text-white"
            style={{ backgroundColor: config.color }}
          >
            <HugeiconsIcon icon={config.icon} strokeWidth={2} size={20} />
          </div>
        )}

        {/* Account name + type */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{account.name}</h3>
          <p className="text-xs text-gray-500">{tAccountTypes(account.type)}</p>
        </div>

        {/* Balance / Debt display */}
        {isCreditCard ? (
          <div className="text-right space-y-1">
            {/* Current Debt */}
            <div>
              <p className="text-sm font-semibold text-red-600">
                {formatCurrency(debt)}
              </p>
              <p className="text-xs text-gray-500">{t('currentDebt')}</p>
            </div>
            {/* Available Credit (if limit is set) */}
            {availableCredit !== null && (
              <div>
                <p className={`text-sm font-semibold ${availableCreditLabel}`}>
                  {formatCurrency(availableCredit)}
                </p>
                <p className="text-xs text-gray-500">{t('availableCredit')}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-right">
            <p className={`text-sm font-semibold ${balanceLabel}`}>
              {formatCurrency(account.currentBalance)}
            </p>
            <p className="text-xs text-gray-500">{t('currentBalance')}</p>
          </div>
        )}

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => setEditOpen(true)}>
              {tCommon('edit')} {t('title')}
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={() => setDeleteOpen(true)}>
              {tCommon('delete')} {t('title')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog open={editOpen} onOpenChange={setEditOpen}>
          <AlertDialogContent closeOnBackdropClick>
            <AlertDialogHeader>
              <AlertDialogTitle>{tCommon('edit')} {t('title')}</AlertDialogTitle>
            </AlertDialogHeader>
            <AccountForm
              account={account}
              onSuccess={async () => {
                await onChange?.();
                setEditOpen(false);
              }}
            />
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tCommon('delete')} {t('title')}?</AlertDialogTitle>
              <AlertDialogDescription>
                {tCommon('actionCannotBeUndone')}
              </AlertDialogDescription>
            </AlertDialogHeader>

            {deleteError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {deleteError}
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>{tCommon('cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? tCommon('deleting') : tCommon('delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
