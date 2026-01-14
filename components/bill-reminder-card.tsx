'use client';

import { useState } from 'react';
import {
  deleteBillReminder,
  updateBillReminder,
} from '@/lib/actions/bill-reminders';
import { calculateNextDueDate } from '@/lib/utils/bill-reminders';
import type { BillReminder, Category } from '@/lib/schema';
import { BillReminderForm } from '@/components/bill-reminder-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { CategoryIcon } from '@/components/icon-picker';
import { HugeiconsIcon } from '@hugeicons/react';
import { MoreVerticalIcon } from '@hugeicons/core-free-icons';
import { useTranslations } from 'next-intl';
import { formatCurrencyWithLocale } from '@/lib/utils';

type BillReminderCardProps = {
  reminder: BillReminder;
  categories: Category[];
};

export function BillReminderCard({ reminder, categories }: BillReminderCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const t = useTranslations('billReminders');
  const tCommon = useTranslations('common');

  const category = categories.find((c) => c.id === reminder.categoryId);
  const nextDue = calculateNextDueDate(reminder);

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await deleteBillReminder(reminder.id);

      if (!result.success) {
        setDeleteError(result.error);
        return;
      }

      setDeleteOpen(false);
    } catch (err) {
      console.error('[BillReminderCard] Delete failed:', err);
      setDeleteError(tCommon('unexpectedError'));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleToggleStatus() {
    try {
      const newStatus = reminder.status === 'active' ? 'paused' : 'active';
      const result = await updateBillReminder(reminder.id, { status: newStatus });

      if (!result.success) {
        console.error('[BillReminderCard] Toggle status failed:', result.error);
      }
    } catch (err) {
      console.error('[BillReminderCard] Toggle status failed:', err);
    }
  }

  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3">
        {/* Category color indicator */}
        <div
          className="size-10 shrink-0 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: category?.color || '#6b7280' }}
        >
          {category && <CategoryIcon icon={category.icon} />}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{reminder.name}</h3>
          <p className="text-xs text-muted-foreground">
            {t('dueDay')} {reminder.dueDay}
            {reminder.amount && ` • ${formatCurrencyWithLocale(reminder.amount, 'pt-BR')}`}
          </p>
          <p className="text-xs text-muted-foreground">
            {t('nextDue')}: {nextDue.toLocaleDateString()}
          </p>
        </div>

        {/* Status badge */}
        {reminder.status !== 'active' && (
          <Badge variant="outline">{t(reminder.status)}</Badge>
        )}

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Edit */}
            <AlertDialog open={editOpen} onOpenChange={setEditOpen}>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  {tCommon('edit')}
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent closeOnBackdropClick>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('editReminder')}</AlertDialogTitle>
                </AlertDialogHeader>
                <BillReminderForm
                  reminder={reminder}
                  categories={categories}
                  onSuccess={() => setEditOpen(false)}
                />
              </AlertDialogContent>
            </AlertDialog>

            {/* Toggle status */}
            <DropdownMenuItem onClick={handleToggleStatus}>
              {reminder.status === 'active' ? t('pause') : t('activate')}
            </DropdownMenuItem>

            {/* Delete */}
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  {tCommon('delete')}
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('deleteReminderTitle')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('deleteReminderDescription')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                    {deleteError}
                  </div>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>
                    {tCommon('cancel')}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      handleDelete();
                    }}
                    disabled={isDeleting}
                  >
                    {isDeleting ? tCommon('deleting') : tCommon('delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}
