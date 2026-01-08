'use client';

import { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeftRightIcon, MoreVerticalIcon } from '@hugeicons/core-free-icons';
import { useTranslations } from 'next-intl';
import type { Account } from '@/lib/schema';
import { deleteTransfer } from '@/lib/actions/transfers';
import { TransferForm } from '@/components/transfer-form';

export type TransferListItem = {
  id: number;
  amount: number;
  date: string;
  type: 'fatura_payment' | 'internal_transfer' | 'deposit' | 'withdrawal';
  description: string | null;
  fromAccountId: number | null;
  toAccountId: number | null;
  faturaId: number | null;
  fromAccountName: string | null;
  toAccountName: string | null;
};

type TransferCardProps = {
  transfer: TransferListItem;
  accounts: Account[];
};

export function TransferCard({ transfer, accounts }: TransferCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const t = useTranslations('transfers');
  const tCommon = useTranslations('common');
  const fromLabel = transfer.fromAccountName ?? t('external');
  const toLabel = transfer.toAccountName ?? t('external');
  const title = transfer.description || t(`types.${transfer.type}`);
  const isLocked = !!transfer.faturaId;
  const handleDeleteOpenChange = (open: boolean) => {
    setDeleteOpen(open);
    if (open) {
      setDeleteError(null);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteTransfer(transfer.id);
      setDeleteOpen(false);
    } catch (error) {
      console.error('[TransferCard] Delete failed:', error);
      const message = error instanceof Error ? error.message : tCommon('unexpectedError');
      setDeleteError(message || tCommon('unexpectedError'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Card className="py-0">
        <CardContent className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{title}</h3>
            <div className="text-xs text-gray-500 flex items-center gap-1 min-w-0">
              <span className="truncate">{fromLabel}</span>
              <HugeiconsIcon icon={ArrowLeftRightIcon} className="size-3 text-gray-400" />
              <span className="truncate">{toLabel}</span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-sm font-semibold">{formatCurrency(transfer.amount)}</div>
            <div className="text-xs text-gray-500">{formatDate(transfer.date)}</div>
          </div>

          {!isLocked && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  {tCommon('edit')}
                </DropdownMenuItem>
                <AlertDialog open={deleteOpen} onOpenChange={handleDeleteOpenChange}>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      {t('deleteTransfer')}
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('deleteConfirmationTitle')}</AlertDialogTitle>
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
                      <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting ? tCommon('deleting') : tCommon('delete')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardContent>
      </Card>

      <TransferForm
        accounts={accounts}
        transfer={transfer}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => setEditOpen(false)}
      />
    </>
  );
}
