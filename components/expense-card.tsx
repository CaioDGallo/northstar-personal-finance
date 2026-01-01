'use client';

import { useState, useOptimistic, useTransition } from 'react';
import { useLongPress } from '@/lib/hooks/use-long-press';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/icon-picker';
import { markEntryPaid, markEntryPending, deleteExpense, updateTransactionCategory } from '@/lib/actions/expenses';
import { CategoryQuickPicker } from '@/components/category-quick-picker';
import { TransactionDetailSheet } from '@/components/transaction-detail-sheet';
import { useExpenseContextOptional } from '@/lib/contexts/expense-context';
import type { Category } from '@/lib/schema';
import { toast } from 'sonner';
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
import { HugeiconsIcon } from '@hugeicons/react';
import { MoreVerticalIcon, Tick02Icon, Clock01Icon } from '@hugeicons/core-free-icons';

type ExpenseCardBaseProps = {
  entry: {
    id: number;
    amount: number;
    purchaseDate: string;
    faturaMonth: string;
    dueDate: string;
    paidAt: string | null;
    installmentNumber: number;
    transactionId: number;
    description: string;
    totalInstallments: number;
    categoryId: number;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string | null;
    accountId: number;
    accountName: string;
  };
  categories: Category[];
  isOptimistic?: boolean;
};

type ExpenseCardProps =
  | (ExpenseCardBaseProps & {
    selectionMode: false;
    isSelected?: never;
    onLongPress?: () => void;
    onToggleSelection?: never;
  })
  | (ExpenseCardBaseProps & {
    selectionMode: true;
    isSelected: boolean;
    onLongPress: () => void;
    onToggleSelection: () => void;
  });

export function ExpenseCard(props: ExpenseCardProps) {
  const { entry, categories, isOptimistic = false } = props;
  const isPaid = !!entry.paidAt;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const context = useExpenseContextOptional();

  const [optimisticCategory, setOptimisticCategory] = useOptimistic(
    { id: entry.categoryId, color: entry.categoryColor, icon: entry.categoryIcon, name: entry.categoryName },
    (_, newCategory: Category) => ({
      id: newCategory.id,
      color: newCategory.color,
      icon: newCategory.icon,
      name: newCategory.name,
    })
  );

  const handleMarkPaid = async () => {
    if (context) {
      await context.togglePaid(entry.id, entry.paidAt);
    } else {
      await markEntryPaid(entry.id);
    }
  };

  const handleMarkPending = async () => {
    if (context) {
      await context.togglePaid(entry.id, entry.paidAt);
    } else {
      await markEntryPending(entry.id);
    }
  };

  const handleDelete = async () => {
    if (context) {
      await context.removeExpense(entry.transactionId);
    } else {
      await deleteExpense(entry.transactionId);
    }
  };

  const handleCategoryChange = async (categoryId: number) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) return;

    setPickerOpen(false);
    startTransition(() => {
      setOptimisticCategory(category);
    });

    try {
      await updateTransactionCategory(entry.transactionId, categoryId);
    } catch {
      toast.error('Failed to update category');
    }
  };

  const longPressHandlers = useLongPress({
    onLongPress: props.selectionMode ? props.onLongPress : (props.onLongPress || (() => { })),
    onTap: props.selectionMode ? props.onToggleSelection : undefined,
    disabled: !props.selectionMode && !props.onLongPress,
  });

  return (
    <>
      <Card className={cn(
        "py-0 relative",
        isOptimistic && "opacity-70 animate-pulse",
        props.selectionMode && "cursor-pointer",
        props.selectionMode && props.isSelected && "ring-2 ring-primary ring-offset-2"
      )}>
        <CardContent {...longPressHandlers} className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3">
          {/* Category icon - clickable */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (props.selectionMode) {
                props.onToggleSelection();
              } else {
                setPickerOpen(true);
              }
            }}
            className="size-10 shrink-0 rounded-full flex items-center justify-center text-white cursor-pointer transition-all hover:ring-2 hover:ring-offset-2 hover:ring-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
            style={{ backgroundColor: optimisticCategory.color }}
          >
            <CategoryIcon icon={optimisticCategory.icon} />
            {/* Checkbox indicator - only shown in selection mode */}
            {props.selectionMode && (
              <div className="absolute z-10">
                <div className={cn(
                  "size-10 rounded-full border-2 flex items-center justify-center transition-all",
                  props.isSelected
                    ? "bg-primary/85 border-green-600"
                    : "bg-gray-100/70 border-gray-500"
                )}>
                  {props.isSelected && (
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      className="size-4 text-green-600"
                      strokeWidth={4}
                    />
                  )}
                </div>
              </div>
            )}
          </button>

          {/* Description + installment badge + mobile date */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm truncate">{entry.description}</h3>
              {entry.totalInstallments > 1 && (
                <Badge variant="secondary" className="shrink-0">
                  {entry.installmentNumber}/{entry.totalInstallments}
                </Badge>
              )}
            </div>
            {/* Mobile only: short date */}
            <div className="text-xs text-gray-500 md:hidden">
              {formatDate(entry.dueDate, { day: '2-digit', month: 'short' })}
            </div>
          </div>

          {/* Desktop only: Category + Account */}
          <div className="hidden md:block text-sm text-gray-500 shrink-0">
            {optimisticCategory.name} • {entry.accountName}
          </div>

          {/* Desktop only: Full date */}
          <div className="hidden md:block text-sm text-gray-500 shrink-0">
            {formatDate(entry.dueDate)}
          </div>

          {/* Amount */}
          <div className="text-sm font-semibold shrink-0">
            {formatCurrency(entry.amount)}
          </div>

          {/* Status: icon always, text on desktop */}
          <div className="flex items-center gap-1.5 shrink-0">
            <HugeiconsIcon
              icon={isPaid ? Tick02Icon : Clock01Icon}
              className={isPaid ? 'text-green-600' : 'text-gray-400'}
              size={18}
              strokeWidth={2}
            />
            <span className={`hidden md:inline text-sm ${isPaid ? 'text-green-600' : 'text-gray-500'}`}>
              {isPaid ? 'Paid' : 'Pending'}
            </span>
          </div>

          {/* Actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8">
                <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setDetailOpen(true)}>
                View Details
              </DropdownMenuItem>
              {isPaid ? (
                <DropdownMenuItem onClick={handleMarkPending}>
                  Mark as Pending
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={handleMarkPaid}>
                  Mark as Paid
                </DropdownMenuItem>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    Delete Transaction
                  </DropdownMenuItem>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will delete all {entry.totalInstallments} installment
                      {entry.totalInstallments > 1 ? 's' : ''} for &quot;{entry.description}&quot;.
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>

      <CategoryQuickPicker
        categories={categories}
        currentCategoryId={optimisticCategory.id}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handleCategoryChange}
        isUpdating={isPending}
      />

      <TransactionDetailSheet
        expense={entry}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </>
  );
}
