'use client';

import { useState } from 'react';
import { createAccount, updateAccount } from '@/lib/actions/accounts';
import type { Account } from '@/lib/schema';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useTranslations } from 'next-intl';
import { BankLogoPicker } from '@/components/bank-logo-picker';
import { BankLogo } from '@/components/bank-logo';
import { BANK_LOGOS } from '@/lib/bank-logos';
import { HugeiconsIcon } from '@hugeicons/react';
import { BankIcon } from '@hugeicons/core-free-icons';
import { toast } from 'sonner';

type AccountFormProps = {
  account?: Account;
  onSuccess?: () => void;
};

export function AccountForm({ account, onSuccess }: AccountFormProps) {
  const [name, setName] = useState(account?.name || '');
  const [type, setType] = useState<'credit_card' | 'checking' | 'savings' | 'cash'>(
    account?.type || 'checking'
  );
  const [initialBalanceCents, setInitialBalanceCents] = useState(0);
  const [closingDay, setClosingDay] = useState<number | null>(account?.closingDay ?? null);
  const [paymentDueDay, setPaymentDueDay] = useState<number | null>(account?.paymentDueDay ?? null);
  const [creditLimitCents, setCreditLimitCents] = useState(
    account?.creditLimit ?? 0
  );
  const [bankLogo, setBankLogo] = useState<string | null>(account?.bankLogo ?? null);
  const [logoPickerOpen, setLogoPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations('accountForm');
  const tAccountTypes = useTranslations('accountTypes');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate credit limit for credit cards
    if (type === 'credit_card' && creditLimitCents === 0) {
      toast.error(t('creditLimitRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        name,
        type,
        bankLogo,
        ...(!account && { currentBalance: initialBalanceCents }),
        ...(type === 'credit_card' && {
          closingDay,
          paymentDueDay,
          creditLimit: creditLimitCents > 0 ? creditLimitCents : null,
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

        <Field>
          <FieldLabel htmlFor="bankLogo">{t('bankLogo')}</FieldLabel>
          <button
            type="button"
            onClick={() => setLogoPickerOpen(true)}
            className="flex items-center gap-3 px-3 py-2 border rounded-md hover:bg-muted transition-colors text-left w-full"
          >
            {bankLogo ? (
              <>
                <div className="size-8 rounded-full flex items-center justify-center bg-white shrink-0 p-1">
                  <BankLogo logo={bankLogo} size={24} />
                </div>
                <span className="text-sm">
                  {BANK_LOGOS[bankLogo as keyof typeof BANK_LOGOS]?.name}
                </span>
              </>
            ) : (
              <>
                <div className="size-8 rounded-full flex items-center justify-center bg-muted shrink-0">
                  <HugeiconsIcon
                    icon={BankIcon}
                    className="size-4 text-muted-foreground"
                    strokeWidth={2}
                  />
                </div>
                <span className="text-sm text-muted-foreground">
                  {t('selectBankLogo')}
                </span>
              </>
            )}
          </button>
        </Field>

        {!account && (
          <Field>
            <FieldLabel htmlFor="initialBalance">{t('initialBalance')}</FieldLabel>
            <CurrencyInput
              id="initialBalance"
              value={initialBalanceCents}
              onChange={setInitialBalanceCents}
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
              <CurrencyInput
                id="creditLimit"
                value={creditLimitCents}
                onChange={setCreditLimitCents}
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

      <BankLogoPicker
        currentLogo={bankLogo}
        open={logoPickerOpen}
        onOpenChange={setLogoPickerOpen}
        onSelect={(logo) => {
          setBankLogo(logo);
          setLogoPickerOpen(false);
        }}
      />
    </form>
  );
}
