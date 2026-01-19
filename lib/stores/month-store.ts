import { create } from 'zustand';
import { getCurrentYearMonth, addMonths } from '@/lib/utils';
import type { DashboardData } from '@/lib/actions/dashboard';

// Define types for cached data from each page
type ExpenseData = Awaited<ReturnType<typeof import('@/lib/actions/expenses').getExpenses>>;
type IncomeData = Awaited<ReturnType<typeof import('@/lib/actions/income').getIncome>>;
type BudgetData = Awaited<ReturnType<typeof import('@/lib/actions/budgets').getBudgetsWithSpending>>;
type FaturaData = Awaited<ReturnType<typeof import('@/lib/actions/faturas').getFaturasByMonth>>;

// Cache structure for each page type
interface MonthCache<T> {
  data: T;
  timestamp: number;
}

interface MonthStore {
  // Current selected month
  currentMonth: string;

  // Caches for each page type (keyed by month)
  dashboardCache: Map<string, MonthCache<DashboardData>>;
  expensesCache: Map<string, MonthCache<ExpenseData>>;
  incomeCache: Map<string, MonthCache<IncomeData>>;
  budgetsCache: Map<string, MonthCache<BudgetData>>;
  faturasCache: Map<string, MonthCache<FaturaData>>;

  // Cache version counters for invalidation triggers
  expensesCacheVersion: number;
  incomeCacheVersion: number;

  // Actions
  setMonth: (month: string) => void;

  // Cache management
  setCachedData: <T extends 'dashboard' | 'expenses' | 'income' | 'budgets' | 'faturas'>(
    type: T,
    month: string,
    data: T extends 'dashboard' ? DashboardData
      : T extends 'expenses' ? ExpenseData
      : T extends 'income' ? IncomeData
      : T extends 'budgets' ? BudgetData
      : FaturaData
  ) => void;

  getCachedData: <T extends 'dashboard' | 'expenses' | 'income' | 'budgets' | 'faturas'>(
    type: T,
    month: string
  ) => (T extends 'dashboard' ? DashboardData
      : T extends 'expenses' ? ExpenseData
      : T extends 'income' ? IncomeData
      : T extends 'budgets' ? BudgetData
      : FaturaData) | null;

  // Clear cache for specific month(s)
  clearMonthCache: (month: string) => void;
  clearMonthRange: (startMonth: string, endMonth: string) => void;
  clearAllCache: () => void;

  // Cache invalidation triggers
  invalidateExpensesCache: () => void;
  invalidateIncomeCache: () => void;

  // Evict old months outside ±2 window
  evictOldMonths: () => void;
}

export const useMonthStore = create<MonthStore>((set, get) => ({
  currentMonth: getCurrentYearMonth(),

  dashboardCache: new Map(),
  expensesCache: new Map(),
  incomeCache: new Map(),
  budgetsCache: new Map(),
  faturasCache: new Map(),

  expensesCacheVersion: 0,
  incomeCacheVersion: 0,

  setMonth: (month: string) => {
    set({ currentMonth: month });
    // Evict old months after switching
    get().evictOldMonths();
  },

  setCachedData: (type, month, data) => {
    set((state) => {
      const cacheKey = `${type}Cache` as const;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cache = new Map(state[cacheKey] as any);
      cache.set(month, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: data as any,
        timestamp: Date.now(),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { [cacheKey]: cache } as any;
    });
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getCachedData: ((type: any, month: string) => {
    const cacheKey = `${type}Cache` as const;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cache = (get() as any)[cacheKey];
    const cached = cache.get(month);
    return cached ? cached.data : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any,

  clearMonthCache: (month: string) => {
    set((state) => ({
      dashboardCache: new Map([...state.dashboardCache].filter(([m]) => m !== month)),
      expensesCache: new Map([...state.expensesCache].filter(([m]) => m !== month)),
      incomeCache: new Map([...state.incomeCache].filter(([m]) => m !== month)),
      budgetsCache: new Map([...state.budgetsCache].filter(([m]) => m !== month)),
      faturasCache: new Map([...state.faturasCache].filter(([m]) => m !== month)),
    }));
  },

  clearMonthRange: (startMonth: string, endMonth: string) => {
    const start = new Date(startMonth + '-01');
    const end = new Date(endMonth + '-01');

    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filterByRange = (cache: Map<string, any>) => {
        return new Map([...cache].filter(([month]) => {
          const monthDate = new Date(month + '-01');
          return monthDate < start || monthDate > end;
        }));
      };

      return {
        dashboardCache: filterByRange(state.dashboardCache),
        expensesCache: filterByRange(state.expensesCache),
        incomeCache: filterByRange(state.incomeCache),
        budgetsCache: filterByRange(state.budgetsCache),
        faturasCache: filterByRange(state.faturasCache),
      };
    });
  },

  clearAllCache: () => {
    set({
      dashboardCache: new Map(),
      expensesCache: new Map(),
      incomeCache: new Map(),
      budgetsCache: new Map(),
      faturasCache: new Map(),
    });
  },

  evictOldMonths: () => {
    const currentMonth = get().currentMonth;
    const windowStart = addMonths(currentMonth, -2);
    const windowEnd = addMonths(currentMonth, 2);

    const isInWindow = (month: string) => {
      return month >= windowStart && month <= windowEnd;
    };

    set((state) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filterCache = (cache: Map<string, any>) => {
        return new Map([...cache].filter(([month]) => isInWindow(month)));
      };

      return {
        dashboardCache: filterCache(state.dashboardCache),
        expensesCache: filterCache(state.expensesCache),
        incomeCache: filterCache(state.incomeCache),
        budgetsCache: filterCache(state.budgetsCache),
        faturasCache: filterCache(state.faturasCache),
      };
    });
  },

  invalidateExpensesCache: () => {
    set((state) => ({
      expensesCacheVersion: state.expensesCacheVersion + 1,
    }));
  },

  invalidateIncomeCache: () => {
    set((state) => ({
      incomeCacheVersion: state.incomeCacheVersion + 1,
    }));
  },
}));
