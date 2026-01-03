'use client';

import { createContext, useContext, useOptimistic, useCallback, startTransition } from 'react';
import { toast } from 'sonner';
import type { Account, Category } from '@/lib/schema';
import {
  createExpense as serverCreateExpense,
  deleteExpense as serverDeleteExpense,
  markEntryPaid as serverMarkEntryPaid,
  markEntryPending as serverMarkEntryPending,
  bulkUpdateTransactionCategories as serverBulkUpdateTransactionCategories,
  type ExpenseFilters,
} from '@/lib/actions/expenses';

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
  description: string;
  totalInstallments: number;
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  accountId: number;
  accountName: string;
};

// Optimistic item wrapper
export type OptimisticExpenseEntry = ExpenseEntry & {
  _optimistic?: boolean;
  _tempId?: string;
};

// Input for creating expense
export type CreateExpenseInput = {
  description: string;
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
};

// Reducer actions
type ReducerAction =
  | { type: 'add'; items: OptimisticExpenseEntry[] }
  | { type: 'toggle'; id: number; paidAt: string | null }
  | { type: 'remove'; transactionId: number }
  | { type: 'bulkUpdateCategory'; transactionIds: number[]; category: Category };

// Reducer for useOptimistic
function expenseReducer(
  state: OptimisticExpenseEntry[],
  action: ReducerAction
): OptimisticExpenseEntry[] {
  switch (action.type) {
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
    default:
      return state;
  }
}

// Context value type
type ExpenseContextValue = {
  expenses: OptimisticExpenseEntry[];
  accounts: Account[];
  categories: Category[];
  filters: ExpenseFilters;

  // Optimistic actions
  addExpense: (data: CreateExpenseInput) => Promise<void>;
  togglePaid: (id: number, currentPaidAt: string | null) => Promise<void>;
  removeExpense: (transactionId: number) => Promise<void>;
  bulkUpdateCategory: (transactionIds: number[], categoryId: number) => Promise<void>;
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
  categories: Category[];
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
      description: input.description,
      totalInstallments: input.installments,
      categoryId: input.categoryId,
      categoryName: input.categoryName,
      categoryColor: input.categoryColor,
      categoryIcon: input.categoryIcon,
      accountId: input.accountId,
      accountName: input.accountName,
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
  categories,
  filters,
}: ExpenseListProviderProps) {
  const [optimisticExpenses, dispatch] = useOptimistic(initialExpenses, expenseReducer);

  // Add expense (create)
  const addExpense = useCallback(
    async (input: CreateExpenseInput) => {
      const tempId = `temp-${Date.now()}`;

      // Generate optimistic entries
      const optimisticEntries = generateOptimisticEntries(input, tempId);

      startTransition(() => {
        dispatch({ type: 'add', items: optimisticEntries });
      });

      try {
        await serverCreateExpense({
          description: input.description,
          totalAmount: input.totalAmount,
          categoryId: input.categoryId,
          accountId: input.accountId,
          purchaseDate: input.purchaseDate,
          installments: input.installments,
        });
        // revalidatePath in server action will update the server state
      } catch (error) {
        toast.error('Failed to create expense');
        throw error;
      }
    },
    [dispatch]
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
      } catch {
        toast.error('Failed to update status');
      }
    },
    [dispatch]
  );

  // Remove expense (delete)
  const removeExpense = useCallback(
    async (transactionId: number) => {
      startTransition(() => {
        dispatch({ type: 'remove', transactionId });
      });

      try {
        await serverDeleteExpense(transactionId);
      } catch {
        toast.error('Failed to delete expense');
      }
    },
    [dispatch]
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
        toast.success(`Updated ${transactionIds.length} item${transactionIds.length > 1 ? 's' : ''}`);
      } catch (error) {
        console.error('Failed to bulk update categories:', error);
        toast.error('Failed to update categories');
        // Optimistic update will auto-revert on revalidation
      }
    },
    [categories, dispatch]
  );

  const value: ExpenseContextValue = {
    expenses: optimisticExpenses,
    accounts,
    categories,
    filters,
    addExpense,
    togglePaid,
    removeExpense,
    bulkUpdateCategory,
  };

  return <ExpenseContext.Provider value={value}>{children}</ExpenseContext.Provider>;
}
