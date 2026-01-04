'use server';

import { unstable_cache } from 'next/cache';
import { getAccountsByUser } from './accounts';
import { getCategoriesByUser } from './categories';

// Cache accounts for 5 minutes (300 seconds)
// Revalidated via 'accounts' tag when mutations occur
// NOTE: userId must come from caller (getCurrentUserId) - can't call cookies() inside unstable_cache
export async function getCachedAccounts(userId: string) {
  return unstable_cache(
    async () => getAccountsByUser(userId),
    ['layout-accounts', userId],
    {
      revalidate: 300,
      tags: ['accounts']
    }
  )();
}

// Cache expense categories for 5 minutes
// Revalidated via category-specific tags
// NOTE: userId must come from caller (getCurrentUserId) - can't call cookies() inside unstable_cache
export async function getCachedExpenseCategories(userId: string) {
  return unstable_cache(
    async () => getCategoriesByUser(userId, 'expense'),
    ['layout-expense-categories', userId],
    {
      revalidate: 300,
      tags: ['categories', 'expense-categories']
    }
  )();
}

// Cache income categories for 5 minutes
// Revalidated via category-specific tags
// NOTE: userId must come from caller (getCurrentUserId) - can't call cookies() inside unstable_cache
export async function getCachedIncomeCategories(userId: string) {
  return unstable_cache(
    async () => getCategoriesByUser(userId, 'income'),
    ['layout-income-categories', userId],
    {
      revalidate: 300,
      tags: ['categories', 'income-categories']
    }
  )();
}
