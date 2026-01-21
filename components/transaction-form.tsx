'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { createExpense, updateExpense } from '@/lib/actions/expenses';
import { createIncome, updateIncome } from '@/lib/actions/income';
import { useExpenseContextOptional } from '@/lib/contexts/expense-context';
import { useIncomeContextOptional } from '@/lib/contexts/income-context';
import { formatCurrency } from '@/lib/utils';
import type { Account, Category, Transaction, Entry, Income } from '@/lib/schema';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { CurrencyInputGroupInput } from '@/components/ui/currency-input';
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
  const [amountCents, setAmountCents] = useState(
    existingData
      ? (mode === 'expense' ? (transaction?.totalAmount ?? 0) : (income?.amount ?? 0))
      : 0
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

  const totalCents = amountCents;
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
              accountType: account?.type || 'checking',
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
              accountType: account?.type || 'checking',
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
        setAmountCents(0);
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
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>}
      <SheetContent
        side="bottom"
        className="max-h-[80vh] p-0 flex flex-col"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          amountInputRef.current?.focus();
        }}
      >
        <SheetHeader className="border-b border-border/60 bg-muted/70 dark:bg-muted/20 px-4 py-3">
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
            <SheetTitle className="text-start text-sm font-semibold">{title}</SheetTitle>
            <div className="flex items-center gap-2">
              <span
                className="size-4 rounded-full border border-green-700 bg-green-500 shadow-[1px_1px_0px_rgba(0,0,0,0.6)]"
                aria-hidden
              />
              <span
                className="size-4 rounded-full border border-amber-600 bg-amber-400 shadow-[1px_1px_0px_rgba(0,0,0,0.6)]"
                aria-hidden
              />
              <SheetClose asChild>
                <button
                  type="button"
                  className="group size-4 rounded-full border border-red-700 bg-red-500 text-[10px] font-bold text-red-950 shadow-[1px_1px_0px_rgba(0,0,0,0.6)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                  aria-label={tCommon('close')}
                >
                  <span className="relative block -mt-px text-white leading-none opacity-80 group-hover:opacity-100">
                    <span className='w-14 h-10 absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2' />
                    x
                  </span>
                </button>
              </SheetClose>
            </div>
          </div>
          <SheetDescription className="sr-only">
            {t('dialogDescription')}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex bg-muted/20 dark:bg-muted flex-1 flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-4">
            <FieldGroup>
              {/* Amount */}
              <Field>
                <FieldLabel htmlFor="amount">{t('amount')}</FieldLabel>
                <CurrencyInputGroupInput
                  ref={amountInputRef}
                  id="amount"
                  name="amount"
                  value={amountCents}
                  onChange={setAmountCents}
                  required
                  placeholder={t('amountPlaceholder')}
                  autoComplete="transaction-amount"
                />
              </Field>

              {/* Description */}
              <Field>
                <FieldLabel htmlFor="description">{t('description')}</FieldLabel>
                <Input
                  type="text"
                  id="description"
                  name="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  placeholder={descriptionPlaceholder}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>

              {/* Category */}
              <Field>
                <FieldLabel htmlFor="category">{t('category')}</FieldLabel>
                {hasCategories ? (
                  <CategorySelect
                    categories={categories}
                    value={categoryId}
                    onChange={setCategoryId}
                    triggerId="category"
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
                  name="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  autoComplete="transaction-date"
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
            </FieldGroup>
          </div>

          <SheetFooter className="border-t border-border/60 bg-muted/70 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <SheetClose asChild>
              <Button type="button" variant="outline">
                {tCommon('cancel')}
              </Button>
            </SheetClose>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? tCommon('saving') : existingData ? tCommon('update') : tCommon('create')}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
