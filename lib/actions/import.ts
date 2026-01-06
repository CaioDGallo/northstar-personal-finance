'use server';

import { db } from '@/lib/db';
import { transactions, entries, accounts, categories, income } from '@/lib/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ValidatedImportRow } from '@/lib/import/types';
import { getFaturaMonth, getFaturaPaymentDueDate } from '@/lib/fatura-utils';
import { ensureFaturaExists, updateFaturaTotal } from '@/lib/actions/faturas';
import { getDefaultImportCategories } from '@/lib/actions/categories';
import { getCurrentUserId } from '@/lib/auth';
import { checkBulkRateLimit } from '@/lib/rate-limit';
import { t } from '@/lib/i18n/server-errors';

type ImportExpenseData = {
  rows: ValidatedImportRow[];
  accountId: number;
  categoryId: number;
};

type ImportResult =
  | {
      success: true;
      imported: number;
    }
  | {
      success: false;
      error: string;
    };

export async function importExpenses(data: ImportExpenseData): Promise<ImportResult> {
  const { rows, accountId, categoryId } = data;

  if (rows.length === 0) {
    return { success: false, error: await t('errors.noValidRows') };
  }

  // Validate accountId and categoryId exist
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return { success: false, error: await t('errors.invalidAccountId') };
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { success: false, error: await t('errors.invalidCategoryId') };
  }

  try {
    const userId = await getCurrentUserId();

    const rateLimit = await checkBulkRateLimit(userId);
    if (!rateLimit.allowed) {
      return { success: false, error: await t('errors.tooManyAttempts', { retryAfter: rateLimit.retryAfter }) };
    }

    // Verify account exists and fetch billing config
    const account = await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, accountId))).limit(1);
    if (account.length === 0) {
      return { success: false, error: await t('errors.accountNotFound') };
    }

    // Verify category exists
    const category = await db.select().from(categories).where(and(eq(categories.userId, userId), eq(categories.id, categoryId))).limit(1);
    if (category.length === 0) {
      return { success: false, error: await t('errors.categoryNotFound') };
    }

    // Check if this is a credit card with billing config
    const isCreditCard = account[0].type === 'credit_card';
    const hasBillingConfig = isCreditCard && account[0].closingDay && account[0].paymentDueDay;

    // Track affected fatura months for credit card accounts
    const affectedFaturas = new Set<string>();

    // Use transaction for atomicity
    await db.transaction(async (tx) => {
      for (const row of rows) {
        // Calculate fatura month and due date based on account type
        let faturaMonth: string;
        let dueDate: string;

        if (hasBillingConfig) {
          // Credit card with billing config: compute fatura month and due date
          const purchaseDate = new Date(row.date + 'T00:00:00Z');
          faturaMonth = getFaturaMonth(purchaseDate, account[0].closingDay!);
          dueDate = getFaturaPaymentDueDate(faturaMonth, account[0].paymentDueDay!, account[0].closingDay!);
          affectedFaturas.add(faturaMonth);
        } else {
          // Non-credit card or card without config: fatura = purchase month
          faturaMonth = row.date.slice(0, 7);
          dueDate = row.date;
        }

        // 1. Create transaction (single installment)
        const [transaction] = await tx
          .insert(transactions)
          .values({
            userId,
            description: row.description,
            totalAmount: row.amountCents,
            totalInstallments: 1,
            categoryId,
          })
          .returning();

        // 2. Create single entry with correct fatura month and due date
        await tx.insert(entries).values({
          userId,
          transactionId: transaction.id,
          accountId,
          amount: row.amountCents,
          purchaseDate: row.date,
          faturaMonth,
          dueDate,
          installmentNumber: 1,
          paidAt: null,
        });
      }
    });

    // Ensure faturas exist and update totals for credit cards
    if (hasBillingConfig) {
      for (const month of affectedFaturas) {
        await ensureFaturaExists(accountId, month);
        await updateFaturaTotal(accountId, month);
      }
    }

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/faturas');

    return { success: true, imported: rows.length };
  } catch (error) {
    console.error('[import:expenses] Failed:', error);
    return { success: false, error: await t('errors.failedToImport') };
  }
}

type ImportMixedData = {
  rows: ValidatedImportRow[];
  accountId: number;
};

type ImportMixedResult =
  | {
      success: true;
      importedExpenses: number;
      importedIncome: number;
      skippedDuplicates: number;
    }
  | {
      success: false;
      error: string;
    };

export async function importMixed(data: ImportMixedData): Promise<ImportMixedResult> {
  const { rows, accountId } = data;

  if (rows.length === 0) {
    return { success: false, error: await t('errors.noValidRows') };
  }

  // Validate accountId
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return { success: false, error: await t('errors.invalidAccountId') };
  }

  try {
    const userId = await getCurrentUserId();

    const rateLimit = await checkBulkRateLimit(userId);
    if (!rateLimit.allowed) {
      return { success: false, error: await t('errors.tooManyAttempts', { retryAfter: rateLimit.retryAfter }) };
    }

    // Get default import categories
    const defaultCategories = await getDefaultImportCategories();
    if (!defaultCategories.expense) {
      return { success: false, error: await t('errors.noDefaultExpenseCategory') };
    }
    if (!defaultCategories.income) {
      return { success: false, error: await t('errors.noDefaultIncomeCategory') };
    }

    const expenseCategoryId = defaultCategories.expense.id;
    const incomeCategoryId = defaultCategories.income.id;

    // Verify account exists and fetch billing config
    const account = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
      .limit(1);

    if (account.length === 0) {
      return { success: false, error: await t('errors.accountNotFound') };
    }

    // Separate rows by type
    const expenseRows = rows.filter((r) => r.type === 'expense');
    const incomeRows = rows.filter((r) => r.type === 'income');

    // Collect external IDs for duplicate detection
    const externalIds = rows.map((r) => r.externalId).filter((id): id is string => !!id);

    // Query existing records with these external IDs
    let existingIds = new Set<string>();

    if (externalIds.length > 0) {
      const existingTransactions = await db
        .select({ externalId: transactions.externalId })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), inArray(transactions.externalId, externalIds)));

      const existingIncome = await db
        .select({ externalId: income.externalId })
        .from(income)
        .where(and(eq(income.userId, userId), inArray(income.externalId, externalIds)));

      existingIds = new Set([
        ...existingTransactions.map((t) => t.externalId).filter((id): id is string => !!id),
        ...existingIncome.map((i) => i.externalId).filter((id): id is string => !!id),
      ]);
    }

    // Filter out duplicates
    const newExpenses = expenseRows.filter((r) => !r.externalId || !existingIds.has(r.externalId));
    const newIncome = incomeRows.filter((r) => !r.externalId || !existingIds.has(r.externalId));
    const skippedDuplicates = rows.length - newExpenses.length - newIncome.length;

    // Check if this is a credit card with billing config
    const isCreditCard = account[0].type === 'credit_card';
    const hasBillingConfig = isCreditCard && account[0].closingDay && account[0].paymentDueDay;

    // Track affected fatura months for credit card accounts
    const affectedFaturas = new Set<string>();

    // Import all new records in a transaction
    await db.transaction(async (tx) => {
      // Insert expenses
      for (const row of newExpenses) {
        let faturaMonth: string;
        let dueDate: string;

        if (hasBillingConfig) {
          const purchaseDate = new Date(row.date + 'T00:00:00Z');
          faturaMonth = getFaturaMonth(purchaseDate, account[0].closingDay!);
          dueDate = getFaturaPaymentDueDate(faturaMonth, account[0].paymentDueDay!, account[0].closingDay!);
          affectedFaturas.add(faturaMonth);
        } else {
          faturaMonth = row.date.slice(0, 7);
          dueDate = row.date;
        }

        const [transaction] = await tx
          .insert(transactions)
          .values({
            userId,
            description: row.description,
            totalAmount: row.amountCents,
            totalInstallments: 1,
            categoryId: expenseCategoryId,
            externalId: row.externalId,
          })
          .returning();

        await tx.insert(entries).values({
          userId,
          transactionId: transaction.id,
          accountId,
          amount: row.amountCents,
          purchaseDate: row.date,
          faturaMonth,
          dueDate,
          installmentNumber: 1,
          paidAt: null,
        });
      }

      // Insert income (marked as received)
      for (const row of newIncome) {
        await tx.insert(income).values({
          userId,
          description: row.description,
          amount: row.amountCents,
          categoryId: incomeCategoryId,
          accountId,
          receivedDate: row.date,
          receivedAt: new Date(), // Mark as received
          externalId: row.externalId,
        });
      }
    });

    // Ensure faturas exist and update totals for credit cards
    if (hasBillingConfig && affectedFaturas.size > 0) {
      for (const month of affectedFaturas) {
        await ensureFaturaExists(accountId, month);
        await updateFaturaTotal(accountId, month);
      }
    }

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/faturas');
    revalidatePath('/income');

    return {
      success: true,
      importedExpenses: newExpenses.length,
      importedIncome: newIncome.length,
      skippedDuplicates,
    };
  } catch (error) {
    console.error('[import:mixed] Failed:', error);
    return { success: false, error: await t('errors.failedToImport') };
  }
}
