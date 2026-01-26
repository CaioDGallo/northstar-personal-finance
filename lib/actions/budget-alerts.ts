'use server';

import { db } from '@/lib/db';
import { budgets, entries, userSettings, categories, budgetAlerts } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { sendPushToUser } from '@/lib/services/push-sender';
import { getCurrentYearMonth } from '@/lib/utils';
import { defaultLocale, locales, type Locale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';
import { buildBudgetsUrl } from '@/lib/notifications/push-links';

interface BudgetAlertResult {
  sent: boolean;
  threshold?: number;
  error?: string;
}

const BUDGET_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export async function checkBudgetAlerts(
  userId: string,
  categoryId: number
): Promise<BudgetAlertResult> {
  try {
    // Get user settings
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId))
      .limit(1);

    if (!settings?.pushNotificationsEnabled) {
      return { sent: false, error: 'Push notifications not enabled' };
    }

    const locale = locales.includes(settings.locale as Locale)
      ? (settings.locale as Locale)
      : defaultLocale;
    const currentMonth = getCurrentYearMonth();

    // Get budget for this category and month
    const [budget] = await db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.userId, userId),
          eq(budgets.categoryId, categoryId),
          eq(budgets.yearMonth, currentMonth)
        )
      )
      .limit(1);

    if (!budget) {
      return { sent: false, error: 'No budget found for category' };
    }

    // Calculate total spent in this category for current month
    const allEntries = await db
      .select()
      .from(entries)
      .innerJoin((await import('@/lib/schema')).transactions, eq(entries.transactionId, (await import('@/lib/schema')).transactions.id))
      .where(
        and(
          eq(entries.userId, userId),
          eq((await import('@/lib/schema')).transactions.categoryId, categoryId),
          eq((await import('@/lib/schema')).transactions.ignored, false)
        )
      );

    // Filter entries by purchase date month (budget impact)
    const monthEntries = allEntries.filter((e) => {
      const purchaseDate = new Date(e.entries.purchaseDate);
      const entryMonth = `${purchaseDate.getFullYear()}-${String(purchaseDate.getMonth() + 1).padStart(2, '0')}`;
      return entryMonth === currentMonth;
    });

    const totalSpent = monthEntries.reduce((sum, e) => sum + e.entries.amount, 0);
    const percentage = (totalSpent / budget.amount) * 100;

    // Determine threshold (80%, 100%, 120%)
    let threshold: number | undefined;
    let shouldAlert = false;

    if (percentage >= 120) {
      threshold = 120;
      shouldAlert = true;
    } else if (percentage >= 100) {
      threshold = 100;
      shouldAlert = true;
    } else if (percentage >= 80) {
      threshold = 80;
      shouldAlert = true;
    }

    if (!shouldAlert || threshold === undefined) {
      return { sent: false };
    }

    const now = new Date();

    const [lastAlert] = await db
      .select()
      .from(budgetAlerts)
      .where(
        and(
          eq(budgetAlerts.userId, userId),
          eq(budgetAlerts.categoryId, categoryId),
          eq(budgetAlerts.yearMonth, currentMonth),
          eq(budgetAlerts.threshold, threshold)
        )
      )
      .limit(1);

    if (lastAlert) {
      const elapsed = now.getTime() - lastAlert.lastSentAt.getTime();
      if (elapsed < BUDGET_ALERT_COOLDOWN_MS) {
        return { sent: false };
      }
    }

    // Get category name
    const [category] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    const categoryName = category?.name || 'Unknown';

    // Build push notification
    let title: string;
    let body: string;

    if (threshold === 120) {
      title = translateWithLocale(locale, 'push.budgetAlert.120.title');
      body = translateWithLocale(locale, 'push.budgetAlert.120.body', {
        category: categoryName,
        percentage: Math.floor(percentage),
      });
    } else if (threshold === 100) {
      title = translateWithLocale(locale, 'push.budgetAlert.100.title');
      body = translateWithLocale(locale, 'push.budgetAlert.100.body', {
        category: categoryName,
      });
    } else {
      title = translateWithLocale(locale, 'push.budgetAlert.80.title');
      body = translateWithLocale(locale, 'push.budgetAlert.80.body', {
        category: categoryName,
        percentage: Math.floor(percentage),
      });
    }

    // Send push notification with yearMonth tag to prevent duplicates
    const result = await sendPushToUser(userId, {
      title,
      body,
      url: buildBudgetsUrl({ yearMonth: currentMonth, categoryId }),
      tag: `budget-alert-${categoryId}-${currentMonth}-${threshold}`,
      type: 'budget_alert',
    });

    if (result.sent > 0) {
      await db
        .insert(budgetAlerts)
        .values({
          userId,
          categoryId,
          yearMonth: currentMonth,
          threshold,
          lastSentAt: now,
        })
        .onConflictDoUpdate({
          target: [
            budgetAlerts.userId,
            budgetAlerts.categoryId,
            budgetAlerts.yearMonth,
            budgetAlerts.threshold,
          ],
          set: {
            lastSentAt: now,
          },
        });
    }

    return {
      sent: result.sent > 0,
      threshold,
    };
  } catch (error) {
    console.error('[budget-alerts] Failed:', error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
