'use client';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CategoryIcon } from '@/components/icon-picker';
import { formatCurrency, formatDate } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon, Clock01Icon } from '@hugeicons/core-free-icons';
import type { ExpenseEntry } from '@/lib/contexts/expense-context';
import type { IncomeEntry } from '@/lib/contexts/income-context';

type TransactionDetailSheetProps = {
  expense?: ExpenseEntry;
  income?: IncomeEntry;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TransactionDetailSheet({ expense, income, open, onOpenChange }: TransactionDetailSheetProps) {
  const isExpense = !!expense;
  const data = expense || income;

  if (!data) return null;

  const isPaidOrReceived = isExpense ? !!expense.paidAt : !!income?.receivedAt;
  const statusLabel = isExpense
    ? (isPaidOrReceived ? 'Paid' : 'Pending')
    : (isPaidOrReceived ? 'Received' : 'Pending');

  const dateLabel = isExpense ? 'Due Date' : 'Received Date';
  const dateValue = isExpense ? expense.dueDate : income?.receivedDate;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70vh] flex flex-col">
        <SheetHeader className="pb-4">
          {/* Large category icon + description */}
          <div className="flex items-center gap-4">
            <div
              className="size-16 rounded-full flex items-center justify-center text-white shrink-0 text-2xl"
              style={{ backgroundColor: data.categoryColor }}
            >
              <CategoryIcon icon={data.categoryIcon} />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl truncate">{data.description}</SheetTitle>
              <p className="text-sm text-muted-foreground">{data.categoryName}</p>
            </div>
          </div>
        </SheetHeader>

        {/* Detail rows - scrollable */}
        <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <div className="space-y-3 p-4">
            {/* Amount */}
            <DetailRow
              label="Amount"
              value={
                <span className={isExpense ? 'font-semibold' : 'font-semibold text-green-600'}>
                  {isExpense ? '' : '+'}
                  {formatCurrency(data.amount)}
                </span>
              }
            />

            {/* Status */}
            <DetailRow
              label="Status"
              value={
                <div className="flex items-center gap-2">
                  <HugeiconsIcon
                    icon={isPaidOrReceived ? Tick02Icon : Clock01Icon}
                    className={isPaidOrReceived ? 'text-green-600' : 'text-gray-400'}
                    size={18}
                    strokeWidth={2}
                  />
                  <span className={isPaidOrReceived ? 'text-green-600' : 'text-gray-500'}>
                    {statusLabel}
                  </span>
                </div>
              }
            />

            {/* Category */}
            <DetailRow label="Category" value={data.categoryName} />

            {/* Account */}
            <DetailRow label="Account" value={data.accountName} />

            {/* Date */}
            <DetailRow
              label={dateLabel}
              value={formatDate(dateValue || '', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            />

            {/* Expense-specific fields */}
            {isExpense && expense && (
              <>
                {/* Purchase Date (show only if different from due date) */}
                {expense.purchaseDate !== expense.dueDate && (
                  <DetailRow
                    label="Purchase Date"
                    value={formatDate(expense.purchaseDate, {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  />
                )}

                {/* Fatura Month */}
                <DetailRow
                  label="Fatura"
                  value={formatDate(expense.faturaMonth + '-01', {
                    month: 'long',
                    year: 'numeric',
                  })}
                />

                {/* Installment info */}
                {expense.totalInstallments > 1 && (
                  <DetailRow
                    label="Installment"
                    value={
                      <Badge variant="secondary">
                        {expense.installmentNumber} of {expense.totalInstallments}
                      </Badge>
                    }
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer buttons */}
        <SheetFooter className="flex-col gap-2 sm:flex-col pt-4">
          {/* View All Installments - only for multi-installment expenses */}
          {isExpense && expense && expense.totalInstallments > 1 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                // TODO: Navigate to filtered expense list
                console.log('View all installments for transaction:', expense.transactionId);
              }}
            >
              View All {expense.totalInstallments} Installments
            </Button>
          )}

          {/* Edit button */}
          <Button
            variant="default"
            className="w-full"
            onClick={() => {
              // TODO: Open edit form
              console.log('Edit transaction:', data);
            }}
          >
            Edit
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// Helper component for detail rows
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
