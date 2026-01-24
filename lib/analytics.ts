import { db } from '@/lib/db';
import { userSettings } from '@/lib/schema';
import { getPostHogClient } from '@/lib/posthog-server';
import { eq } from 'drizzle-orm';

/**
 * Analytics helper module for tracking user activation and engagement metrics.
 *
 * Uses hybrid approach:
 * - DB flags (userSettings timestamps) for deduplication and in-app personalization
 * - PostHog events for flexible querying and funnel analysis
 */

interface BaseEventData {
  userId: string;
}

interface FirstExpenseData extends BaseEventData {
  wasImported: boolean;
  accountType: string;
  userCreatedAt: Date;
  hadCategorySuggestion?: boolean;
}

interface FirstImportData extends BaseEventData {
  importType: 'expenses' | 'mixed';
  expenseCount: number;
  incomeCount: number;
  rowCount: number;
  accountType: string;
  bankSource: string;
  hadDuplicates: boolean;
  installmentsDetected: boolean;
  userCreatedAt: Date;
}

interface UserActivityData extends BaseEventData {
  activityType: 'create_expense' | 'edit_expense' | 'delete_expense' |
                'create_income' | 'edit_income' | 'delete_income' |
                'create_transfer' | 'edit_transfer' | 'delete_transfer' |
                'create_budget' | 'edit_budget' | 'delete_budget' |
                'create_category' | 'edit_category' | 'delete_category' |
                'pay_fatura' | 'view_dashboard' |
                'create_bill_reminder' | 'edit_bill_reminder';
  sessionId?: string;
}

interface FirstBudgetData extends BaseEventData {
  budgetType: 'category_budget' | 'monthly_total_budget';
  budgetsCount: number;
  hasExistingTransactions: boolean;
  userCreatedAt: Date;
}

interface FirstCategoryData extends BaseEventData {
  categoryType: 'expense' | 'income';
  isImportDefault: boolean;
  userCreatedAt: Date;
}

interface ExportData extends BaseEventData {
  exportFormat: 'csv';
  timeRange: 'month' | 'year' | 'all';
  includeExpenses: boolean;
  includeIncome: boolean;
  includeTransfers: boolean;
  recordCount: number;
  userCreatedAt: Date;
  isFirstExport: boolean;
}

/**
 * Calculate time difference in various units
 */
function calculateTimeDifference(startDate: Date, endDate: Date) {
  const diffMs = endDate.getTime() - startDate.getTime();
  return {
    seconds: Math.floor(diffMs / 1000),
    minutes: Math.floor(diffMs / (1000 * 60)),
    hours: Math.floor(diffMs / (1000 * 60 * 60)),
    days: Math.floor(diffMs / (1000 * 60 * 60 * 24)),
  };
}

/**
 * Get or create user settings record
 */
async function getUserSettings(userId: string) {
  let settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, userId),
  });

  if (!settings) {
    // Create default settings if they don't exist
    const [newSettings] = await db.insert(userSettings)
      .values({ userId })
      .returning();
    settings = newSettings;
  }

  return settings;
}

/**
 * Track user's first expense creation
 */
export async function trackFirstExpense(data: FirstExpenseData) {
  try {
    const settings = await getUserSettings(data.userId);

    // Check if already tracked
    if (settings.firstExpenseCreatedAt) {
      return; // Already tracked, skip
    }

    // Update DB flag
    await db.update(userSettings)
      .set({
        firstExpenseCreatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, data.userId));

    // Send PostHog event
    const posthog = getPostHogClient();
    if (posthog) {
      const timeDiff = calculateTimeDifference(data.userCreatedAt, new Date());

      posthog.capture({
        distinctId: data.userId,
        event: 'first_expense_created',
        properties: {
          time_to_first_expense_seconds: timeDiff.seconds,
          time_to_first_expense_minutes: timeDiff.minutes,
          time_to_first_expense_hours: timeDiff.hours,
          was_imported: data.wasImported,
          account_type: data.accountType,
          had_category_suggestion: data.hadCategorySuggestion || false,
        },
      });
    }
  } catch (error) {
    console.error('Failed to track first expense:', error);
    // Don't throw - analytics should never break user flows
  }
}

/**
 * Track user's first bulk import (5+ rows)
 */
export async function trackFirstBulkImport(data: FirstImportData) {
  try {
    const settings = await getUserSettings(data.userId);

    // Check if already tracked
    if (settings.firstImportCompletedAt) {
      return; // Already tracked, skip
    }

    // Only track "bulk" imports (5+ rows)
    if (data.rowCount < 5) {
      return;
    }

    // Update DB flag
    await db.update(userSettings)
      .set({
        firstImportCompletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, data.userId));

    // Send PostHog event
    const posthog = getPostHogClient();
    if (posthog) {
      const timeDiff = calculateTimeDifference(data.userCreatedAt, new Date());

      posthog.capture({
        distinctId: data.userId,
        event: 'first_bulk_import_completed',
        properties: {
          import_type: data.importType,
          expense_count: data.expenseCount,
          income_count: data.incomeCount,
          row_count: data.rowCount,
          account_type: data.accountType,
          bank_source: data.bankSource,
          days_since_signup: timeDiff.days,
          time_to_first_import_minutes: timeDiff.minutes,
          had_duplicates: data.hadDuplicates,
          installments_detected: data.installmentsDetected,
        },
      });
    }
  } catch (error) {
    console.error('Failed to track first bulk import:', error);
  }
}

/**
 * Track user activity (engagement metric for WAD calculation)
 */
export async function trackUserActivity(data: UserActivityData) {
  try {
    const posthog = getPostHogClient();
    if (!posthog) return;

    posthog.capture({
      distinctId: data.userId,
      event: 'user_activity',
      properties: {
        activity_type: data.activityType,
        session_id: data.sessionId,
      },
    });
  } catch (error) {
    console.error('Failed to track user activity:', error);
  }
}

/**
 * Track user's first budget creation
 */
export async function trackFirstBudget(data: FirstBudgetData) {
  try {
    const settings = await getUserSettings(data.userId);

    // Check if already tracked
    if (settings.firstBudgetCreatedAt) {
      return;
    }

    // Update DB flag
    await db.update(userSettings)
      .set({
        firstBudgetCreatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, data.userId));

    // Send PostHog event
    const posthog = getPostHogClient();
    if (posthog) {
      const timeDiff = calculateTimeDifference(data.userCreatedAt, new Date());

      posthog.capture({
        distinctId: data.userId,
        event: 'first_budget_created',
        properties: {
          budget_type: data.budgetType,
          budgets_count: data.budgetsCount,
          days_since_signup: timeDiff.days,
          has_existing_transactions: data.hasExistingTransactions,
        },
      });
    }
  } catch (error) {
    console.error('Failed to track first budget:', error);
  }
}

/**
 * Track user's first custom category creation
 */
export async function trackFirstCustomCategory(data: FirstCategoryData) {
  try {
    const settings = await getUserSettings(data.userId);

    // Check if already tracked
    if (settings.firstCustomCategoryCreatedAt) {
      return;
    }

    // Only track custom categories (not import defaults)
    if (data.isImportDefault) {
      return;
    }

    // Update DB flag
    await db.update(userSettings)
      .set({
        firstCustomCategoryCreatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, data.userId));

    // Send PostHog event
    const posthog = getPostHogClient();
    if (posthog) {
      const timeDiff = calculateTimeDifference(data.userCreatedAt, new Date());

      posthog.capture({
        distinctId: data.userId,
        event: 'custom_category_created',
        properties: {
          category_type: data.categoryType,
          days_since_signup: timeDiff.days,
        },
      });
    }
  } catch (error) {
    console.error('Failed to track first custom category:', error);
  }
}

/**
 * Track data export (power user metric)
 * Note: Not deduplicated - tracks every export
 */
export async function trackExport(data: ExportData) {
  try {
    const posthog = getPostHogClient();
    if (!posthog) return;

    const timeDiff = calculateTimeDifference(data.userCreatedAt, new Date());

    posthog.capture({
      distinctId: data.userId,
      event: 'data_exported',
      properties: {
        export_format: data.exportFormat,
        time_range: data.timeRange,
        include_expenses: data.includeExpenses,
        include_income: data.includeIncome,
        include_transfers: data.includeTransfers,
        record_count: data.recordCount,
        days_since_signup: timeDiff.days,
        is_first_export: data.isFirstExport,
      },
    });

    // Update first export flag if needed
    if (data.isFirstExport) {
      await db.update(userSettings)
        .set({
          firstExportCompletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, data.userId));
    }
  } catch (error) {
    console.error('Failed to track export:', error);
  }
}
