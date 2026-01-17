'use client';

import { useState, useEffect, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { formatFaturaMonth } from '@/lib/fatura-utils';
import { getFaturaWithEntries, markFaturaUnpaid, updateFaturaDates } from '@/lib/actions/faturas';
import { PayFaturaDialog } from '@/components/pay-fatura-dialog';
import { CategoryIcon } from '@/components/icon-picker';
import { toast } from 'sonner';
import type { Account } from '@/lib/schema';

type FaturaDetailSheetProps = {
  faturaId: number;
  accountName: string;
  yearMonth: string;
  checkingAccounts: Account[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type FaturaDetail = Awaited<ReturnType<typeof getFaturaWithEntries>>;

export function FaturaDetailSheet({
  faturaId,
  accountName,
  yearMonth,
  checkingAccounts,
  open,
  onOpenChange,
}: FaturaDetailSheetProps) {
  const [fatura, setFatura] = useState<FaturaDetail | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState('');
  const [editClosingDate, setEditClosingDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('faturas');
  const tCommon = useTranslations('common');

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsEditingDates(false); // Reset editing mode when sheet opens
      getFaturaWithEntries(faturaId).then((data) => {
        setFatura(data);
        if (data) {
          setEditStartDate(data.startDate || '');
          setEditClosingDate(data.closingDate);
          setEditDueDate(data.dueDate);
        }
      });
    }
  }, [faturaId, open]);

  const handleUnpay = async () => {
    startTransition(async () => {
      try {
        await markFaturaUnpaid(faturaId);
        toast.success(t('paymentReverted'));
        // Refresh data
        const updated = await getFaturaWithEntries(faturaId);
        setFatura(updated);
      } catch (error) {
        toast.error(t('errorRevertingPayment'));
        console.error(error);
      }
    });
  };

  const handleSaveDates = async () => {
    startTransition(async () => {
      try {
        await updateFaturaDates(faturaId, {
          startDate: editStartDate || null,
          closingDate: editClosingDate,
          dueDate: editDueDate,
        });
        toast.success(t('datesUpdated'));
        // Refresh data
        const updated = await getFaturaWithEntries(faturaId);
        setFatura(updated);
        if (updated) {
          setEditStartDate(updated.startDate || '');
          setEditClosingDate(updated.closingDate);
          setEditDueDate(updated.dueDate);
        }
        setIsEditingDates(false);
      } catch (error) {
        toast.error(t('errorUpdatingDates'));
        console.error(error);
      }
    });
  };

  const handleCancelEditDates = () => {
    if (fatura) {
      setEditClosingDate(fatura.closingDate);
      setEditDueDate(fatura.dueDate);
    }
    setIsEditingDates(false);
  };

  if (!fatura) {
    return null;
  }

  const isPaid = !!fatura.paidAt;

  // Group entries by category
  const entriesByCategory = fatura.entries.reduce((acc, entry) => {
    const categoryName = entry.categoryName || t('noCategory');
    if (!acc[categoryName]) {
      acc[categoryName] = {
        categoryColor: entry.categoryColor || '#6b7280',
        categoryIcon: entry.categoryIcon,
        entries: [],
      };
    }
    acc[categoryName].entries.push(entry);
    return acc;
  }, {} as Record<string, { categoryColor: string; categoryIcon: string | null; entries: typeof fatura.entries }>);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            'pb-[env(safe-area-inset-bottom)]',
            'backdrop-blur-xl bg-background/95',
            'max-h-[85vh] flex flex-col'
          )}
        >
          <SheetHeader>
            <SheetTitle className="capitalize">
              {accountName} - {formatFaturaMonth(yearMonth)}
            </SheetTitle>
          </SheetHeader>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Summary */}
            <div className="border-b pb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">{t('total')}</span>
                <span className="text-2xl font-bold">
                  {formatCurrency(fatura.totalAmount)}
                </span>
              </div>

              {isEditingDates ? (
                <div className="space-y-3 mt-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 min-w-24">{t('startDate')}</label>
                    <Input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 min-w-24">{t('closingDate')}</label>
                    <Input
                      type="date"
                      value={editClosingDate}
                      onChange={(e) => setEditClosingDate(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-gray-600 min-w-24">{t('dueDate')}</label>
                    <Input
                      type="date"
                      value={editDueDate}
                      onChange={(e) => setEditDueDate(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      onClick={handleSaveDates}
                      disabled={isPending}
                      className="flex-1"
                    >
                      {tCommon('save')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEditDates}
                      disabled={isPending}
                      className="flex-1"
                    >
                      {tCommon('cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-gray-600">{t('startDate')}</span>
                    <span>
                      {fatura.startDate ? formatDate(fatura.startDate) : `(${t('calculated')})`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-gray-600">{t('closingDate')}</span>
                    <span>{formatDate(fatura.closingDate)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-gray-600">{t('dueDate')}</span>
                    <span>{formatDate(fatura.dueDate)}</span>
                  </div>
                  {!isPaid && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingDates(true)}
                      className="mt-2 w-full"
                    >
                      {t('editDates')}
                    </Button>
                  )}
                  {isPaid && (
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-gray-600">{t('paidOn')}</span>
                      <span className="text-green-600">
                        {formatDate(fatura.paidAt!)}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Entries grouped by category */}
            {fatura.entries.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-500">{t('noPurchases')}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(entriesByCategory).map(([categoryName, { categoryColor, categoryIcon, entries }]) => (
                  <div key={categoryName}>
                    <h3 className="text-sm font-medium text-gray-500 mb-3">
                      {categoryName}
                    </h3>
                    <div className="space-y-2">
                      {entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex items-center gap-3 p-2 rounded-md hover:bg-muted"
                        >
                          {/* Category icon */}
                          <div
                            className="size-8 shrink-0 rounded-full flex items-center justify-center text-white"
                            style={{ backgroundColor: categoryColor }}
                          >
                            <CategoryIcon icon={categoryIcon} className="size-4" />
                          </div>

                          {/* Description + date */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium truncate">
                                {entry.description}
                              </p>
                              {entry.totalInstallments > 1 && (
                                <Badge variant="secondary" className="shrink-0 text-xs">
                                  {entry.installmentNumber}/{entry.totalInstallments}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">
                              {formatDate(entry.purchaseDate)}
                            </p>
                          </div>

                          {/* Amount */}
                          <div className="text-sm font-semibold shrink-0">
                            {formatCurrency(entry.amount)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="border-t p-4 flex gap-2">
            {isPaid ? (
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleUnpay}
                disabled={isPending}
              >
                {isPending ? tCommon('reverting') : t('revertPayment')}
              </Button>
            ) : (
              <Button
                className="flex-1"
                onClick={() => setPayDialogOpen(true)}
              >
                {t('payFatura')}
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {!isPaid && fatura && (
        <PayFaturaDialog
          faturaId={fatura.id}
          totalAmount={fatura.totalAmount}
          accountName={accountName}
          checkingAccounts={checkingAccounts}
          open={payDialogOpen}
          onOpenChange={(open) => {
            setPayDialogOpen(open);
            if (!open) {
              // Refresh fatura data after payment
              getFaturaWithEntries(faturaId).then(setFatura);
            }
          }}
        />
      )}
    </>
  );
}
