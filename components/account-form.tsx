'use client';

import { useState } from 'react';
import { createAccount, updateAccount } from '@/lib/actions/accounts';
import type { Account } from '@/lib/schema';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useTranslations } from 'next-intl';
import { centsToDisplay, displayToCents } from '@/lib/utils';

type AccountFormProps = {
  account?: Account;
  onSuccess?: () => void;
};

export function AccountForm({ account, onSuccess }: AccountFormProps) {
  const [name, setName] = useState(account?.name || '');
  const [type, setType] = useState<'credit_card' | 'checking' | 'savings' | 'cash'>(
    account?.type || 'checking'
  );
  const [initialBalance, setInitialBalance] = useState('');
  const [closingDay, setClosingDay] = useState<number | null>(account?.closingDay ?? null);
  const [paymentDueDay, setPaymentDueDay] = useState<number | null>(account?.paymentDueDay ?? null);
  const [creditLimit, setCreditLimit] = useState(
    account?.creditLimit ? centsToDisplay(account.creditLimit) : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations('accountForm');
  const tAccountTypes = useTranslations('accountTypes');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate credit limit for credit cards
    if (type === 'credit_card' && !creditLimit) {
      alert(t('creditLimitRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        name,
        type,
        ...(!account && { currentBalance: displayToCents(initialBalance) }),
        ...(type === 'credit_card' && {
          closingDay,
          paymentDueDay,
          creditLimit: creditLimit ? displayToCents(creditLimit) : null,
        }),
      };

      const result = account
        ? await updateAccount(account.id, data)
        : await createAccount(data);

      if (result.success) {
        onSuccess?.();
      }
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
            placeholder="NuBank CC"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="type">{t('type')}</FieldLabel>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="checking">{tAccountTypes('checking')}</SelectItem>
                <SelectItem value="savings">{tAccountTypes('savings')}</SelectItem>
                <SelectItem value="credit_card">{tAccountTypes('credit_card')}</SelectItem>
                <SelectItem value="cash">{tAccountTypes('cash')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        {!account && (
          <Field>
            <FieldLabel htmlFor="initialBalance">{t('initialBalance')}</FieldLabel>
            <Input
              type="text"
              id="initialBalance"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              required
              placeholder={t('initialBalancePlaceholder')}
            />
          </Field>
        )}

        {type === 'credit_card' && (
          <>
            <Field>
              <FieldLabel htmlFor="closingDay">{t('closingDay')}</FieldLabel>
              <Select
                value={closingDay?.toString() || ''}
                onValueChange={(v) => setClosingDay(v ? Number(v) : null)}
              >
                <SelectTrigger id="closingDay">
                  <SelectValue placeholder={t('selectDay')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={day.toString()}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="paymentDueDay">{t('paymentDueDay')}</FieldLabel>
              <Select
                value={paymentDueDay?.toString() || ''}
                onValueChange={(v) => setPaymentDueDay(v ? Number(v) : null)}
              >
                <SelectTrigger id="paymentDueDay">
                  <SelectValue placeholder={t('selectDay')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                      <SelectItem key={day} value={day.toString()}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="creditLimit">{t('creditLimit')}</FieldLabel>
              <Input
                type="text"
                id="creditLimit"
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                required
                placeholder={t('creditLimitPlaceholder')}
              />
            </Field>
          </>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('saving') : account ? t('update') : t('create')}
          </Button>
        </AlertDialogFooter>
      </FieldGroup>
    </form>
  );
}
