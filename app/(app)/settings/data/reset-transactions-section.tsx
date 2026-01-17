'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { resetAllTransactions } from '@/lib/actions/reset-transactions';
import { toast } from 'sonner';
import { Delete02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

export function ResetTransactionsSection() {
  const t = useTranslations('dataSettings');
  const tCommon = useTranslations('common');
  const [isResetting, setIsResetting] = useState(false);
  const [open, setOpen] = useState(false);

  async function handleReset() {
    setIsResetting(true);
    try {
      const result = await resetAllTransactions();
      if (result.success) {
        toast.success(
          t('resetTransactionsSuccess', {
            transactions: result.deletedTransactions,
            entries: result.deletedEntries,
            income: result.deletedIncome,
            transfers: result.deletedTransfers,
            faturas: result.deletedFaturas,
            accounts: result.accountsReconciled,
          })
        );
        setOpen(false);
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(tCommon('unexpectedError'));
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <div className="border-2 border-destructive/50 bg-destructive/5 p-6 mt-6">
      <div className="flex items-center gap-2 mb-2">
        <HugeiconsIcon icon={Delete02Icon} className="size-5 text-destructive" />
        <h2 className="text-lg font-semibold text-destructive">{t('dangerZone')}</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">{t('dangerZoneDescription')}</p>

      <div className="border border-destructive/30 p-4 bg-background">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <h3 className="font-medium">{t('resetTransactions')}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t('resetTransactionsDescription')}
            </p>
          </div>
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="shrink-0">
                {t('resetTransactionsButton')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('resetTransactionsConfirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('resetTransactionsConfirmDescription')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isResetting}>{tCommon('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    handleReset();
                  }}
                  disabled={isResetting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isResetting ? t('resetting') : t('resetTransactionsConfirmButton')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
