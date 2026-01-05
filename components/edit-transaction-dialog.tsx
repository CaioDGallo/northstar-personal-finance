'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { getTransactionWithEntries } from '@/lib/actions/expenses';
import { TransactionForm } from '@/components/transaction-form';
import type { Account, Category, Transaction, Entry } from '@/lib/schema';
import type { IncomeEntry } from '@/lib/contexts/income-context';
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

type EditTransactionDialogProps = {
  mode: 'expense' | 'income';
  transactionId?: number;
  income?: IncomeEntry;
  accounts: Account[];
  categories: Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function EditTransactionDialog({
  mode,
  transactionId,
  income,
  accounts,
  categories,
  open,
  onOpenChange,
  onSuccess,
}: EditTransactionDialogProps) {
  const [transaction, setTransaction] = useState<(Transaction & { entries: Entry[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const t = useTranslations('expenses');
  const tCommon = useTranslations('common');

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) {
      setTransaction(null);
      setShowWarning(false);
      setShowForm(false);
      return;
    }

    if (mode === 'expense' && transactionId) {
      setIsLoading(true);
      getTransactionWithEntries(transactionId)
        .then((data) => {
          setTransaction(data || null);
          // Show warning if multi-installment expense with paid entries
          if (data && data.totalInstallments > 1) {
            const hasPaidEntries = data.entries.some((e) => e.paidAt !== null);
            if (hasPaidEntries) {
              setShowWarning(true);
            } else {
              setShowForm(true);
            }
          } else {
            setShowForm(true);
          }
        })
        .catch((error) => {
          console.error('Failed to load transaction:', error);
          onOpenChange(false);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (mode === 'income' && income) {
      setShowForm(true);
    }
  }, [open, mode, transactionId, income, onOpenChange]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleWarningContinue = () => {
    setShowWarning(false);
    setShowForm(true);
  };

  const handleWarningCancel = () => {
    setShowWarning(false);
    onOpenChange(false);
  };

  const handleFormSuccess = () => {
    onSuccess?.();
  };

  // Warning dialog for multi-installment expenses
  if (showWarning && transaction) {
    const paidCount = transaction.entries.filter((e) => e.paidAt !== null).length;

    return (
      <AlertDialog open={true} onOpenChange={handleWarningCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('editExpense')}</AlertDialogTitle>
            <AlertDialogDescription>
              {paidCount > 0
                ? t('editWarningDescription', {
                    totalInstallments: transaction.totalInstallments,
                    paidCount,
                  })
                : t('editWarningDescriptionNoPaid', {
                    totalInstallments: transaction.totalInstallments,
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleWarningCancel}>
              {tCommon('cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleWarningContinue}>
              {t('continueEditing')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <AlertDialog open={true} onOpenChange={() => onOpenChange(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tCommon('loading')}</AlertDialogTitle>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // Form
  if (showForm) {
    return (
      <TransactionForm
        mode={mode}
        accounts={accounts}
        categories={categories}
        transaction={transaction || undefined}
        income={income}
        open={open}
        onOpenChange={onOpenChange}
        onSuccess={handleFormSuccess}
      />
    );
  }

  return null;
}
