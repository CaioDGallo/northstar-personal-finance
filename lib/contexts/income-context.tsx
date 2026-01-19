'use client';

import { createContext, useContext, useOptimistic, useCallback, startTransition, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { Account, Category } from '@/lib/schema';
import {
  createIncome as serverCreateIncome,
  deleteIncome as serverDeleteIncome,
  markIncomeReceived as serverMarkIncomeReceived,
  markIncomePending as serverMarkIncomePending,
  bulkUpdateIncomeCategories as serverBulkUpdateIncomeCategories,
  toggleIgnoreIncome as serverToggleIgnoreIncome,
  type IncomeFilters,
} from '@/lib/actions/income';
import { centsToDisplay, getCurrentYearMonth } from '@/lib/utils';
import { useMonthStore } from '@/lib/stores/month-store';

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
  accountType: 'credit_card' | 'checking' | 'savings' | 'cash';
  ignored: boolean;
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
  accountType: 'credit_card' | 'checking' | 'savings' | 'cash';
};

// Reducer actions
type ReducerAction =
  | { type: 'add'; item: OptimisticIncomeEntry }
  | { type: 'toggle'; id: number; receivedAt: string | null }
  | { type: 'remove'; id: number }
  | { type: 'bulkUpdateCategory'; incomeIds: number[]; category: Category }
  | { type: 'toggleIgnore'; id: number };

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
    case 'toggleIgnore':
      return state.map((item) =>
        item.id === action.id
          ? { ...item, ignored: !item.ignored, _optimistic: true }
          : item
      );
    default:
      return state;
  }
}

// Context value type
type IncomeContextValue = {
  income: OptimisticIncomeEntry[];
  filteredIncome: OptimisticIncomeEntry[];
  accounts: Account[];
  categories: Category[];
  filters: IncomeFilters;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Optimistic actions
  addIncome: (data: CreateIncomeInput) => void;
  toggleReceived: (id: number, currentReceivedAt: string | null) => Promise<void>;
  removeIncome: (id: number) => Promise<void>;
  bulkUpdateCategory: (incomeIds: number[], categoryId: number) => Promise<void>;
  toggleIgnore: (id: number) => Promise<void>;
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
    accountType: input.accountType,
    ignored: false,
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
  const router = useRouter();
  const [optimisticIncome, dispatch] = useOptimistic(initialIncome, incomeReducer);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter income based on search query
  const filteredIncome = useMemo(() => {
    if (!searchQuery.trim()) return optimisticIncome;

    const query = searchQuery.toLowerCase();
    return optimisticIncome.filter((income) => {
      const description = income.description?.toLowerCase() || '';
      const amount = centsToDisplay(income.amount);

      return description.includes(query) || amount.includes(query);
    });
  }, [optimisticIncome, searchQuery]);

  // Add income (create)
  const addIncome = useCallback(
    (input: CreateIncomeInput) => {
      const tempId = `temp-${Date.now()}`;

      // Generate optimistic entry
      const optimisticEntry = generateOptimisticIncome(input, tempId);

      startTransition(() => {
        dispatch({ type: 'add', item: optimisticEntry });
      });

      // Fire-and-forget - matches toggleReceived/removeIncome pattern
      serverCreateIncome({
        description: input.description,
        amount: input.amount,
        categoryId: input.categoryId,
        accountId: input.accountId,
        receivedDate: input.receivedDate,
      }).then(() => {
        // Clear cache for the received month
        const receivedMonth = input.receivedDate.slice(0, 7);
        useMonthStore.getState().clearMonthCache(receivedMonth);
      }).catch(() => {
        toast.error('Failed to create income');
        router.refresh(); // Revert optimistic state
      });
    },
    [dispatch, router]
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
        // Clear current month cache and trigger re-fetch
        useMonthStore.getState().clearMonthCache(getCurrentYearMonth());
        useMonthStore.getState().invalidateIncomeCache();
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
        // Clear all caches and trigger re-fetch
        useMonthStore.getState().clearAllCache();
        useMonthStore.getState().invalidateIncomeCache();
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
        // Clear all caches and trigger re-fetch
        useMonthStore.getState().clearAllCache();
        useMonthStore.getState().invalidateIncomeCache();
        toast.success(`Updated ${incomeIds.length} item${incomeIds.length > 1 ? 's' : ''}`);
      } catch (error) {
        console.error('Failed to bulk update categories:', error);
        toast.error('Failed to update categories');
        // Optimistic update will auto-revert on revalidation
      }
    },
    [categories, dispatch]
  );

  // Toggle ignore
  const toggleIgnore = useCallback(
    async (id: number) => {
      startTransition(() => {
        dispatch({ type: 'toggleIgnore', id });
      });

      try {
        await serverToggleIgnoreIncome(id);
        // Clear all caches and trigger re-fetch
        useMonthStore.getState().clearAllCache();
        useMonthStore.getState().invalidateIncomeCache();
      } catch {
        toast.error('Failed to update ignore status');
      }
    },
    [dispatch]
  );

  const value: IncomeContextValue = {
    income: optimisticIncome,
    filteredIncome,
    accounts,
    categories,
    filters,
    searchQuery,
    setSearchQuery,
    addIncome,
    toggleReceived,
    removeIncome,
    bulkUpdateCategory,
    toggleIgnore,
  };

  return <IncomeContext.Provider value={value}>{children}</IncomeContext.Provider>;
}
