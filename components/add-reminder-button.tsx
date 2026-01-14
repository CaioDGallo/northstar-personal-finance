'use client';

import { useState } from 'react';
import { BillReminderForm } from '@/components/bill-reminder-form';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Category } from '@/lib/schema';
import { useTranslations } from 'next-intl';

type AddReminderButtonProps = {
  categories: Category[];
};

export function AddReminderButton({ categories }: AddReminderButtonProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('billReminders');

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="hollow">{t('addReminder')}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent closeOnBackdropClick>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('addReminder')}</AlertDialogTitle>
        </AlertDialogHeader>
        <BillReminderForm
          categories={categories}
          onSuccess={() => setOpen(false)}
        />
      </AlertDialogContent>
    </AlertDialog>
  );
}
