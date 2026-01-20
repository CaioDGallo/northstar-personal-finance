'use client';

import { useState, useOptimistic, useTransition, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLongPress } from '@/lib/hooks/use-long-press';
import { useSwipe } from '@/lib/hooks/use-swipe';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { triggerHaptic, HapticPatterns } from '@/lib/utils/haptics';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/icon-picker';
import { useIsMobile } from '@/hooks/use-mobile';
import { markEntryPaid, markEntryPending, deleteExpense, updateTransactionCategory } from '@/lib/actions/expenses';
import { CategoryQuickPicker } from '@/components/category-quick-picker';
import { TransactionDetailSheet } from '@/components/transaction-detail-sheet';
import { EditTransactionDialog } from '@/components/edit-transaction-dialog';
import { ConvertToFaturaDialog } from '@/components/convert-to-fatura-dialog';
import { SwipeActions } from '@/components/swipe-actions';
import { useExpenseContextOptional } from '@/lib/contexts/expense-context';
import type { Category, Account } from '@/lib/schema';
import type { UnpaidFatura } from '@/lib/actions/faturas';
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
    accountType: 'credit_card' | 'checking' | 'savings' | 'cash';
    ignored: boolean;
  };
  categories: Category[];
  accounts: Account[];
  unpaidFaturas?: UnpaidFatura[];
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
  const { entry, categories, accounts, unpaidFaturas = [], isOptimistic = false } = props;
  const isPaid = !!entry.paidAt;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const context = useExpenseContextOptional();
  const router = useRouter();
  const isMobile = useIsMobile();

  // Check if expense can be converted to fatura payment
  const canConvertToFatura = entry.accountType !== 'credit_card' && entry.totalInstallments === 1 && unpaidFaturas.length > 0;

  // Swipe gesture to reveal actions (disabled in selection mode)
  const swipe = useSwipe({
    disabled: props.selectionMode || isOptimistic || !isMobile,
    threshold: 50,
    velocityThreshold: 0.15,
  });

  const t = useTranslations('expenses');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

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
      router.refresh();
    }
  };

  const handleMarkPending = async () => {
    if (context) {
      await context.togglePaid(entry.id, entry.paidAt);
    } else {
      await markEntryPending(entry.id);
      router.refresh();
    }
  };

  const handleToggleIgnore = async () => {
    if (context) {
      await context.toggleIgnore(entry.transactionId);
    } else {
      // Fallback: call server action directly if no context
      const { toggleIgnoreTransaction } = await import('@/lib/actions/expenses');
      await toggleIgnoreTransaction(entry.transactionId);
      router.refresh();
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    triggerHaptic(HapticPatterns.medium);

    // Store the transaction data for potential undo
    const transactionId = entry.transactionId;

    // Optimistically remove from UI
    if (context) {
      await context.removeExpense(transactionId);
    } else {
      await deleteExpense(transactionId);
      router.refresh();
    }

    // Show undo toast
    toast.success(t('expenseDeleted'), {
      duration: 5000,
    });
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
      toast.error(tErrors('failedToUpdateCategory'));
    }
  };

  const longPressHandlers = useLongPress({
    onLongPress: props.selectionMode ? props.onLongPress : (props.onLongPress || (() => { })),
    onTap: props.selectionMode ? props.onToggleSelection : () => setDetailOpen(true),
    disabled: isOptimistic,
  });

  const stopCardGesture = (event: Event | React.SyntheticEvent) => {
    event.stopPropagation();
  };

  // Close revealed actions on click outside
  useEffect(() => {
    if (!swipe.isRevealed) return;
    const close = () => swipe.resetSwipe();
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipe.isRevealed, swipe.resetSwipe, isMobile]);

  // Merge gesture handlers without override
  const combinedHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      longPressHandlers.onPointerDown(e);
      if (!props.selectionMode && !isOptimistic) {
        swipe.handlers.onPointerDown(e);
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      longPressHandlers.onPointerMove(e);
      if (!props.selectionMode && !isOptimistic) {
        swipe.handlers.onPointerMove(e);
      }
    },
    onPointerUp: (e: React.PointerEvent) => {
      longPressHandlers.onPointerUp(e);
      if (!props.selectionMode && !isOptimistic) {
        swipe.handlers.onPointerUp(e);
      }
    },
    onPointerCancel: () => {
      longPressHandlers.onPointerCancel();
      if (!props.selectionMode && !isOptimistic) {
        swipe.handlers.onPointerCancel();
      }
    },
    onPointerLeave: () => {
      longPressHandlers.onPointerLeave();
      if (!props.selectionMode && !isOptimistic) {
        swipe.handlers.onPointerLeave();
      }
    },
  };

  // Support Shift+Click to enter selection mode (keyboard accessible)
  const handleCardClick = (e: React.MouseEvent) => {
    if (!props.selectionMode && e.shiftKey && props.onLongPress) {
      e.preventDefault();
      props.onLongPress();
    }
  };

  return (
    <>
      <Card className={cn(
        "py-0 relative overflow-hidden",
        isOptimistic && "opacity-70 animate-pulse",
        entry.ignored && "opacity-50",
        props.selectionMode && "cursor-pointer",
        props.selectionMode && props.isSelected && "ring-2 ring-primary ring-offset-2"
      )}>
        {/* Swipe actions revealed on swipe (mobile only) */}
        {isMobile && (swipe.isSwiping || swipe.isRevealed) && swipe.swipeOffset < 0 && (
          <SwipeActions
            onDelete={() => {
              swipe.resetSwipe();
              setShowDeleteConfirm(true);
            }}
            onTogglePaid={async () => {
              swipe.resetSwipe();
              if (isPaid) {
                await handleMarkPending();
              } else {
                await handleMarkPaid();
              }
            }}
            onToggleIgnore={async () => {
              swipe.resetSwipe();
              await handleToggleIgnore();
            }}
            isPaid={isPaid}
            isIgnored={entry.ignored}
          />
        )}

        <CardContent
          {...combinedHandlers}
          onClick={handleCardClick}
          className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3 relative bg-card select-none touch-pan-y"
          style={{
            transform: isMobile && swipe.swipeOffset < 0 ? `translateX(${swipe.swipeOffset}px)` : undefined,
            transition: swipe.isSwiping ? 'none' : 'transform 0.2s ease-out',
          }}
        >
          {/* Category icon - clickable */}
          <button
            type="button"
            aria-label={props.selectionMode ? t('selected') : t('changeCategory')}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (props.selectionMode) {
                props.onToggleSelection();
              } else {
                setPickerOpen(true);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (props.selectionMode) {
                  props.onToggleSelection();
                } else {
                  setPickerOpen(true);
                }
              }
            }}
            className="size-10 shrink-0 rounded-full flex items-center justify-center text-white cursor-pointer transition-all hover:ring-2 hover:ring-offset-2 hover:ring-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary touch-manipulation"
            style={{ backgroundColor: optimisticCategory.color }}
          >
            <span className='size-16 absolute' />
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
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-medium text-sm truncate">{entry.description}</h3>
              {entry.totalInstallments > 1 && (
                <Badge variant="secondary" className="shrink-0">
                  {entry.installmentNumber}/{entry.totalInstallments}
                </Badge>
              )}
            </div>
            {/* Mobile only: Category • Account */}
            <div className="flex items-center gap-1 text-xs text-gray-500 md:hidden min-w-0">
              <span className="truncate">{optimisticCategory.name}</span>
              <span className="shrink-0">•</span>
              <span className="shrink-0">{entry.accountName}</span>
            </div>
          </div>

          {/* Desktop only: Category + Account */}
          <div className="hidden md:flex items-center gap-1 text-sm text-gray-500 shrink-0 min-w-0">
            <span className="truncate">{optimisticCategory.name}</span>
            <span>•</span>
            <span className="truncate">{entry.accountName}</span>
          </div>

          {/* Desktop only: Full date */}
          <div className="hidden md:block text-sm text-gray-500 shrink-0">
            {formatDate(entry.dueDate)}
          </div>

          {/* Amount + Icons column */}
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            <div className="text-sm font-semibold">{formatCurrency(entry.amount)}</div>
            <div className="flex items-center w-full justify-end space-x-2">
              {/* Status icon */}
              <HugeiconsIcon
                icon={isPaid ? Tick02Icon : Clock01Icon}
                className={isPaid ? 'text-green-600' : 'text-gray-400'}
                size={14}
                strokeWidth={2}
                aria-hidden="true"
              />
              {/* Account type icon */}
              <div
                className="size-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: accountTypeConfig[entry.accountType].color }}
                aria-hidden="true"
              >
                <HugeiconsIcon
                  icon={accountTypeConfig[entry.accountType].icon}
                  size={10}
                  className="text-white"
                  strokeWidth={2}
                />
              </div>
            </div>
          </div>

          {!isMobile && (
            <div className="hidden md:block">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 md:size-8 touch-manipulation"
                    onPointerDown={(e) => e.stopPropagation()}
                    aria-label="Abrir menu de ações"
                  >
                    <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onPointerDown={stopCardGesture}>
                <DropdownMenuItem
                  onClick={() => setDetailOpen(true)}
                  onSelect={stopCardGesture}
                  onPointerDown={stopCardGesture}
                >
                  {t('viewDetails')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setEditOpen(true)}
                  onSelect={stopCardGesture}
                  onPointerDown={stopCardGesture}
                >
                  {tCommon('edit')}
                </DropdownMenuItem>
                {isPaid ? (
                  <DropdownMenuItem
                    onClick={handleMarkPending}
                    onSelect={stopCardGesture}
                    onPointerDown={stopCardGesture}
                  >
                    {t('markAsPending')}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={handleMarkPaid}
                    onSelect={stopCardGesture}
                    onPointerDown={stopCardGesture}
                  >
                    {t('markAsPaid')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleToggleIgnore} onSelect={stopCardGesture} onPointerDown={stopCardGesture}>
                  {entry.ignored ? t('showInTotals') : t('hideFromTotals')}
                </DropdownMenuItem>
                {canConvertToFatura && (
                  <DropdownMenuItem
                    onClick={() => setConvertDialogOpen(true)}
                    onSelect={stopCardGesture}
                    onPointerDown={stopCardGesture}
                  >
                    {t('convertToFaturaPayment')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={() => setShowDeleteConfirm(true)}
                  onSelect={stopCardGesture}
                  onPointerDown={stopCardGesture}
                >
                  {t('deleteTransaction')}
                </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

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
        accounts={accounts}
        categories={categories}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        unpaidFaturas={unpaidFaturas}
        canConvertToFatura={canConvertToFatura}
        onConvertToFatura={() => setConvertDialogOpen(true)}
      />

      <EditTransactionDialog
        mode="expense"
        transactionId={entry.transactionId}
        accounts={accounts}
        categories={categories}
        open={editOpen}
        onOpenChange={setEditOpen}
      />

      {canConvertToFatura && (
        <ConvertToFaturaDialog
          entry={{
            id: entry.id,
            amount: entry.amount,
            description: entry.description,
            purchaseDate: entry.purchaseDate,
          }}
          unpaidFaturas={unpaidFaturas}
          open={convertDialogOpen}
          onOpenChange={setConvertDialogOpen}
          onSuccess={() => {
            if (context) {
              context.removeExpense(entry.transactionId);
            }
          }}
        />
      )}

      {/* Delete confirmation dialog (triggered by swipe or menu) */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirmationTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirmation', { count: entry.totalInstallments, description: entry.description })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{tCommon('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
