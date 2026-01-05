'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TransactionForm } from '@/components/transaction-form';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon } from '@hugeicons/core-free-icons';
import type { Account, Category } from '@/lib/schema';

type AddExpenseButtonProps = {
  accounts: Account[];
  categories: Category[];
};

export function AddExpenseButton({ accounts, categories }: AddExpenseButtonProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('expenses');

  return (
    <TransactionForm
      mode="expense"
      accounts={accounts}
      categories={categories}
      open={open}
      onOpenChange={setOpen}
      onSuccess={() => setOpen(false)}
      trigger={
        <Button variant="hollow" size="sm">
          <HugeiconsIcon icon={Add01Icon} className="mr-2 size-4" />
          {t('addExpense')}
        </Button>
      }
    />
  );
}
