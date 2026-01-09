'use client';

import { useState, useTransition, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { convertExpenseToFaturaPayment } from '@/lib/actions/faturas';
import { toast } from 'sonner';

type UnpaidFatura = {
  id: number;
  accountId: number;
  accountName: string;
  yearMonth: string;
  totalAmount: number;
  dueDate: string;
};

type ConvertToFaturaDialogProps = {
  entry: {
    id: number;
    amount: number;
    description: string;
    purchaseDate: string;
  };
  unpaidFaturas: UnpaidFatura[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function ConvertToFaturaDialog({
  entry,
  unpaidFaturas,
  open,
  onOpenChange,
  onSuccess,
}: ConvertToFaturaDialogProps) {
  // Compute default fatura selection
  const getDefaultFaturaId = () => {
    if (unpaidFaturas.length === 0) return '';

    // Find fatura with matching amount
    const exactMatch = unpaidFaturas.find((f) => f.totalAmount === entry.amount);
    return exactMatch ? String(exactMatch.id) : String(unpaidFaturas[0].id);
  };

  const [selectedFaturaId, setSelectedFaturaId] = useState<string>('');
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('expenses');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedFaturaId(getDefaultFaturaId());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleConvert = async () => {
    if (!selectedFaturaId) {
      toast.error(t('selectFatura'));
      return;
    }

    startTransition(async () => {
      try {
        await convertExpenseToFaturaPayment(entry.id, parseInt(selectedFaturaId));
        toast.success(t('convertSuccess'));
        onOpenChange(false);
        setSelectedFaturaId('');
        onSuccess?.();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : tErrors('failedToUpdate');
        toast.error(errorMessage);
        console.error(error);
      }
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent closeOnBackdropClick>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('convertToFaturaPayment')}</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="min-w-0">
            <p className="text-sm text-gray-600 truncate">{entry.description}</p>
            <p className="text-2xl font-bold mt-2">{formatCurrency(entry.amount)}</p>
          </div>

          <div className="min-w-0">
            <p className="text-sm text-gray-600 mb-2">{t('convertToFaturaDescription')}</p>
            <label className="text-sm font-medium mb-2 block">
              {t('faturaSelectionLabel')}
            </label>
            <Select value={selectedFaturaId} onValueChange={setSelectedFaturaId}>
              <SelectTrigger size='default' className="w-full min-h-14 h-auto">
                <SelectValue placeholder={t('selectFatura')} />
              </SelectTrigger>
              <SelectContent>
                {unpaidFaturas.map((fatura) => (
                  <SelectItem key={fatura.id} value={String(fatura.id)}>
                    <div className="flex flex-col items-start gap-0.5 py-0.5">
                      <span className="font-medium">{fatura.accountName}</span>
                      <span className="text-xs text-gray-500">
                        {fatura.yearMonth} · {formatCurrency(fatura.totalAmount)}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{tCommon('cancel')}</AlertDialogCancel>
          <Button onClick={handleConvert} disabled={isPending || !selectedFaturaId}>
            {isPending ? tCommon('converting') : tCommon('convert')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
