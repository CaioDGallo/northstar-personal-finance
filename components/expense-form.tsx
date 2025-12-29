'use client';

import { useState } from 'react';
import { createExpense, updateExpense } from '@/lib/actions/expenses';
import { displayToCents, centsToDisplay, formatCurrency } from '@/lib/utils';
import type { Account, Category, Transaction, Entry } from '@/lib/schema';
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
import { CategoryIcon } from '@/components/icon-picker';
import { HugeiconsIcon } from '@hugeicons/react';
import { cn } from '@/lib/utils';

type ExpenseFormProps = {
  accounts: Account[];
  categories: Category[];
  transaction?: Transaction & { entries: Entry[] };
  trigger: React.ReactNode;
  onSuccess?: () => void;
};

export function ExpenseForm({ accounts, categories, transaction, trigger, onSuccess }: ExpenseFormProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(
    transaction ? centsToDisplay(transaction.totalAmount) : ''
  );
  const [description, setDescription] = useState(transaction?.description || '');
  const [categoryId, setCategoryId] = useState<number>(
    transaction?.categoryId || categories[0]?.id || 0
  );
  const [accountId, setAccountId] = useState<number>(
    transaction?.entries[0]?.accountId || accounts[0]?.id || 0
  );
  const [dueDate, setDueDate] = useState(
    transaction?.entries[0]?.dueDate || new Date().toISOString().split('T')[0]
  );
  const [installments, setInstallments] = useState(
    transaction?.totalInstallments || 1
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalCents = amount ? displayToCents(amount) : 0;
  const perInstallment = installments > 0 ? totalCents / installments : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const data = {
        description,
        totalAmount: totalCents,
        categoryId,
        accountId,
        dueDate,
        installments,
      };

      if (transaction) {
        await updateExpense(transaction.id, data);
      } else {
        await createExpense(data);
      }

      setOpen(false);
      onSuccess?.();

      // Reset form if creating new
      if (!transaction) {
        setAmount('');
        setDescription('');
        setCategoryId(categories[0]?.id || 0);
        setAccountId(accounts[0]?.id || 0);
        setDueDate(new Date().toISOString().split('T')[0]);
        setInstallments(1);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {transaction ? 'Edit Expense' : 'Add Expense'}
          </AlertDialogTitle>
        </AlertDialogHeader>

        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {/* Amount */}
            <Field>
              <FieldLabel htmlFor="amount">Amount</FieldLabel>
              <InputGroup>
                <InputGroupAddon align="inline-start">
                  <InputGroupText>R$</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  type="number"
                  id="amount"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  placeholder="0.00"
                />
              </InputGroup>
            </Field>

            {/* Description */}
            <Field>
              <FieldLabel htmlFor="description">Description</FieldLabel>
              <Input
                type="text"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="Groceries at Walmart"
              />
            </Field>

            {/* Category */}
            <Field>
              <FieldLabel>Category</FieldLabel>
              <div className="grid grid-cols-4 gap-2">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setCategoryId(category.id)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-md border p-2 transition hover:bg-neutral-50',
                      categoryId === category.id && 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
                    )}
                  >
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full"
                      style={{ backgroundColor: category.color }}
                    >
                      <div className="text-white">
                        <CategoryIcon icon={category.icon as any} />
                      </div>
                    </div>
                    <span className="text-xs font-medium text-center line-clamp-1">
                      {category.name}
                    </span>
                  </button>
                ))}
              </div>
            </Field>

            {/* Account */}
            <Field>
              <FieldLabel htmlFor="account">Account</FieldLabel>
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
            </Field>

            {/* Due Date */}
            <Field>
              <FieldLabel htmlFor="dueDate">Date (first installment)</FieldLabel>
              <Input
                type="date"
                id="dueDate"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </Field>

            {/* Installments */}
            <Field>
              <div className="flex items-center justify-between mb-2">
                <FieldLabel htmlFor="installments">Installments</FieldLabel>
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

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : transaction ? 'Update' : 'Create'}
              </Button>
            </AlertDialogFooter>
          </FieldGroup>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
