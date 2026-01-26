'use server';

import { db } from '@/lib/db';
import { entries, transactions, categories, userSettings, budgets } from '@/lib/schema';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { sendEmail } from '@/lib/email/send';
import {
  generateDigestHtml,
  generateDigestText,
  type YesterdaySpending,
  type BudgetInsights,
  type FinancialDigestData,
  type OverBudgetCategory,
  type CriticalBudgetCategory,
  type MonthlyBudgetOverview
} from '@/lib/email/digest-template';
import { logError, logForDebugging } from '@/lib/logger';
import { ErrorIds } from '@/constants/errorIds';
import { defaultLocale, type Locale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';
import { requireCronAuth } from '@/lib/cron-auth';
import { activeTransactionCondition } from '@/lib/query-helpers';

export interface DigestResult {
  success: boolean;
  usersProcessed: number;
  emailsSent: number;
  emailsFailed: number;
  errors: Array<{ userId: string; error: string }>;
}

function getUserYesterdayDateStr(timezone: string): string {
  const now = new Date();

  // Format current UTC time in user's timezone to get local date
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const todayLocalStr = formatter.format(now); // "2026-01-26"
  const [year, month, day] = todayLocalStr.split('-').map(Number);

  // Calculate yesterday
  const todayDate = new Date(year, month - 1, day);
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);

  // Format as YYYY-MM-DD
  const yYear = yesterdayDate.getFullYear();
  const yMonth = String(yesterdayDate.getMonth() + 1).padStart(2, '0');
  const yDay = String(yesterdayDate.getDate()).padStart(2, '0');

  return `${yYear}-${yMonth}-${yDay}`;
}

function getCurrentYearMonth(timezone: string): string {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
  });

  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;

  return `${year}-${month}`;
}

async function getYesterdaySpending(
  userId: string,
  yesterdayDateStr: string
): Promise<YesterdaySpending> {
  try {
    // Query entries for yesterday, grouped by category
    const spendingByCategory = await db
      .select({
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
        amount: sql<number>`CAST(SUM(${entries.amount}) AS INTEGER)`,
      })
      .from(entries)
      .innerJoin(transactions, eq(entries.transactionId, transactions.id))
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(entries.userId, userId),
          eq(entries.purchaseDate, yesterdayDateStr),
          activeTransactionCondition()
        )
      )
      .groupBy(categories.id, categories.name, categories.icon, categories.color)
      .orderBy(sql`SUM(${entries.amount}) DESC`);

    if (spendingByCategory.length === 0) {
      return {
        total: 0,
        isEmpty: true,
        byCategory: [],
      };
    }

    const total = spendingByCategory.reduce((sum, cat) => sum + cat.amount, 0);

    return {
      total,
      isEmpty: false,
      byCategory: spendingByCategory.map(cat => ({
        categoryName: cat.categoryName,
        categoryIcon: cat.categoryIcon,
        categoryColor: cat.categoryColor,
        amount: cat.amount,
      })),
    };
  } catch (error) {
    logError(ErrorIds.DIGEST_QUERY_FAILED, "Failed to query yesterday's spending", error, { userId });
    return {
      total: 0,
      isEmpty: true,
      byCategory: [],
    };
  }
}

async function getBudgetInsightsForUser(
  userId: string,
  yearMonth: string
): Promise<BudgetInsights> {
  try {
    // Replicate getBudgetsWithSpending logic but with explicit userId
    const [year, month] = yearMonth.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endOfMonth = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${endOfMonth}`;

    // Get budgets for this month
    const monthBudgets = await db
      .select({
        categoryId: budgets.categoryId,
        categoryName: categories.name,
        budget: budgets.amount,
      })
      .from(budgets)
      .innerJoin(categories, eq(budgets.categoryId, categories.id))
      .where(and(eq(budgets.userId, userId), eq(budgets.yearMonth, yearMonth)));

    // Get spending by category
    const spending = await db
      .select({
        categoryId: transactions.categoryId,
        spent: sql<number>`CAST(SUM(${entries.amount}) AS INTEGER)`,
      })
      .from(entries)
      .innerJoin(transactions, eq(entries.transactionId, transactions.id))
      .where(
        and(
          eq(entries.userId, userId),
          gte(entries.purchaseDate, startDate),
          lte(entries.purchaseDate, endDate),
          activeTransactionCondition()
        )
      )
      .groupBy(transactions.categoryId);

    const overBudget: OverBudgetCategory[] = [];
    const critical: CriticalBudgetCategory[] = [];
    let healthyCount = 0;
    let totalBudget = 0;
    let totalSpent = 0;

    // Create a map of spending by category
    const spendingMap = new Map(spending.map(s => [s.categoryId, s.spent]));

    monthBudgets.forEach(budget => {
      if (!budget.budget || budget.budget === 0) return; // Skip categories without budgets

      const spent = spendingMap.get(budget.categoryId) || 0;
      const percentage = (spent / budget.budget) * 100;

      totalBudget += budget.budget;
      totalSpent += spent;

      if (percentage > 100) {
        // Over budget
        overBudget.push({
          category: budget.categoryName,
          spent,
          budget: budget.budget,
          overAmount: spent - budget.budget,
        });
      } else if (percentage >= 80) {
        // Critical (80-100%)
        critical.push({
          category: budget.categoryName,
          spent,
          budget: budget.budget,
          percentage,
          remaining: budget.budget - spent,
        });
      } else {
        // Healthy (<80%)
        healthyCount++;
      }
    });

    // Monthly overview
    const monthlyOverview: MonthlyBudgetOverview | null =
      totalBudget > 0
        ? {
            spent: totalSpent,
            budget: totalBudget,
            percentage: (totalSpent / totalBudget) * 100,
          }
        : null;

    return {
      overBudget,
      critical,
      healthyCount,
      monthlyOverview,
    };
  } catch (error) {
    logError(ErrorIds.DIGEST_QUERY_FAILED, 'Failed to query budget insights', error, { userId });
    return {
      overBudget: [],
      critical: [],
      healthyCount: 0,
      monthlyOverview: null,
    };
  }
}

async function sendUserDigest(
  userId: string,
  settings: typeof userSettings.$inferSelect
): Promise<boolean> {
  try {
    const timezone = settings.timezone || 'UTC';
    const locale: Locale = (settings.locale as Locale) || defaultLocale;
    const yesterdayDateStr = getUserYesterdayDateStr(timezone);
    const currentYearMonth = getCurrentYearMonth(timezone);

    logForDebugging('digest', 'Calculating digest for user', {
      userId,
      timezone,
      yesterdayDate: yesterdayDateStr,
      currentMonth: currentYearMonth,
    });

    // Fetch financial data
    const [yesterday, budgets] = await Promise.all([
      getYesterdaySpending(userId, yesterdayDateStr),
      getBudgetInsightsForUser(userId, currentYearMonth),
    ]);

    // Skip if no data (no spending AND no budget alerts)
    const hasBudgetAlerts =
      budgets.overBudget.length > 0 ||
      budgets.critical.length > 0 ||
      (budgets.monthlyOverview !== null && budgets.monthlyOverview.percentage >= 80);

    if (yesterday.isEmpty && !hasBudgetAlerts) {
      logForDebugging('digest', 'Skipping user - no spending and no budget alerts', { userId });
      return true; // Consider this a success (just nothing to send)
    }

    // Format date for display
    const yesterdayDate = new Date(yesterdayDateStr + 'T12:00:00Z'); // Use noon UTC to avoid timezone issues
    const dateFormatter = new Intl.DateTimeFormat(locale, {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedDate = dateFormatter.format(yesterdayDate);

    // Generate email content
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fluxo.sh';
    const digestData: FinancialDigestData = {
      date: formattedDate,
      yesterday,
      budgets,
      appUrl,
      timezone,
      locale,
    };

    const html = generateDigestHtml(digestData);
    const text = generateDigestText(digestData);

    // Send with retries
    const MAX_RETRIES = 2;
    let attempts = 0;

    while (attempts < MAX_RETRIES) {
      const result = await sendEmail({
        to: settings.notificationEmail!,
        subject: translateWithLocale(locale, 'emails.digest.subject', { date: formattedDate }),
        html,
        text,
      });

      if (result.success) {
        logForDebugging('digest', 'Successfully sent digest', {
          userId,
          yesterdayTotal: yesterday.total,
          categoriesCount: yesterday.byCategory.length,
          overBudgetCount: budgets.overBudget.length,
          criticalCount: budgets.critical.length,
        });
        return true;
      }

      attempts++;
      if (attempts < MAX_RETRIES) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }

    throw new Error('Failed to send email after retries');
  } catch (error) {
    logError(ErrorIds.DIGEST_SEND_FAILED, 'Failed to send user digest', error, { userId });
    return false;
  }
}

export async function sendAllDailyDigests(): Promise<DigestResult> {
  // Defense-in-depth: verify cron authorization
  await requireCronAuth();

  const result: DigestResult = {
    success: true,
    usersProcessed: 0,
    emailsSent: 0,
    emailsFailed: 0,
    errors: [],
  };

  try {
    // Get all users with notifications enabled and valid email
    const users = await db
      .select()
      .from(userSettings)
      .where(
        and(
          eq(userSettings.notificationsEnabled, true)
        )
      );

    logForDebugging('digest', 'Starting daily digest for all users', {
      totalUsers: users.length,
    });

    for (const settings of users) {
      // Skip users without notification email
      if (!settings.notificationEmail) {
        logForDebugging('digest', 'Skipping user - no notification email', {
          userId: settings.userId,
        });
        continue;
      }

      result.usersProcessed++;

      const success = await sendUserDigest(settings.userId, settings);

      if (success) {
        result.emailsSent++;
      } else {
        result.emailsFailed++;
        result.errors.push({
          userId: settings.userId,
          error: 'Failed to send digest',
        });
      }
    }

    logForDebugging('digest', 'Completed daily digest for all users', result);

    return result;
  } catch (error) {
    logError(ErrorIds.DIGEST_SEND_FAILED, 'Failed to send daily digests', error);
    result.success = false;
    return result;
  }
}
