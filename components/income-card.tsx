'use client';

import { useState, useOptimistic, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useLongPress } from '@/lib/hooks/use-long-press';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/icon-picker';
import { markIncomeReceived, markIncomePending, deleteIncome, updateIncomeCategory } from '@/lib/actions/income';
import { CategoryQuickPicker } from '@/components/category-quick-picker';
import { TransactionDetailSheet } from '@/components/transaction-detail-sheet';
import { EditTransactionDialog } from '@/components/edit-transaction-dialog';
import { useIncomeContextOptional } from '@/lib/contexts/income-context';
import type { Category, Account } from '@/lib/schema';
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
import { accountTypeConfig } from '@/lib/account-type-config';

type IncomeCardBaseProps = {
  income: {
    id: number;
    description: string;
    amount: number;
    receivedDate: string;
    receivedAt: string | null;
    categoryId: number;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string | null;
    accountId: number;
    accountName: string;
    accountType: 'credit_card' | 'checking' | 'savings' | 'cash';
  };
  categories: Category[];
  accounts: Account[];
  isOptimistic?: boolean;
};

type IncomeCardProps =
  | (IncomeCardBaseProps & {
      selectionMode: false;
      isSelected?: never;
      onLongPress?: () => void;
      onToggleSelection?: never;
    })
  | (IncomeCardBaseProps & {
      selectionMode: true;
      isSelected: boolean;
      onLongPress: () => void;
      onToggleSelection: () => void;
    });

export function IncomeCard(props: IncomeCardProps) {
  const { income, categories, accounts, isOptimistic = false } = props;
  const isReceived = !!income.receivedAt;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const context = useIncomeContextOptional();

  const tCommon = useTranslations('common');

  const [optimisticCategory, setOptimisticCategory] = useOptimistic(
    { id: income.categoryId, color: income.categoryColor, icon: income.categoryIcon, name: income.categoryName },
    (_, newCategory: Category) => ({
      id: newCategory.id,
      color: newCategory.color,
      icon: newCategory.icon,
      name: newCategory.name,
    })
  );

  const handleMarkReceived = async () => {
    if (context) {
      await context.toggleReceived(income.id, income.receivedAt);
    } else {
      await markIncomeReceived(income.id);
    }
  };

  const handleMarkPending = async () => {
    if (context) {
      await context.toggleReceived(income.id, income.receivedAt);
    } else {
      await markIncomePending(income.id);
    }
  };

  const handleDelete = async () => {
    if (context) {
      await context.removeIncome(income.id);
    } else {
      await deleteIncome(income.id);
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
      await updateIncomeCategory(income.id, categoryId);
    } catch {
      toast.error('Failed to update category');
    }
  };

  const longPressHandlers = useLongPress({
    onLongPress: props.selectionMode ? props.onLongPress : (props.onLongPress || (() => {})),
    onTap: props.selectionMode ? props.onToggleSelection : () => setDetailOpen(true),
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
        {/* Checkbox indicator - only shown in selection mode */}
        {props.selectionMode && (
          <div className="absolute -left-1 -top-1 z-10">
            <div className={cn(
              "size-6 rounded-full border-2 flex items-center justify-center transition-all",
              props.isSelected
                ? "bg-primary border-primary"
                : "bg-white border-gray-300"
            )}>
              {props.isSelected && (
                <HugeiconsIcon
                  icon={Tick02Icon}
                  className="size-4 text-white"
                  strokeWidth={3}
                />
              )}
            </div>
          </div>
        )}

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
          </button>

        {/* Description + mobile date */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{income.description}</h3>
          {/* Mobile only: short date */}
          <div className="text-xs text-gray-500 md:hidden">
            {formatDate(income.receivedDate, { day: '2-digit', month: 'short' })}
          </div>
        </div>

        {/* Desktop only: Category + Account */}
        <div className="hidden md:block text-sm text-gray-500 shrink-0">
          {optimisticCategory.name} • {income.accountName}
        </div>

        {/* Desktop only: Full date */}
        <div className="hidden md:block text-sm text-gray-500 shrink-0">
          {formatDate(income.receivedDate)}
        </div>

        {/* Amount + Icons column */}
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <div className="text-sm font-semibold text-green-600">
            +{formatCurrency(income.amount)}
          </div>
          <div className="flex items-center gap-1.5">
            {/* Status icon */}
            <HugeiconsIcon
              icon={isReceived ? Tick02Icon : Clock01Icon}
              className={isReceived ? 'text-green-600' : 'text-gray-400'}
              size={14}
              strokeWidth={2}
            />
            {/* Account type icon */}
            <div
              className="size-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: accountTypeConfig[income.accountType].color }}
            >
              <HugeiconsIcon
                icon={accountTypeConfig[income.accountType].icon}
                size={10}
                className="text-white"
                strokeWidth={2}
              />
            </div>
            {/* Placeholder for third icon */}
            <div className="size-4 rounded-full bg-gray-200" />
          </div>
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isReceived ? (
              <DropdownMenuItem onClick={handleMarkPending}>
                Mark as Pending
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={handleMarkReceived}>
                Mark as Received
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              {tCommon('edit')}
            </DropdownMenuItem>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  Delete Income
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete income?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete &quot;{income.description}&quot;. This action cannot be undone.
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
        income={income}
        accounts={accounts}
        categories={categories}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <EditTransactionDialog
        mode="income"
        income={income}
        accounts={accounts}
        categories={categories}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
