'use client';

import { useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { createTransfer, updateTransfer, type CreateTransferData } from '@/lib/actions/transfers';
import type { Account } from '@/lib/schema';
import { centsToDisplay, displayToCents } from '@/lib/utils';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';

const TRANSFER_TYPES: CreateTransferData['type'][] = [
  'internal_transfer',
  'deposit',
  'withdrawal',
  'fatura_payment',
];

type TransferFormTransfer = {
  id: number;
  amount: number;
  date: string;
  type: CreateTransferData['type'];
  description: string | null;
  fromAccountId: number | null;
  toAccountId: number | null;
};

type TransferFormProps = {
  accounts: Account[];
  transfer?: TransferFormTransfer;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
};

export function TransferForm({
  accounts,
  transfer,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onSuccess,
}: TransferFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const t = useTranslations('transfers');
  const tCommon = useTranslations('common');
  const tForm = useTranslations('form');
  const tErrors = useTranslations('errors');

  const amountInputRef = useRef<HTMLInputElement>(null);

  const defaultAccountId = accounts[0]?.id ?? null;
  const fallbackToAccountId = accounts.find((account) => account.id !== defaultAccountId)?.id ?? defaultAccountId ?? null;

  const [type, setType] = useState<CreateTransferData['type']>(transfer?.type || 'internal_transfer');
  const [amount, setAmount] = useState(transfer ? centsToDisplay(transfer.amount) : '');
  const [description, setDescription] = useState(transfer?.description || '');
  const [date, setDate] = useState(
    transfer?.date || new Date().toISOString().split('T')[0]
  );
  const [fromAccountId, setFromAccountId] = useState<number | null>(transfer?.fromAccountId ?? defaultAccountId);
  const [toAccountId, setToAccountId] = useState<number | null>(transfer?.toAccountId ?? fallbackToAccountId);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const typeOptions = useMemo(
    () => TRANSFER_TYPES.map((value) => ({
      value,
      label: t(`types.${value}`),
    })),
    [t]
  );

  const hasAccounts = accounts.length > 0;
  const isInternal = type === 'internal_transfer' || type === 'fatura_payment';
  const showFromAccount = type !== 'deposit';
  const showToAccount = type !== 'withdrawal';
  const totalCents = amount ? displayToCents(amount) : 0;

  const canSubmit =
    totalCents > 0 &&
    hasAccounts &&
    (!showFromAccount || !!fromAccountId) &&
    (!showToAccount || !!toAccountId) &&
    (!isInternal || (fromAccountId !== null && toAccountId !== null && fromAccountId !== toAccountId)) &&
    !isSubmitting;

  const resetForm = () => {
    setType('internal_transfer');
    setAmount('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
    setFromAccountId(defaultAccountId);
    setToAccountId(fallbackToAccountId);
    setFormError(null);
  };

  const handleTypeChange = (value: CreateTransferData['type']) => {
    setType(value);
    setFormError(null);

    if (value === 'deposit') {
      setFromAccountId(null);
      setToAccountId(toAccountId ?? defaultAccountId);
      return;
    }

    if (value === 'withdrawal') {
      setToAccountId(null);
      setFromAccountId(fromAccountId ?? defaultAccountId);
      return;
    }

    const nextFrom = fromAccountId ?? defaultAccountId;
    const nextTo = toAccountId ?? (nextFrom === defaultAccountId ? fallbackToAccountId : defaultAccountId);
    setFromAccountId(nextFrom);
    setToAccountId(nextTo);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    const payload: CreateTransferData = {
      type,
      amount: totalCents,
      date,
      description: description.trim() || undefined,
      fromAccountId: showFromAccount ? fromAccountId ?? undefined : null,
      toAccountId: showToAccount ? toAccountId ?? undefined : null,
    };

    if (isInternal && payload.fromAccountId === payload.toAccountId) {
      setFormError(tErrors('invalidAccountId'));
      setIsSubmitting(false);
      return;
    }

    try {
      if (transfer) {
        await updateTransfer(transfer.id, payload);
      } else {
        await createTransfer(payload);
      }

      setOpen(false);
      onSuccess?.();

      if (!transfer) {
        resetForm();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : tCommon('unexpectedError');
      setFormError(message || tCommon('unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = transfer ? t('editTransfer') : t('addTransfer');

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent
        className="max-w-lg"
        closeOnBackdropClick
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          amountInputRef.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="type">{t('type')}</FieldLabel>
              <Select value={type} onValueChange={(value) => handleTypeChange(value as CreateTransferData['type'])}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {typeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="amount">{tForm('amount')}</FieldLabel>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <InputGroupText>R$</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  ref={amountInputRef}
                  type="number"
                  id="amount"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  placeholder={tForm('amountPlaceholder')}
                />
              </InputGroup>
            </Field>

            <Field>
              <FieldLabel htmlFor="description">{tForm('description')}</FieldLabel>
              <Input
                type="text"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('descriptionPlaceholder')}
              />
            </Field>

            {!hasAccounts && (
              <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                {tForm('noAccounts')}
              </div>
            )}

            {showFromAccount && (
              <Field>
                <FieldLabel htmlFor="fromAccount">{t('fromAccount')}</FieldLabel>
                <Select
                  value={fromAccountId?.toString() || ''}
                  onValueChange={(value) => setFromAccountId(value ? parseInt(value) : null)}
                  disabled={!hasAccounts}
                >
                  <SelectTrigger id="fromAccount">
                    <SelectValue placeholder={t('selectAccount')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}

            {showToAccount && (
              <Field>
                <FieldLabel htmlFor="toAccount">{t('toAccount')}</FieldLabel>
                <Select
                  value={toAccountId?.toString() || ''}
                  onValueChange={(value) => setToAccountId(value ? parseInt(value) : null)}
                  disabled={!hasAccounts}
                >
                  <SelectTrigger id="toAccount">
                    <SelectValue placeholder={t('selectAccount')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="date">{t('date')}</FieldLabel>
              <Input
                type="date"
                id="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>

            {formError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {formError}
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
              <Button type="submit" disabled={!canSubmit}>
                {isSubmitting ? tCommon('saving') : transfer ? tCommon('update') : tCommon('create')}
              </Button>
            </AlertDialogFooter>
          </FieldGroup>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
