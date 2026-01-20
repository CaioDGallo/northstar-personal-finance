'use client';

import { useState, useOptimistic, useTransition, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useLongPress } from '@/lib/hooks/use-long-press';
import { useSwipe } from '@/lib/hooks/use-swipe';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CategoryIcon } from '@/components/icon-picker';
import { markIncomeReceived, markIncomePending, deleteIncome, updateIncomeCategory, toggleIgnoreIncome, setIncomeReplenishment, getReplenishableCategories } from '@/lib/actions/income';
import { useIsMobile } from '@/hooks/use-mobile';
import { CategoryQuickPicker } from '@/components/category-quick-picker';
import { ReplenishmentPicker } from '@/components/replenishment-picker';
import { TransactionDetailSheet } from '@/components/transaction-detail-sheet';
import { EditTransactionDialog } from '@/components/edit-transaction-dialog';
import { SwipeActions } from '@/components/swipe-actions';
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
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon, Clock01Icon, ArrowReloadHorizontalIcon, MoreVerticalIcon } from '@hugeicons/core-free-icons';
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
    ignored: boolean;
    replenishCategoryId: number | null;
    replenishCategoryName: string | null;
    replenishCategoryColor: string | null;
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [replenishPickerOpen, setReplenishPickerOpen] = useState(false);
  const [replenishCategories, setReplenishCategories] = useState<{ id: number; name: string; color: string; icon: string | null }[]>([]);
  const [isPending, startTransition] = useTransition();
  const context = useIncomeContextOptional();
  const router = useRouter();
  const isMobile = useIsMobile();

  const t = useTranslations('income');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

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
      router.refresh();
    }
  };

  const handleMarkPending = async () => {
    if (context) {
      await context.toggleReceived(income.id, income.receivedAt);
    } else {
      await markIncomePending(income.id);
      router.refresh();
    }
  };

  const handleToggleIgnore = async () => {
    if (context) {
      await context.toggleIgnore(income.id);
    } else {
      await toggleIgnoreIncome(income.id);
      router.refresh();
    }
  };

  const handleDelete = async () => {
    setShowDeleteConfirm(false);
    if (context) {
      await context.removeIncome(income.id);
    } else {
      await deleteIncome(income.id);
      router.refresh();
    }
    toast.success(t('incomeDeleted'));
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
      toast.error(tErrors('failedToUpdateCategory'));
    }
  };

  const handleOpenReplenishPicker = async () => {
    const cats = await getReplenishableCategories();
    setReplenishCategories(cats);
    setReplenishPickerOpen(true);
  };

  const handleReplenishmentChange = async (categoryId: number | null) => {
    setReplenishPickerOpen(false);
    await setIncomeReplenishment(income.id, categoryId);
    router.refresh();
    toast.success(t('replenishmentUpdated'));
  };

  const longPressHandlers = useLongPress({
    onLongPress: props.selectionMode ? props.onLongPress : (props.onLongPress || (() => { })),
    onTap: props.selectionMode ? props.onToggleSelection : () => setDetailOpen(true),
    disabled: isOptimistic,
  });

  const stopCardGesture = (event: Event | React.SyntheticEvent) => {
    event.stopPropagation();
  };

  const swipe = useSwipe({
    disabled: props.selectionMode || isOptimistic || !isMobile,
    threshold: 50,
    velocityThreshold: 0.15,
  });

  // Close revealed actions on click outside
  useEffect(() => {
    if (!swipe.isRevealed) return;
    const close = () => swipe.resetSwipe();
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swipe.isRevealed, swipe.resetSwipe, isMobile]);

  // Combined handlers for long-press and swipe
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
        income.ignored && "opacity-50",
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
              if (isReceived) {
                await handleMarkPending();
              } else {
                await handleMarkReceived();
              }
            }}
            onToggleIgnore={async () => {
              swipe.resetSwipe();
              await handleToggleIgnore();
            }}
            isPaid={isReceived}
            isIgnored={income.ignored}
            isIncome={true}
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

          {/* Description + mobile date */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate">{income.description}</h3>
            {/* Replenishment indicator */}
            {income.replenishCategoryId && income.replenishCategoryName && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenReplenishPicker();
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="flex items-center py-1 gap-1 text-blue-600 hover:text-blue-700 transition-colors"
              >
                <div className='flex flex-row gap-1 items-center p-1 px-2 bg-blue-100'>
                  <HugeiconsIcon
                    icon={ArrowReloadHorizontalIcon}
                    className="size-3 text-blue-700"
                    strokeWidth={4}
                  />
                  {income.replenishCategoryName}</div>
              </button>
            )}
            {/* Mobile only: short date */}
            <div className="text-xs text-gray-500 md:hidden">
              {formatDate(income.receivedDate, { day: '2-digit', month: 'short' })}
            </div>
          </div>

          {/* Desktop only: Category + Account */}
          <div className="hidden md:flex items-center gap-1 text-sm text-gray-500 shrink-0 min-w-0">
            <span className="truncate">{optimisticCategory.name}</span>
            <span>•</span>
            <span className="truncate">{income.accountName}</span>
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
            <div className="flex items-center w-full justify-end space-x-2">
              {/* Status icon */}
              <HugeiconsIcon
                icon={isReceived ? Tick02Icon : Clock01Icon}
                className={isReceived ? 'text-green-600' : 'text-gray-400'}
                size={14}
                strokeWidth={2}
                aria-hidden="true"
              />
              {/* Account type icon */}
              <div
                className="size-4 rounded-full flex items-center justify-center"
                style={{ backgroundColor: accountTypeConfig[income.accountType].color }}
                aria-hidden="true"
              >
                <HugeiconsIcon
                  icon={accountTypeConfig[income.accountType].icon}
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
                {isReceived ? (
                  <DropdownMenuItem
                    onClick={handleMarkPending}
                    onSelect={stopCardGesture}
                    onPointerDown={stopCardGesture}
                  >
                    {t('markAsPending')}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onClick={handleMarkReceived}
                    onSelect={stopCardGesture}
                    onPointerDown={stopCardGesture}
                  >
                    {t('markAsReceived')}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleToggleIgnore} onSelect={stopCardGesture} onPointerDown={stopCardGesture}>
                  {income.ignored ? t('showInTotals') : t('hideFromTotals')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setEditOpen(true)}
                  onSelect={stopCardGesture}
                  onPointerDown={stopCardGesture}
                >
                  {tCommon('edit')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setShowDeleteConfirm(true)}
                  onSelect={stopCardGesture}
                  onPointerDown={stopCardGesture}
                >
                  {t('deleteIncome')}
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

      <ReplenishmentPicker
        categories={replenishCategories}
        currentCategoryId={income.replenishCategoryId}
        open={replenishPickerOpen}
        onOpenChange={setReplenishPickerOpen}
        onSelect={handleReplenishmentChange}
        isUpdating={isPending}
      />

      {/* Swipe-to-delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteConfirmationTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteConfirmation', { description: income.description })}
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
