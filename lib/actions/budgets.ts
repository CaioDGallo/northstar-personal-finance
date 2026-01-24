'use server';

import { cache } from 'react';
import { unstable_cache, revalidatePath, revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { budgets, categories, entries, transactions, monthlyBudgets, income } from '@/lib/schema';
import { eq, and, gte, lte, sql, isNotNull } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';
import { activeTransactionCondition } from '@/lib/query-helpers';
import { getPostHogClient } from '@/lib/posthog-server';
import { trackFirstBudget, trackUserActivity } from '@/lib/analytics';
import { users } from '@/lib/auth-schema';

export const getBudgetsForMonth = cache(async (yearMonth: string) => {
  const userId = await getCurrentUserId();

  return unstable_cache(
    async () => {
      try {
        const result = await db
          .select({
            categoryId: categories.id,
            categoryName: categories.name,
            categoryColor: categories.color,
            categoryIcon: categories.icon,
            budgetId: budgets.id,
            budgetAmount: budgets.amount,
          })
          .from(categories)
          .leftJoin(
            budgets,
            and(
              eq(budgets.categoryId, categories.id),
              eq(budgets.yearMonth, yearMonth),
              eq(budgets.userId, userId)
            )
          )
          .where(eq(categories.userId, userId))
          .orderBy(categories.name);

        return result;
      } catch (error) {
        console.error('Failed to get budgets for month:', error);
        throw new Error(await handleDbError(error, 'errors.failedToLoad'));
      }
    },
    ['budgets-for-month', userId, yearMonth],
    { tags: [`user-${userId}`], revalidate: 300 }
  )();
});

export async function upsertBudget(
  categoryId: number,
  yearMonth: string,
  amount: number
) {
  // Validate inputs
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new Error(await t('errors.invalidCategoryId'));
  }
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error(await t('errors.invalidYearMonthFormat'));
  }
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(await t('errors.budgetMustBeNonNegative'));
  }

  try {
    const userId = await getCurrentUserId();
    const existing = await db
      .select()
      .from(budgets)
      .where(and(
        eq(budgets.userId, userId),
        eq(budgets.categoryId, categoryId),
        eq(budgets.yearMonth, yearMonth)
      ))
      .limit(1);

    const isCreating = existing.length === 0;

    if (existing.length > 0) {
      await db
        .update(budgets)
        .set({ amount })
        .where(and(eq(budgets.id, existing[0].id), eq(budgets.userId, userId)));
    } else {
      await db.insert(budgets).values({ userId, categoryId, yearMonth, amount });
    }

    // Analytics: Track first budget creation
    if (isCreating) {
      const [budgetCount, entryCount, user] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(budgets).where(eq(budgets.userId, userId)),
        db.select({ count: sql<number>`count(*)` }).from(entries).where(eq(entries.userId, userId)),
        db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1),
      ]);

      const totalBudgets = Number(budgetCount[0]?.count || 0);
      const hasTransactions = Number(entryCount[0]?.count || 0) > 0;

      if (totalBudgets === 1 && user[0]?.createdAt) {
        await trackFirstBudget({
          userId,
          budgetType: 'category_budget',
          budgetsCount: 1,
          hasExistingTransactions: hasTransactions,
          userCreatedAt: user[0].createdAt,
        });
      }

      await trackUserActivity({
        userId,
        activityType: 'create_budget',
      });
    } else {
      await trackUserActivity({
        userId,
        activityType: 'edit_budget',
      });
    }

    // PostHog event tracking
    const posthog = getPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: userId,
        event: 'budget_set',
        properties: {
          category_id: categoryId,
          amount_cents: amount,
          year_month: yearMonth,
          is_update: existing.length > 0,
        },
      });
    }

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/settings/budgets');
    revalidatePath('/budgets');
  } catch (error) {
    console.error('Failed to upsert budget:', error);
    throw new Error(await handleDbError(error, 'errors.failedToSave'));
  }
}

export const getMonthlyBudget = cache(async (yearMonth: string): Promise<number | null> => {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error(await t('errors.invalidYearMonthFormat'));
  }

  const userId = await getCurrentUserId();

  return unstable_cache(
    async () => {
      try {
        const result = await db
          .select({ amount: monthlyBudgets.amount })
          .from(monthlyBudgets)
          .where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.yearMonth, yearMonth)))
          .limit(1);

        return result.length > 0 ? result[0].amount : null;
      } catch (error) {
        console.error('Failed to get monthly budget:', error);
        throw new Error(await handleDbError(error, 'errors.failedToLoad'));
      }
    },
    ['monthly-budget', userId, yearMonth],
    { tags: [`user-${userId}`], revalidate: 300 }
  )();
});

export async function upsertMonthlyBudget(yearMonth: string, amount: number) {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error(await t('errors.invalidYearMonthFormat'));
  }
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(await t('errors.monthlyBudgetMustBeNonNegative'));
  }

  try {
    const userId = await getCurrentUserId();
    const existing = await db
      .select()
      .from(monthlyBudgets)
      .where(and(eq(monthlyBudgets.userId, userId), eq(monthlyBudgets.yearMonth, yearMonth)))
      .limit(1);

    const isCreating = existing.length === 0;

    if (existing.length > 0) {
      await db
        .update(monthlyBudgets)
        .set({ amount })
        .where(and(eq(monthlyBudgets.id, existing[0].id), eq(monthlyBudgets.userId, userId)));
    } else {
      await db.insert(monthlyBudgets).values({ userId, yearMonth, amount });
    }

    // Analytics: Track first budget creation (monthly total budget)
    if (isCreating) {
      const [monthlyBudgetCount, categoryBudgetCount, entryCount, user] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(monthlyBudgets).where(eq(monthlyBudgets.userId, userId)),
        db.select({ count: sql<number>`count(*)` }).from(budgets).where(eq(budgets.userId, userId)),
        db.select({ count: sql<number>`count(*)` }).from(entries).where(eq(entries.userId, userId)),
        db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1),
      ]);

      const totalMonthlyBudgets = Number(monthlyBudgetCount[0]?.count || 0);
      const totalCategoryBudgets = Number(categoryBudgetCount[0]?.count || 0);
      const hasTransactions = Number(entryCount[0]?.count || 0) > 0;

      // Track as first budget if this is user's first budget of any type
      if (totalMonthlyBudgets === 1 && totalCategoryBudgets === 0 && user[0]?.createdAt) {
        await trackFirstBudget({
          userId,
          budgetType: 'monthly_total_budget',
          budgetsCount: 1,
          hasExistingTransactions: hasTransactions,
          userCreatedAt: user[0].createdAt,
        });
      }

      await trackUserActivity({
        userId,
        activityType: 'create_budget',
      });
    } else {
      await trackUserActivity({
        userId,
        activityType: 'edit_budget',
      });
    }

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/settings/budgets');
    revalidatePath('/budgets');
  } catch (error) {
    console.error('Failed to upsert monthly budget:', error);
    throw new Error(await handleDbError(error, 'errors.failedToSave'));
  }
}

export type BudgetWithSpending = {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  spent: number;
  replenished: number;
  netSpent: number;
  budget: number;
};

export type UnbudgetedSpending = {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  spent: number;
};

export type BudgetsPageData = {
  totalSpent: number;
  totalReplenished: number;
  totalNetSpent: number;
  totalBudget: number;
  budgets: BudgetWithSpending[];
  unbudgeted: UnbudgetedSpending[];
  totalUnbudgetedSpent: number;
};

export const getBudgetsWithSpending = cache(async (yearMonth: string): Promise<BudgetsPageData> => {
  // Validate year-month format
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error(await t('errors.invalidYearMonthFormat'));
  }

  // Parse year-month to get start/end dates
  const [year, month] = yearMonth.split('-').map(Number);

  // Validate parsed values
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    throw new Error(await t('errors.invalidYearMonth'));
  }

  const userId = await getCurrentUserId();

  return unstable_cache(
    async () => {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endOfMonth = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${endOfMonth}`;

    // 1. Get all budgets for the month with category info
    const monthBudgets = await db
      .select({
        categoryId: budgets.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        categoryIcon: categories.icon,
        budget: budgets.amount,
      })
      .from(budgets)
      .innerJoin(categories, eq(budgets.categoryId, categories.id))
      .where(and(eq(budgets.userId, userId), eq(budgets.yearMonth, yearMonth)))
      .orderBy(categories.name);

    // 2. Get spending by category for the month (using purchaseDate for budget impact)
    const spending = await db
      .select({
        categoryId: transactions.categoryId,
        spent: sql<number>`CAST(SUM(${entries.amount}) AS INTEGER)`,
      })
      .from(entries)
      .innerJoin(transactions, eq(entries.transactionId, transactions.id))
      .where(and(
        eq(entries.userId, userId),
        gte(entries.purchaseDate, startDate),
        lte(entries.purchaseDate, endDate),
        activeTransactionCondition()
      ))
      .groupBy(transactions.categoryId);

    // 2b. Get replenishments by expense category for the month
    const replenishments = await db
      .select({
        categoryId: income.replenishCategoryId,
        replenished: sql<number>`CAST(SUM(${income.amount}) AS INTEGER)`,
      })
      .from(income)
      .where(and(
        eq(income.userId, userId),
        gte(income.receivedDate, startDate),
        lte(income.receivedDate, endDate),
        isNotNull(income.replenishCategoryId),
        eq(income.ignored, false)
      ))
      .groupBy(income.replenishCategoryId);

    // 3. Merge budgets, spending, and replenishments
    const budgetsWithSpending = monthBudgets.map((budget) => {
      const spentData = spending.find((s) => s.categoryId === budget.categoryId);
      const replenishedData = replenishments.find((r) => r.categoryId === budget.categoryId);
      const spent = spentData?.spent || 0;
      const replenished = replenishedData?.replenished || 0;
      return {
        categoryId: budget.categoryId,
        categoryName: budget.categoryName,
        categoryColor: budget.categoryColor,
        categoryIcon: budget.categoryIcon,
        spent,
        replenished,
        netSpent: spent - replenished,
        budget: budget.budget,
      };
    });

    // 4. Find unbudgeted spending
    const budgetedCategoryIds = new Set(monthBudgets.map((b) => b.categoryId));
    const unbudgetedSpending = spending.filter((s) => !budgetedCategoryIds.has(s.categoryId));

    // Get category details for unbudgeted categories
    const categoryDetails = await db
      .select({
        id: categories.id,
        name: categories.name,
        color: categories.color,
        icon: categories.icon,
      })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.type, 'expense')));

    const categoryMap = new Map(categoryDetails.map((c) => [c.id, c]));

    const unbudgeted: UnbudgetedSpending[] = unbudgetedSpending
      .map((s) => {
        const cat = categoryMap.get(s.categoryId);
        if (!cat) return null;
        return {
          categoryId: s.categoryId,
          categoryName: cat.name,
          categoryColor: cat.color,
          categoryIcon: cat.icon,
          spent: s.spent,
        };
      })
      .filter((item): item is UnbudgetedSpending => item !== null)
      .sort((a, b) => b.spent - a.spent);

    // 5. Calculate totals
    const totalBudget = budgetsWithSpending.reduce((sum, cat) => sum + cat.budget, 0);
    const totalSpent = budgetsWithSpending.reduce((sum, cat) => sum + cat.spent, 0);
    const totalReplenished = budgetsWithSpending.reduce((sum, cat) => sum + cat.replenished, 0);
    const totalNetSpent = budgetsWithSpending.reduce((sum, cat) => sum + cat.netSpent, 0);
      const totalUnbudgetedSpent = unbudgeted.reduce((sum, cat) => sum + cat.spent, 0);

      return {
        totalSpent,
        totalReplenished,
        totalNetSpent,
        totalBudget,
        budgets: budgetsWithSpending,
        unbudgeted,
        totalUnbudgetedSpent,
      };
    },
    ['budgets', userId, yearMonth],
    { tags: [`user-${userId}`], revalidate: 300 }
  )();
});

export type CopyBudgetsResult = {
  copied: number;
  skipped: number;
  total: number;
  monthlyBudgetCopied: boolean;
};

export async function copyBudgetsFromMonth(
  sourceMonth: string,
  targetMonth: string
): Promise<CopyBudgetsResult> {
  try {
    const userId = await getCurrentUserId();

    // 1. Get all budgets from source month
    const sourceBudgets = await db
      .select({
        categoryId: budgets.categoryId,
        amount: budgets.amount,
      })
      .from(budgets)
      .where(and(eq(budgets.userId, userId), eq(budgets.yearMonth, sourceMonth)));

    if (sourceBudgets.length === 0) {
      return { copied: 0, skipped: 0, total: 0, monthlyBudgetCopied: false };
    }

    // 2. Get existing budgets for target month (to skip)
    const existingBudgets = await db
      .select({ categoryId: budgets.categoryId })
      .from(budgets)
      .where(and(eq(budgets.userId, userId), eq(budgets.yearMonth, targetMonth)));

    const existingCategoryIds = new Set(existingBudgets.map((b) => b.categoryId));

    // 3. Filter: only copy budgets where categoryId not in target
    const budgetsToCopy = sourceBudgets.filter(
      (budget) => !existingCategoryIds.has(budget.categoryId)
    );

    // 4. Batch insert new budgets
    if (budgetsToCopy.length > 0) {
      await db.insert(budgets).values(
        budgetsToCopy.map((budget) => ({
          userId,
          categoryId: budget.categoryId,
          yearMonth: targetMonth,
          amount: budget.amount,
        }))
      );
    }

    // 5. Copy monthly budget if exists and target doesn't have one
    let monthlyBudgetCopied = false;
    const sourceMonthlyBudget = await getMonthlyBudget(sourceMonth);
    const targetMonthlyBudget = await getMonthlyBudget(targetMonth);

    if (sourceMonthlyBudget !== null && targetMonthlyBudget === null) {
      await upsertMonthlyBudget(targetMonth, sourceMonthlyBudget);
      monthlyBudgetCopied = true;
    }

    // 6. Revalidate both budgets pages
    revalidateTag(`user-${userId}`, {});
    revalidatePath('/budgets');
    revalidatePath('/settings/budgets');

    return {
      copied: budgetsToCopy.length,
      skipped: existingCategoryIds.size,
      total: sourceBudgets.length,
      monthlyBudgetCopied,
    };
  } catch (error) {
    console.error('Failed to copy budgets:', error);
    throw new Error(await handleDbError(error, 'errors.failedToCopy'));
  }
}
