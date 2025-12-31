'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { budgets, categories, entries, transactions, monthlyBudgets } from '@/lib/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getBudgetsForMonth(yearMonth: string) {
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
        and(eq(budgets.categoryId, categories.id), eq(budgets.yearMonth, yearMonth))
      )
      .orderBy(categories.name);

    return result;
  } catch (error) {
    console.error('Failed to get budgets for month:', error);
    throw new Error('Failed to load budgets. Please try again.');
  }
}

export async function upsertBudget(
  categoryId: number,
  yearMonth: string,
  amount: number
) {
  // Validate inputs
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new Error('Invalid category ID');
  }
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error('Invalid year-month format (expected YYYY-MM)');
  }
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error('Budget amount must be a non-negative integer (cents)');
  }

  try {
    const existing = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.categoryId, categoryId), eq(budgets.yearMonth, yearMonth)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(budgets)
        .set({ amount })
        .where(eq(budgets.id, existing[0].id));
    } else {
      await db.insert(budgets).values({ categoryId, yearMonth, amount });
    }

    revalidatePath('/settings/budgets');
    revalidatePath('/budgets');
  } catch (error) {
    console.error('Failed to upsert budget:', error);
    throw new Error('Failed to save budget. Please try again.');
  }
}

export async function getMonthlyBudget(yearMonth: string): Promise<number | null> {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error('Invalid year-month format (expected YYYY-MM)');
  }

  try {
    const result = await db
      .select({ amount: monthlyBudgets.amount })
      .from(monthlyBudgets)
      .where(eq(monthlyBudgets.yearMonth, yearMonth))
      .limit(1);

    return result.length > 0 ? result[0].amount : null;
  } catch (error) {
    console.error('Failed to get monthly budget:', error);
    throw new Error('Failed to load monthly budget. Please try again.');
  }
}

export async function upsertMonthlyBudget(yearMonth: string, amount: number) {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error('Invalid year-month format (expected YYYY-MM)');
  }
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error('Monthly budget must be a non-negative integer (cents)');
  }

  try {
    const existing = await db
      .select()
      .from(monthlyBudgets)
      .where(eq(monthlyBudgets.yearMonth, yearMonth))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(monthlyBudgets)
        .set({ amount })
        .where(eq(monthlyBudgets.id, existing[0].id));
    } else {
      await db.insert(monthlyBudgets).values({ yearMonth, amount });
    }

    revalidatePath('/settings/budgets');
    revalidatePath('/budgets');
  } catch (error) {
    console.error('Failed to upsert monthly budget:', error);
    throw new Error('Failed to save monthly budget. Please try again.');
  }
}

export type BudgetWithSpending = {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  spent: number;
  budget: number;
};

export type BudgetsPageData = {
  totalSpent: number;
  totalBudget: number;
  budgets: BudgetWithSpending[];
};

export const getBudgetsWithSpending = cache(async (yearMonth: string): Promise<BudgetsPageData> => {
  // Validate year-month format
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    throw new Error('Invalid year-month format (expected YYYY-MM)');
  }

  // Parse year-month to get start/end dates
  const [year, month] = yearMonth.split('-').map(Number);

  // Validate parsed values
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    throw new Error('Invalid year or month value');
  }

  try {
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
      .where(eq(budgets.yearMonth, yearMonth));

    // 2. Get spending by category for the month
    const spending = await db
      .select({
        categoryId: transactions.categoryId,
        spent: sql<number>`CAST(SUM(${entries.amount}) AS INTEGER)`,
      })
      .from(entries)
      .innerJoin(transactions, eq(entries.transactionId, transactions.id))
      .where(and(gte(entries.dueDate, startDate), lte(entries.dueDate, endDate)))
      .groupBy(transactions.categoryId);

    // 3. Merge budgets and spending
    const budgetsWithSpending = monthBudgets.map((budget) => {
      const spentData = spending.find((s) => s.categoryId === budget.categoryId);
      return {
        categoryId: budget.categoryId,
        categoryName: budget.categoryName,
        categoryColor: budget.categoryColor,
        categoryIcon: budget.categoryIcon,
        spent: spentData?.spent || 0,
        budget: budget.budget,
      };
    });

    // 4. Calculate totals
    const totalBudget = budgetsWithSpending.reduce((sum, cat) => sum + cat.budget, 0);
    const totalSpent = budgetsWithSpending.reduce((sum, cat) => sum + cat.spent, 0);

    return {
      totalSpent,
      totalBudget,
      budgets: budgetsWithSpending,
    };
  } catch (error) {
    console.error('Failed to get budgets with spending:', error);
    throw new Error('Failed to load budget data. Please try again.');
  }
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
    // 1. Get all budgets from source month
    const sourceBudgets = await db
      .select({
        categoryId: budgets.categoryId,
        amount: budgets.amount,
      })
      .from(budgets)
      .where(eq(budgets.yearMonth, sourceMonth));

    if (sourceBudgets.length === 0) {
      return { copied: 0, skipped: 0, total: 0, monthlyBudgetCopied: false };
    }

    // 2. Get existing budgets for target month (to skip)
    const existingBudgets = await db
      .select({ categoryId: budgets.categoryId })
      .from(budgets)
      .where(eq(budgets.yearMonth, targetMonth));

    const existingCategoryIds = new Set(existingBudgets.map((b) => b.categoryId));

    // 3. Filter: only copy budgets where categoryId not in target
    const budgetsToCopy = sourceBudgets.filter(
      (budget) => !existingCategoryIds.has(budget.categoryId)
    );

    // 4. Batch insert new budgets
    if (budgetsToCopy.length > 0) {
      await db.insert(budgets).values(
        budgetsToCopy.map((budget) => ({
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
    throw new Error('Failed to copy budgets. Please try again.');
  }
}
