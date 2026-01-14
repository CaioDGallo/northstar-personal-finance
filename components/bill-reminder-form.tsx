'use client';

import { useState } from 'react';
import {
  createBillReminder,
  updateBillReminder,
} from '@/lib/actions/bill-reminders';
import type { BillReminder, Category } from '@/lib/schema';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useTranslations } from 'next-intl';
import { centsToDisplay, displayToCents, getCurrentYearMonth } from '@/lib/utils';

type BillReminderFormProps = {
  reminder?: BillReminder;
  categories: Category[];
  onSuccess?: () => void;
};

export function BillReminderForm({
  reminder,
  categories,
  onSuccess,
}: BillReminderFormProps) {
  const [name, setName] = useState(reminder?.name || '');
  const [categoryId, setCategoryId] = useState<number | null>(
    reminder?.categoryId ?? null
  );
  const [amount, setAmount] = useState(
    reminder?.amount ? centsToDisplay(reminder.amount) : ''
  );
  const [dueDay, setDueDay] = useState(reminder?.dueDay || 1);
  const [dueTime, setDueTime] = useState(reminder?.dueTime || '');
  const [recurrenceType, setRecurrenceType] = useState(
    reminder?.recurrenceType || 'monthly'
  );
  const [notify2Days, setNotify2Days] = useState(
    reminder?.notify2DaysBefore ?? true
  );
  const [notify1Day, setNotify1Day] = useState(
    reminder?.notify1DayBefore ?? true
  );
  const [notifyDueDay, setNotifyDueDay] = useState(
    reminder?.notifyOnDueDay ?? true
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const t = useTranslations('billReminderForm');
  const tCommon = useTranslations('common');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const data = {
        name: name.trim(),
        categoryId,
        amount: amount ? displayToCents(amount) : null,
        dueDay,
        dueTime: dueTime || null,
        status: 'active' as const,
        recurrenceType,
        startMonth: reminder?.startMonth || getCurrentYearMonth(),
        endMonth: reminder?.endMonth || null,
        notify2DaysBefore: notify2Days,
        notify1DayBefore: notify1Day,
        notifyOnDueDay: notifyDueDay,
        lastAcknowledgedMonth: reminder?.lastAcknowledgedMonth || null,
      };

      const result = reminder
        ? await updateBillReminder(reminder.id, data)
        : await createBillReminder(data);

      if (!result.success) {
        setError(result.error);
        return;
      }

      onSuccess?.();
    } catch (err) {
      console.error('[BillReminderForm] Submit failed:', err);
      setError(tCommon('unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">{t('name')}</FieldLabel>
          <Input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder={t('namePlaceholder')}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="category">{t('category')}</FieldLabel>
          <Select
            value={categoryId?.toString() || 'none'}
            onValueChange={(v) => setCategoryId(v === 'none' ? null : Number(v))}
          >
            <SelectTrigger id="category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('noCategory')}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>
                  <div className="flex items-center gap-2">
                    <div
                      className="size-3 shrink-0 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="amount">{t('amount')}</FieldLabel>
          <Input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t('amountPlaceholder')}
            step="0.01"
            min="0"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="recurrenceType">{t('recurrence')}</FieldLabel>
          <Select value={recurrenceType} onValueChange={setRecurrenceType}>
            <SelectTrigger id="recurrenceType">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="once">{t('once')}</SelectItem>
              <SelectItem value="weekly">{t('weekly')}</SelectItem>
              <SelectItem value="biweekly">{t('biweekly')}</SelectItem>
              <SelectItem value="monthly">{t('monthly')}</SelectItem>
              <SelectItem value="quarterly">{t('quarterly')}</SelectItem>
              <SelectItem value="yearly">{t('yearly')}</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="dueDay">{t('dueDay')}</FieldLabel>
          <Select value={dueDay.toString()} onValueChange={(v) => setDueDay(Number(v))}>
            <SelectTrigger id="dueDay">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                <SelectItem key={day} value={day.toString()}>
                  {day}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="dueTime">{t('dueTime')}</FieldLabel>
          <Input
            type="time"
            id="dueTime"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />
        </Field>

        <div className="space-y-3">
          <FieldLabel>{t('notifications')}</FieldLabel>

          <Field orientation="horizontal">
            <Checkbox
              id="notify2Days"
              checked={notify2Days}
              onCheckedChange={(checked) => setNotify2Days(checked === true)}
            />
            <FieldLabel htmlFor="notify2Days">{t('notify2DaysBefore')}</FieldLabel>
          </Field>

          <Field orientation="horizontal">
            <Checkbox
              id="notify1Day"
              checked={notify1Day}
              onCheckedChange={(checked) => setNotify1Day(checked === true)}
            />
            <FieldLabel htmlFor="notify1Day">{t('notify1DayBefore')}</FieldLabel>
          </Field>

          <Field orientation="horizontal">
            <Checkbox
              id="notifyDueDay"
              checked={notifyDueDay}
              onCheckedChange={(checked) => setNotifyDueDay(checked === true)}
            />
            <FieldLabel htmlFor="notifyDueDay">{t('notifyOnDueDay')}</FieldLabel>
          </Field>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>
            {tCommon('cancel')}
          </AlertDialogCancel>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? tCommon('saving')
              : reminder
                ? tCommon('update')
                : tCommon('create')}
          </Button>
        </AlertDialogFooter>
      </FieldGroup>
    </form>
  );
}
