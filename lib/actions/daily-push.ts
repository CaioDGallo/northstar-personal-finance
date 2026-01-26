'use server';

import { db } from '@/lib/db';
import { entries, transactions, budgets, categories, userSettings } from '@/lib/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { activeTransactionCondition } from '@/lib/query-helpers';
import { sendPushToUser } from '@/lib/services/push-sender';
import { formatCurrencyWithLocale } from '@/lib/utils';
import { defaultLocale, locales, type Locale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';
import { requireCronAuth } from '@/lib/cron-auth';
import { buildBudgetsSettingsUrl, buildBudgetsUrl, buildDashboardUrl } from '@/lib/notifications/push-links';

export interface DailyPushResult {
  success: boolean;
  usersProcessed: number;
  pushesSent: number;
  pushesFailed: number;
  errors: Array<{ userId: string; error: string }>;
}

type BudgetSnapshotItem = {
  categoryId: number;
  categoryName: string;
  budget: number;
  spent: number;
  percentage: number;
};

type BudgetSnapshot = {
  overBudget: BudgetSnapshotItem[];
  critical: BudgetSnapshotItem[];
  monthlyOverview: { spent: number; budget: number; percentage: number } | null;
  monthlySpent: number;
};

function getUserYesterdayDateStr(timezone: string): string {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const todayLocalStr = formatter.format(now);
  const [year, month, day] = todayLocalStr.split('-').map(Number);

  const todayDate = new Date(year, month - 1, day);
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);

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
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;

  return `${year}-${month}`;
}

async function getYesterdayTotal(userId: string, yesterdayDateStr: string): Promise<number> {
  const result = await db
    .select({
      total: sql<number>`CAST(COALESCE(SUM(${entries.amount}), 0) AS INTEGER)`,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .where(
      and(
        eq(entries.userId, userId),
        eq(entries.purchaseDate, yesterdayDateStr),
        activeTransactionCondition()
      )
    )
    .limit(1);

  return result[0]?.total ?? 0;
}

async function getBudgetSnapshot(userId: string, yearMonth: string): Promise<BudgetSnapshot> {
  const [year, month] = yearMonth.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endOfMonth = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, '0')}-${endOfMonth}`;

  const [monthBudgets, spending] = await Promise.all([
    db
      .select({
        categoryId: budgets.categoryId,
        categoryName: categories.name,
        budget: budgets.amount,
      })
      .from(budgets)
      .innerJoin(categories, eq(budgets.categoryId, categories.id))
      .where(and(eq(budgets.userId, userId), eq(budgets.yearMonth, yearMonth))),
    db
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
      .groupBy(transactions.categoryId),
  ]);

  const spendingMap = new Map(spending.map(item => [item.categoryId, item.spent]));
  const monthlySpent = spending.reduce((sum, item) => sum + item.spent, 0);

  const overBudget: BudgetSnapshotItem[] = [];
  const critical: BudgetSnapshotItem[] = [];
  let totalBudget = 0;
  let totalSpent = 0;

  for (const budget of monthBudgets) {
    if (!budget.budget || budget.budget === 0) continue;

    const spent = spendingMap.get(budget.categoryId) || 0;
    const percentage = (spent / budget.budget) * 100;

    totalBudget += budget.budget;
    totalSpent += spent;

    if (percentage > 100) {
      overBudget.push({
        categoryId: budget.categoryId,
        categoryName: budget.categoryName,
        budget: budget.budget,
        spent,
        percentage,
      });
    } else if (percentage >= 80) {
      critical.push({
        categoryId: budget.categoryId,
        categoryName: budget.categoryName,
        budget: budget.budget,
        spent,
        percentage,
      });
    }
  }

  const monthlyOverview = totalBudget > 0
    ? {
        spent: totalSpent,
        budget: totalBudget,
        percentage: (totalSpent / totalBudget) * 100,
      }
    : null;

  return {
    overBudget,
    critical,
    monthlyOverview,
    monthlySpent,
  };
}

function pickMostUrgent(items: BudgetSnapshotItem[]): BudgetSnapshotItem | null {
  if (items.length === 0) return null;
  return items.slice().sort((a, b) => b.percentage - a.percentage)[0];
}

async function sendUserDailyPush(
  userId: string,
  settings: typeof userSettings.$inferSelect
): Promise<{ sent: boolean; skipped: boolean; error?: string }> {
  const timezone = settings.timezone || 'UTC';
  const locale = locales.includes(settings.locale as Locale)
    ? (settings.locale as Locale)
    : defaultLocale;
  const yesterdayDateStr = getUserYesterdayDateStr(timezone);
  const currentYearMonth = getCurrentYearMonth(timezone);

  const [yesterdayTotal, snapshot] = await Promise.all([
    getYesterdayTotal(userId, yesterdayDateStr),
    getBudgetSnapshot(userId, currentYearMonth),
  ]);

  if (!snapshot.monthlyOverview && snapshot.monthlySpent === 0 && yesterdayTotal === 0) {
    return { sent: false, skipped: true };
  }

  const formatCurrency = (cents: number) => formatCurrencyWithLocale(cents, locale);
  const topOverBudget = pickMostUrgent(snapshot.overBudget);
  const topCritical = pickMostUrgent(snapshot.critical);

  let title = '';
  let body = '';
  let url = buildDashboardUrl(currentYearMonth);

  if (topOverBudget) {
    title = translateWithLocale(locale, 'push.dailyDigest.overBudget.title');
    body = translateWithLocale(locale, 'push.dailyDigest.overBudget.body', {
      category: topOverBudget.categoryName,
      percentage: Math.floor(topOverBudget.percentage),
    });
    url = buildBudgetsUrl({ yearMonth: currentYearMonth, categoryId: topOverBudget.categoryId });
  } else if (topCritical) {
    title = translateWithLocale(locale, 'push.dailyDigest.nearLimit.title');
    body = translateWithLocale(locale, 'push.dailyDigest.nearLimit.body', {
      category: topCritical.categoryName,
      percentage: Math.floor(topCritical.percentage),
    });
    url = buildBudgetsUrl({ yearMonth: currentYearMonth, categoryId: topCritical.categoryId });
  } else if (snapshot.monthlyOverview) {
    if (yesterdayTotal > 0) {
      title = translateWithLocale(locale, 'push.dailyDigest.spending.title');
      body = translateWithLocale(locale, 'push.dailyDigest.spending.body', {
        yesterday: formatCurrency(yesterdayTotal),
        spent: formatCurrency(snapshot.monthlyOverview.spent),
      });
    } else if (snapshot.monthlySpent > 0) {
      title = translateWithLocale(locale, 'push.dailyDigest.summary.title');
      body = translateWithLocale(locale, 'push.dailyDigest.summary.body', {
        spent: formatCurrency(snapshot.monthlyOverview.spent),
        budget: formatCurrency(snapshot.monthlyOverview.budget),
      });
    } else {
      title = translateWithLocale(locale, 'push.dailyDigest.noSpend.title');
      body = translateWithLocale(locale, 'push.dailyDigest.noSpend.body');
    }
  } else {
    title = translateWithLocale(locale, 'push.dailyDigest.noBudget.title');
    body = translateWithLocale(locale, 'push.dailyDigest.noBudget.body', {
      spent: formatCurrency(snapshot.monthlySpent || yesterdayTotal),
    });
    url = buildBudgetsSettingsUrl(currentYearMonth);
  }

  const result = await sendPushToUser(userId, {
    title,
    body,
    url,
    tag: `daily-digest-${yesterdayDateStr}`,
    type: 'daily_digest',
  });

  if (result.sent > 0) {
    return { sent: true, skipped: false };
  }

  if (result.failed > 0) {
    return { sent: false, skipped: false, error: 'Failed to send to all devices' };
  }

  return { sent: false, skipped: true };
}

export async function sendAllDailyPushes(): Promise<DailyPushResult> {
  await requireCronAuth();

  const result: DailyPushResult = {
    success: true,
    usersProcessed: 0,
    pushesSent: 0,
    pushesFailed: 0,
    errors: [],
  };

  try {
    const users = await db
      .select()
      .from(userSettings)
      .where(
        and(
          eq(userSettings.notificationsEnabled, true),
          eq(userSettings.pushNotificationsEnabled, true)
        )
      );

    for (const settings of users) {
      result.usersProcessed++;

      const sendResult = await sendUserDailyPush(settings.userId, settings);

      if (sendResult.sent || sendResult.skipped) {
        if (sendResult.sent) {
          result.pushesSent++;
        }
        continue;
      }

      result.pushesFailed++;
      result.errors.push({
        userId: settings.userId,
        error: sendResult.error || 'Failed to send daily push',
      });
    }

    return result;
  } catch (error) {
    console.error('[daily-push] Failed:', error);
    result.success = false;
    return result;
  }
}
