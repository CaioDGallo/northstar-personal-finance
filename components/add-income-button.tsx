'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TransactionForm } from '@/components/transaction-form';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon } from '@hugeicons/core-free-icons';
import type { Account, Category } from '@/lib/schema';

type AddIncomeButtonProps = {
  accounts: Account[];
  categories: Category[];
};

export function AddIncomeButton({ accounts, categories }: AddIncomeButtonProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('income');

  return (
    <TransactionForm
      mode="income"
      accounts={accounts}
      categories={categories}
      open={open}
      onOpenChange={setOpen}
      onSuccess={() => setOpen(false)}
      trigger={
        <Button variant="hollow" size="sm">
          <HugeiconsIcon icon={Add01Icon} className="mr-2 size-4" />
          {t('addIncome')}
        </Button>
      }
    />
  );
}
