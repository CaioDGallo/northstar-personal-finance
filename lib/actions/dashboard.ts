'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { entries, transactions, categories, budgets, accounts, income } from '@/lib/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

export type DashboardData = {
  totalSpent: number;
  totalBudget: number;
  totalIncome: number;
  netBalance: number;
  categoryBreakdown: {
    categoryId: number;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string | null;
    spent: number;
    budget: number;
  }[];
  recentExpenses: {
    entryId: number;
    description: string;
    amount: number;
    dueDate: string;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string | null;
    accountName: string;
  }[];
  recentIncome: {
    incomeId: number;
    description: string;
    amount: number;
    receivedDate: string;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string | null;
    accountName: string;
  }[];
};

export const getDashboardData = cache(async (yearMonth: string): Promise<DashboardData> => {
  // Parse year-month to get start/end dates
  const [year, month] = yearMonth.split('-').map(Number);
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
  const categoryBreakdown = monthBudgets.map((budget) => {
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

  // 4. Get income for the month
  const incomeData = await db
    .select({
      amount: income.amount,
    })
    .from(income)
    .where(and(gte(income.receivedDate, startDate), lte(income.receivedDate, endDate)));

  const totalIncome = incomeData.reduce((sum, inc) => sum + inc.amount, 0);

  // 5. Calculate totals
  const totalBudget = categoryBreakdown.reduce((sum, cat) => sum + cat.budget, 0);
  const totalSpent = categoryBreakdown.reduce((sum, cat) => sum + cat.spent, 0);
  const netBalance = totalIncome - totalSpent;

  // 6. Get recent 5 expenses
  const recentExpenses = await db
    .select({
      entryId: entries.id,
      description: transactions.description,
      amount: entries.amount,
      dueDate: entries.dueDate,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountName: accounts.name,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(accounts, eq(entries.accountId, accounts.id))
    .where(and(gte(entries.dueDate, startDate), lte(entries.dueDate, endDate)))
    .orderBy(desc(entries.createdAt))
    .limit(5);

  // 7. Get recent 5 income
  const recentIncome = await db
    .select({
      incomeId: income.id,
      description: income.description,
      amount: income.amount,
      receivedDate: income.receivedDate,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountName: accounts.name,
    })
    .from(income)
    .innerJoin(categories, eq(income.categoryId, categories.id))
    .innerJoin(accounts, eq(income.accountId, accounts.id))
    .where(and(gte(income.receivedDate, startDate), lte(income.receivedDate, endDate)))
    .orderBy(desc(income.createdAt))
    .limit(5);

  return {
    totalSpent,
    totalBudget,
    totalIncome,
    netBalance,
    categoryBreakdown,
    recentExpenses,
    recentIncome,
  };
});
