'use client';

import { createContext, useContext, useOptimistic, useCallback, startTransition } from 'react';
import { toast } from 'sonner';
import type { Account, Category } from '@/lib/schema';
import {
  createIncome as serverCreateIncome,
  deleteIncome as serverDeleteIncome,
  markIncomeReceived as serverMarkIncomeReceived,
  markIncomePending as serverMarkIncomePending,
  bulkUpdateIncomeCategories as serverBulkUpdateIncomeCategories,
  type IncomeFilters,
} from '@/lib/actions/income';

// Income entry shape (from getIncome return type)
export type IncomeEntry = {
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
};

// Optimistic item wrapper
export type OptimisticIncomeEntry = IncomeEntry & {
  _optimistic?: boolean;
  _tempId?: string;
};

// Input for creating income
export type CreateIncomeInput = {
  description: string;
  amount: number; // cents
  categoryId: number;
  accountId: number;
  receivedDate: string; // 'YYYY-MM-DD'
  // Metadata for optimistic UI
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  accountName: string;
};

// Reducer actions
type ReducerAction =
  | { type: 'add'; item: OptimisticIncomeEntry }
  | { type: 'toggle'; id: number; receivedAt: string | null }
  | { type: 'remove'; id: number }
  | { type: 'bulkUpdateCategory'; incomeIds: number[]; category: Category };

// Reducer for useOptimistic
function incomeReducer(
  state: OptimisticIncomeEntry[],
  action: ReducerAction
): OptimisticIncomeEntry[] {
  switch (action.type) {
    case 'add':
      return [action.item, ...state];
    case 'toggle':
      return state.map((item) =>
        item.id === action.id ? { ...item, receivedAt: action.receivedAt, _optimistic: true } : item
      );
    case 'remove':
      return state.filter((item) => item.id !== action.id);
    case 'bulkUpdateCategory':
      return state.map((item) =>
        action.incomeIds.includes(item.id)
          ? {
              ...item,
              categoryId: action.category.id,
              categoryName: action.category.name,
              categoryColor: action.category.color,
              categoryIcon: action.category.icon,
              _optimistic: true,
            }
          : item
      );
    default:
      return state;
  }
}

// Context value type
type IncomeContextValue = {
  income: OptimisticIncomeEntry[];
  accounts: Account[];
  categories: Category[];
  filters: IncomeFilters;

  // Optimistic actions
  addIncome: (data: CreateIncomeInput) => Promise<void>;
  toggleReceived: (id: number, currentReceivedAt: string | null) => Promise<void>;
  removeIncome: (id: number) => Promise<void>;
  bulkUpdateCategory: (incomeIds: number[], categoryId: number) => Promise<void>;
};

const IncomeContext = createContext<IncomeContextValue | null>(null);

// Hook to get context (throws if not in provider)
export function useIncomeContext() {
  const ctx = useContext(IncomeContext);
  if (!ctx) throw new Error('useIncomeContext must be used within IncomeListProvider');
  return ctx;
}

// Optional hook (returns null if not in provider)
export function useIncomeContextOptional() {
  return useContext(IncomeContext);
}

// Provider props
type IncomeListProviderProps = {
  children: React.ReactNode;
  initialIncome: IncomeEntry[];
  accounts: Account[];
  categories: Category[];
  filters: IncomeFilters;
};

// Helper: Generate optimistic income for create
function generateOptimisticIncome(input: CreateIncomeInput, tempId: string): OptimisticIncomeEntry {
  return {
    id: -Date.now(), // Negative temp ID
    description: input.description,
    amount: input.amount,
    receivedDate: input.receivedDate,
    receivedAt: null,
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    categoryColor: input.categoryColor,
    categoryIcon: input.categoryIcon,
    accountId: input.accountId,
    accountName: input.accountName,
    _optimistic: true,
    _tempId: tempId,
  };
}

export function IncomeListProvider({
  children,
  initialIncome,
  accounts,
  categories,
  filters,
}: IncomeListProviderProps) {
  const [optimisticIncome, dispatch] = useOptimistic(initialIncome, incomeReducer);

  // Add income (create)
  const addIncome = useCallback(
    async (input: CreateIncomeInput) => {
      const tempId = `temp-${Date.now()}`;

      // Generate optimistic entry
      const optimisticEntry = generateOptimisticIncome(input, tempId);

      startTransition(() => {
        dispatch({ type: 'add', item: optimisticEntry });
      });

      try {
        await serverCreateIncome({
          description: input.description,
          amount: input.amount,
          categoryId: input.categoryId,
          accountId: input.accountId,
          receivedDate: input.receivedDate,
        });
        // revalidatePath in server action will update the server state
      } catch (error) {
        toast.error('Failed to create income');
        throw error;
      }
    },
    [dispatch]
  );

  // Toggle received/pending
  const toggleReceived = useCallback(
    async (id: number, currentReceivedAt: string | null) => {
      const newReceivedAt = currentReceivedAt ? null : new Date().toISOString();

      startTransition(() => {
        dispatch({ type: 'toggle', id, receivedAt: newReceivedAt });
      });

      try {
        if (currentReceivedAt) {
          await serverMarkIncomePending(id);
        } else {
          await serverMarkIncomeReceived(id);
        }
      } catch {
        toast.error('Failed to update status');
      }
    },
    [dispatch]
  );

  // Remove income (delete)
  const removeIncome = useCallback(
    async (id: number) => {
      startTransition(() => {
        dispatch({ type: 'remove', id });
      });

      try {
        await serverDeleteIncome(id);
      } catch {
        toast.error('Failed to delete income');
      }
    },
    [dispatch]
  );

  // Bulk update category
  const bulkUpdateCategory = useCallback(
    async (incomeIds: number[], categoryId: number) => {
      const category = categories.find((c) => c.id === categoryId);
      if (!category) {
        console.error('Category not found:', categoryId);
        toast.error('Selected category not found. Please refresh and try again.');
        return;
      }

      startTransition(() => {
        dispatch({ type: 'bulkUpdateCategory', incomeIds, category });
      });

      try {
        await serverBulkUpdateIncomeCategories(incomeIds, categoryId);
        toast.success(`Updated ${incomeIds.length} item${incomeIds.length > 1 ? 's' : ''}`);
      } catch (error) {
        console.error('Failed to bulk update categories:', error);
        toast.error('Failed to update categories');
        // Optimistic update will auto-revert on revalidation
      }
    },
    [categories, dispatch]
  );

  const value: IncomeContextValue = {
    income: optimisticIncome,
    accounts,
    categories,
    filters,
    addIncome,
    toggleReceived,
    removeIncome,
    bulkUpdateCategory,
  };

  return <IncomeContext.Provider value={value}>{children}</IncomeContext.Provider>;
}
