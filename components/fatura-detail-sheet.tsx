'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { formatFaturaMonth } from '@/lib/fatura-utils';
import { getFaturaWithEntries, markFaturaUnpaid } from '@/lib/actions/faturas';
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
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      getFaturaWithEntries(faturaId).then(setFatura);
    }
  }, [faturaId, open]);

  const handleUnpay = async () => {
    startTransition(async () => {
      try {
        await markFaturaUnpaid(faturaId);
        toast.success('Pagamento revertido');
        // Refresh data
        const updated = await getFaturaWithEntries(faturaId);
        setFatura(updated);
      } catch (error) {
        toast.error('Erro ao reverter pagamento');
        console.error(error);
      }
    });
  };

  if (!fatura) {
    return null;
  }

  const isPaid = !!fatura.paidAt;

  // Group entries by category
  const entriesByCategory = fatura.entries.reduce((acc, entry) => {
    const categoryName = entry.categoryName || 'Sem categoria';
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
                <span className="text-sm text-gray-600">Total:</span>
                <span className="text-2xl font-bold">
                  {formatCurrency(fatura.totalAmount)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Vencimento:</span>
                <span>{formatDate(fatura.dueDate)}</span>
              </div>
              {isPaid && (
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-gray-600">Pago em:</span>
                  <span className="text-green-600">
                    {formatDate(fatura.paidAt!)}
                  </span>
                </div>
              )}
            </div>

            {/* Entries grouped by category */}
            {fatura.entries.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-500">Nenhuma compra nesta fatura</p>
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
                {isPending ? 'Revertendo...' : 'Reverter Pagamento'}
              </Button>
            ) : (
              <Button
                className="flex-1"
                onClick={() => setPayDialogOpen(true)}
              >
                Pagar Fatura
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
