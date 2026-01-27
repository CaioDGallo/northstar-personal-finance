'use client';

import { createContext, useContext, useOptimistic, useCallback, startTransition, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Account, Category } from '@/lib/schema';
import type { UnpaidFatura } from '@/lib/actions/faturas';
import type { RecentAccount } from '@/lib/actions/accounts';
import type { RecentCategory } from '@/lib/actions/categories';
import {
  createExpense as serverCreateExpense,
  deleteExpense as serverDeleteExpense,
  markEntryPaid as serverMarkEntryPaid,
  markEntryPending as serverMarkEntryPending,
  bulkUpdateTransactionCategories as serverBulkUpdateTransactionCategories,
  toggleIgnoreTransaction as serverToggleIgnoreTransaction,
  type ExpenseFilters,
} from '@/lib/actions/expenses';
import { centsToDisplay } from '@/lib/utils';

// Expense entry shape (from getExpenses return type)
export type ExpenseEntry = {
  id: number;
  amount: number;
  purchaseDate: string;
  faturaMonth: string;
  dueDate: string;
  paidAt: string | null;
  installmentNumber: number;
  transactionId: number;
  description: string | null;
  totalInstallments: number;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  accountId: number;
  accountName: string;
  accountType: 'credit_card' | 'checking' | 'savings' | 'cash';
  bankLogo: string | null;
  ignored: boolean;
  totalAmount: number; // Total amount of the transaction (cents)
  refundedAmount?: number | null; // Total refunded amount (cents)
  isFullyRefunded?: boolean; // True if completely refunded
};

// Optimistic item wrapper
export type OptimisticExpenseEntry = ExpenseEntry & {
  _optimistic?: boolean;
  _tempId?: string;
};

// Input for creating expense
export type CreateExpenseInput = {
  description?: string;
  totalAmount: number; // cents
  categoryId: number;
  accountId: number;
  purchaseDate: string; // 'YYYY-MM-DD'
  installments: number;
  // Metadata for optimistic UI
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  accountName: string;
  accountType: 'credit_card' | 'checking' | 'savings' | 'cash';
  bankLogo: string | null;
};

// Reducer actions
type ReducerAction =
  | { type: 'reset'; items: OptimisticExpenseEntry[] }
  | { type: 'add'; items: OptimisticExpenseEntry[] }
  | { type: 'toggle'; id: number; paidAt: string | null }
  | { type: 'remove'; transactionId: number }
  | { type: 'bulkUpdateCategory'; transactionIds: number[]; category: Category }
  | { type: 'toggleIgnore'; transactionId: number };

// Reducer for useOptimistic
function expenseReducer(
  state: OptimisticExpenseEntry[],
  action: ReducerAction
): OptimisticExpenseEntry[] {
  switch (action.type) {
    case 'reset':
      return action.items;
    case 'add':
      return [...action.items, ...state];
    case 'toggle':
      return state.map((e) =>
        e.id === action.id ? { ...e, paidAt: action.paidAt, _optimistic: true } : e
      );
    case 'remove':
      return state.filter((e) => e.transactionId !== action.transactionId);
    case 'bulkUpdateCategory':
      return state.map((e) =>
        action.transactionIds.includes(e.transactionId)
          ? {
              ...e,
              categoryId: action.category.id,
              categoryName: action.category.name,
              categoryColor: action.category.color,
              categoryIcon: action.category.icon,
              _optimistic: true,
            }
          : e
      );
    case 'toggleIgnore':
      return state.map((e) =>
        e.transactionId === action.transactionId
          ? { ...e, ignored: !e.ignored, _optimistic: true }
          : e
      );
    default:
      return state;
  }
}

// Context value type
type ExpenseContextValue = {
  expenses: OptimisticExpenseEntry[];
  filteredExpenses: OptimisticExpenseEntry[];
  accounts: Account[];
  recentAccounts: RecentAccount[];
  categories: Category[];
  recentCategories: RecentCategory[];
  unpaidFaturas: UnpaidFatura[];
  filters: ExpenseFilters;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Optimistic actions
  addExpense: (data: CreateExpenseInput) => void;
  togglePaid: (id: number, currentPaidAt: string | null) => Promise<void>;
  removeExpense: (transactionId: number) => Promise<void>;
  bulkUpdateCategory: (transactionIds: number[], categoryId: number) => Promise<void>;
  toggleIgnore: (transactionId: number) => Promise<void>;
};

const ExpenseContext = createContext<ExpenseContextValue | null>(null);

// Hook to get context (throws if not in provider)
export function useExpenseContext() {
  const ctx = useContext(ExpenseContext);
  if (!ctx) throw new Error('useExpenseContext must be used within ExpenseListProvider');
  return ctx;
}

// Optional hook (returns null if not in provider)
export function useExpenseContextOptional() {
  return useContext(ExpenseContext);
}

// Provider props
type ExpenseListProviderProps = {
  children: React.ReactNode;
  initialExpenses: ExpenseEntry[];
  accounts: Account[];
  recentAccounts: RecentAccount[];
  categories: Category[];
  recentCategories: RecentCategory[];
  unpaidFaturas: UnpaidFatura[];
  filters: ExpenseFilters;
};

// Helper: Generate optimistic entries for create
function generateOptimisticEntries(
  input: CreateExpenseInput,
  tempId: string
): OptimisticExpenseEntry[] {
  const entries: OptimisticExpenseEntry[] = [];
  const amountPerInstallment = Math.round(input.totalAmount / input.installments);
  const baseDate = new Date(input.purchaseDate + 'T00:00:00Z');
  const tempTransactionId = -Date.now();

  for (let i = 0; i < input.installments; i++) {
    const installmentDate = new Date(baseDate);
    installmentDate.setUTCMonth(installmentDate.getUTCMonth() + i);

    const amount =
      i === input.installments - 1
        ? input.totalAmount - amountPerInstallment * (input.installments - 1)
        : amountPerInstallment;

    const dueDate = installmentDate.toISOString().split('T')[0];
    const purchaseDate = dueDate; // Approximate for optimistic UI
    const faturaMonth = dueDate.slice(0, 7); // YYYY-MM

    entries.push({
      id: -(Date.now() + i), // Negative temp ID
      amount,
      purchaseDate,
      faturaMonth,
      dueDate,
      paidAt: null,
      installmentNumber: i + 1,
      transactionId: tempTransactionId,
      description: input.description ?? null,
      totalInstallments: input.installments,
      totalAmount: input.totalAmount,
      categoryId: input.categoryId,
      categoryName: input.categoryName,
      categoryColor: input.categoryColor,
      categoryIcon: input.categoryIcon,
      accountId: input.accountId,
      accountName: input.accountName,
      accountType: input.accountType,
      bankLogo: input.bankLogo,
      ignored: false,
      _optimistic: true,
      _tempId: `${tempId}-${i}`,
    });
  }

  return entries;
}

export function ExpenseListProvider({
  children,
  initialExpenses,
  accounts,
  recentAccounts,
  categories,
  recentCategories,
  unpaidFaturas,
  filters,
}: ExpenseListProviderProps) {
  const router = useRouter();
  const [optimisticExpenses, dispatch] = useOptimistic(initialExpenses, expenseReducer);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    dispatch({ type: 'reset', items: initialExpenses });
  }, [dispatch, initialExpenses]);

  // Filter expenses based on search query
  const filteredExpenses = useMemo(() => {
    if (!searchQuery.trim()) return optimisticExpenses;

    const query = searchQuery.toLowerCase();
    return optimisticExpenses.filter((expense) => {
      const description = expense.description?.toLowerCase() || '';
      const amount = centsToDisplay(expense.amount);

      return description.includes(query) || amount.includes(query);
    });
  }, [optimisticExpenses, searchQuery]);

  // Add expense (create)
  const addExpense = useCallback(
    (input: CreateExpenseInput) => {
      const tempId = `temp-${Date.now()}`;

      // Generate optimistic entries
      const optimisticEntries = generateOptimisticEntries(input, tempId);

      startTransition(() => {
        dispatch({ type: 'add', items: optimisticEntries });
      });

      // Fire-and-forget - matches togglePaid/removeExpense pattern
      serverCreateExpense({
        description: input.description,
        totalAmount: input.totalAmount,
        categoryId: input.categoryId,
        accountId: input.accountId,
        purchaseDate: input.purchaseDate,
        installments: input.installments,
      }).then(() => {
        router.refresh(); // Refresh to get updated data
      }).catch(() => {
        toast.error('Failed to create expense');
        router.refresh(); // Revert optimistic state
      });
    },
    [dispatch, router]
  );

  // Toggle paid/pending
  const togglePaid = useCallback(
    async (id: number, currentPaidAt: string | null) => {
      const newPaidAt = currentPaidAt ? null : new Date().toISOString();

      startTransition(() => {
        dispatch({ type: 'toggle', id, paidAt: newPaidAt });
      });

      try {
        if (currentPaidAt) {
          await serverMarkEntryPending(id);
        } else {
          await serverMarkEntryPaid(id);
        }
        router.refresh(); // Refresh to get updated data
      } catch {
        toast.error('Failed to update status');
        router.refresh(); // Revert optimistic state
      }
    },
    [dispatch, router]
  );

  // Remove expense (delete)
  const removeExpense = useCallback(
    async (transactionId: number) => {
      startTransition(() => {
        dispatch({ type: 'remove', transactionId });
      });

      try {
        await serverDeleteExpense(transactionId);
        router.refresh(); // Refresh to get updated data
      } catch {
        toast.error('Failed to delete expense');
        router.refresh(); // Revert optimistic state
      }
    },
    [dispatch, router]
  );

  // Bulk update category
  const bulkUpdateCategory = useCallback(
    async (transactionIds: number[], categoryId: number) => {
      const category = categories.find((c) => c.id === categoryId);
      if (!category) {
        console.error('Category not found:', categoryId);
        toast.error('Selected category not found. Please refresh and try again.');
        return;
      }

      startTransition(() => {
        dispatch({ type: 'bulkUpdateCategory', transactionIds, category });
      });

      try {
        await serverBulkUpdateTransactionCategories(transactionIds, categoryId);
        router.refresh(); // Refresh to get updated data
        toast.success(`Updated ${transactionIds.length} item${transactionIds.length > 1 ? 's' : ''}`);
      } catch (error) {
        console.error('Failed to bulk update categories:', error);
        toast.error('Failed to update categories');
        router.refresh(); // Revert optimistic state
      }
    },
    [categories, dispatch, router]
  );

  // Toggle ignore
  const toggleIgnore = useCallback(
    async (transactionId: number) => {
      startTransition(() => {
        dispatch({ type: 'toggleIgnore', transactionId });
      });

      try {
        await serverToggleIgnoreTransaction(transactionId);
        router.refresh(); // Refresh to get updated data
      } catch {
        toast.error('Failed to update ignore status');
        router.refresh(); // Revert optimistic state
      }
    },
    [dispatch, router]
  );

  const value: ExpenseContextValue = {
    expenses: optimisticExpenses,
    filteredExpenses,
    accounts,
    recentAccounts,
    categories,
    recentCategories,
    unpaidFaturas,
    filters,
    searchQuery,
    setSearchQuery,
    addExpense,
    togglePaid,
    removeExpense,
    bulkUpdateCategory,
    toggleIgnore,
  };

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}
