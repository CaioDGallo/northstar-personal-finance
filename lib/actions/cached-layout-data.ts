'use server';

import { unstable_cache } from 'next/cache';
import { getAccounts } from './accounts';
import { getCategories } from './categories';

// Cache accounts for 5 minutes (300 seconds)
// Revalidated via 'accounts' tag when mutations occur
export const getCachedAccounts = unstable_cache(
  async () => getAccounts(),
  ['layout-accounts'],
  {
    revalidate: 300,
    tags: ['accounts']
  }
);

// Cache expense categories for 5 minutes
// Revalidated via category-specific tags
export const getCachedExpenseCategories = unstable_cache(
  async () => getCategories('expense'),
  ['layout-expense-categories'],
  {
    revalidate: 300,
    tags: ['categories', 'expense-categories']
  }
);

// Cache income categories for 5 minutes
// Revalidated via category-specific tags
export const getCachedIncomeCategories = unstable_cache(
  async () => getCategories('income'),
  ['layout-income-categories'],
  {
    revalidate: 300,
    tags: ['categories', 'income-categories']
  }
);
