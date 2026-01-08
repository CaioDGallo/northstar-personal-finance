'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { TransferForm } from '@/components/transfer-form';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon } from '@hugeicons/core-free-icons';
import type { Account } from '@/lib/schema';

type AddTransferButtonProps = {
  accounts: Account[];
};

export function AddTransferButton({ accounts }: AddTransferButtonProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('transfers');

  return (
    <TransferForm
      accounts={accounts}
      open={open}
      onOpenChange={setOpen}
      onSuccess={() => setOpen(false)}
      trigger={
        <Button variant="hollow" size="sm">
          <HugeiconsIcon icon={Add01Icon} className="mr-2 size-4" />
          {t('addTransfer')}
        </Button>
      }
    />
  );
}
