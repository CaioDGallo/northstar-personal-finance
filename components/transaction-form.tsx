'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { createExpense, updateExpense } from '@/lib/actions/expenses';
import { createIncome, updateIncome } from '@/lib/actions/income';
import { useExpenseContextOptional } from '@/lib/contexts/expense-context';
import { useIncomeContextOptional } from '@/lib/contexts/income-context';
import { displayToCents, centsToDisplay, formatCurrency } from '@/lib/utils';
import type { Account, Category, Transaction, Entry, Income } from '@/lib/schema';
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
import { Slider } from '@/components/ui/slider';
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from '@/components/ui/input-group';
import { CategorySelect } from '@/components/category-select';

type TransactionFormProps = {
  mode: 'expense' | 'income';
  accounts: Account[];
  categories: Category[];
  transaction?: Transaction & { entries: Entry[] };
  income?: Pick<Income, 'id' | 'description' | 'amount' | 'categoryId' | 'accountId' | 'receivedDate'>;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
};

export function TransactionForm({
  mode,
  accounts,
  categories,
  transaction,
  income,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onSuccess,
}: TransactionFormProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const t = useTranslations('form');
  const tCommon = useTranslations('common');
  const tExpenses = useTranslations('expenses');
  const tIncome = useTranslations('income');

  const expenseContext = useExpenseContextOptional();
  const incomeContext = useIncomeContextOptional();

  const existingData = mode === 'expense' ? transaction : income;
  const [amount, setAmount] = useState(
    existingData
      ? centsToDisplay(mode === 'expense' ? (transaction?.totalAmount ?? 0) : (income?.amount ?? 0))
      : ''
  );
  const [description, setDescription] = useState(existingData?.description || '');
  const [categoryId, setCategoryId] = useState<number>(
    existingData?.categoryId || categories[0]?.id || 0
  );
  const [accountId, setAccountId] = useState<number>(
    mode === 'expense'
      ? (transaction?.entries[0]?.accountId || accounts[0]?.id || 0)
      : (income?.accountId || accounts[0]?.id || 0)
  );
  const [date, setDate] = useState(
    mode === 'expense'
      ? (transaction?.entries[0]?.purchaseDate || new Date().toISOString().split('T')[0])
      : (income?.receivedDate || new Date().toISOString().split('T')[0])
  );
  const [installments, setInstallments] = useState(
    transaction?.totalInstallments || 1
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amountInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Small delay to ensure modal animation completes
      const timer = setTimeout(() => {
        amountInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const totalCents = amount ? displayToCents(amount) : 0;
  const perInstallment = installments > 0 ? totalCents / installments : 0;

  const hasCategories = categories.length > 0;
  const hasAccounts = accounts.length > 0;
  const canSubmit = hasCategories && hasAccounts && !isSubmitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (mode === 'expense') {
        const data = {
          description,
          totalAmount: totalCents,
          categoryId,
          accountId,
          purchaseDate: date,
          installments,
        };

        if (transaction) {
          await updateExpense(transaction.id, data);
        } else {
          // Use optimistic context if available (on expense page)
          if (expenseContext) {
            const category = categories.find((c) => c.id === categoryId);
            const account = accounts.find((a) => a.id === accountId);

            await expenseContext.addExpense({
              ...data,
              categoryName: category?.name || '',
              categoryColor: category?.color || '#000000',
              categoryIcon: category?.icon || null,
              accountName: account?.name || '',
            });
          } else {
            await createExpense(data);
          }
        }
      } else {
        const data = {
          description,
          amount: totalCents,
          categoryId,
          accountId,
          receivedDate: date,
        };

        if (income) {
          await updateIncome(income.id, data);
        } else {
          // Use optimistic context if available (on income page)
          if (incomeContext) {
            const category = categories.find((c) => c.id === categoryId);
            const account = accounts.find((a) => a.id === accountId);

            await incomeContext.addIncome({
              ...data,
              categoryName: category?.name || '',
              categoryColor: category?.color || '#000000',
              categoryIcon: category?.icon || null,
              accountName: account?.name || '',
            });
          } else {
            await createIncome(data);
          }
        }
      }

      setOpen(false);
      onSuccess?.();

      // Reset form if creating new
      if (!existingData) {
        setAmount('');
        setDescription('');
        setCategoryId(categories[0]?.id || 0);
        setAccountId(accounts[0]?.id || 0);
        setDate(new Date().toISOString().split('T')[0]);
        if (mode === 'expense') {
          setInstallments(1);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const title = existingData
    ? mode === 'expense'
      ? tExpenses('editExpense')
      : tIncome('editIncome')
    : mode === 'expense'
      ? tExpenses('addExpense')
      : tIncome('addIncome');

  const dateLabel = mode === 'expense' ? t('purchaseDate') : t('receivedDate');
  const descriptionPlaceholder = mode === 'expense'
    ? t('descriptionPlaceholder.expense')
    : t('descriptionPlaceholder.income');

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent className="max-w-lg" closeOnBackdropClick>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {/* Amount */}
            <Field>
              <FieldLabel htmlFor="amount">{t('amount')}</FieldLabel>
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
                  placeholder={t('amountPlaceholder')}
                />
              </InputGroup>
            </Field>

            {/* Description */}
            <Field>
              <FieldLabel htmlFor="description">{t('description')}</FieldLabel>
              <Input
                type="text"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder={descriptionPlaceholder}
              />
            </Field>

            {/* Category */}
            <Field>
              <FieldLabel>{t('category')}</FieldLabel>
              {hasCategories ? (
                <CategorySelect
                  categories={categories}
                  value={categoryId}
                  onChange={setCategoryId}
                />
              ) : (
                <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  {mode === 'expense' ? t('noExpenseCategories') : t('noIncomeCategories')}
                </div>
              )}
            </Field>

            {/* Account */}
            <Field>
              <FieldLabel htmlFor="account">{t('account')}</FieldLabel>
              {hasAccounts ? (
                <Select
                  value={accountId.toString()}
                  onValueChange={(value) => setAccountId(parseInt(value))}
                >
                  <SelectTrigger id="account">
                    <SelectValue />
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
              ) : (
                <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  {t('noAccounts')}
                </div>
              )}
            </Field>

            {/* Date */}
            <Field>
              <FieldLabel htmlFor="date">{dateLabel}</FieldLabel>
              <Input
                type="date"
                id="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>

            {/* Installments (expense only) */}
            {mode === 'expense' && (
              <Field>
                <div className="flex items-center justify-between mb-2">
                  <FieldLabel htmlFor="installments">{t('installments')}</FieldLabel>
                  {installments > 1 && (
                    <span className="text-xs text-neutral-500">
                      {installments}x de {formatCurrency(perInstallment)}
                    </span>
                  )}
                </div>
                <Slider
                  id="installments"
                  min={1}
                  max={24}
                  step={1}
                  value={[installments]}
                  onValueChange={(value) => setInstallments(value[0])}
                />
                <div className="flex justify-between text-xs text-neutral-500 mt-1">
                  <span>1x</span>
                  <span>{installments}x</span>
                  <span>24x</span>
                </div>
              </Field>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
              <Button type="submit" disabled={!canSubmit}>
                {isSubmitting ? tCommon('saving') : existingData ? tCommon('update') : tCommon('create')}
              </Button>
            </AlertDialogFooter>
          </FieldGroup>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
