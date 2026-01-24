'use server';

import { cache } from 'react';
import { unstable_cache, revalidatePath, revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { transactions, entries, accounts, categories, type NewEntry } from '@/lib/schema';
import { eq, and, isNull, isNotNull, desc, sql, inArray } from 'drizzle-orm';
import { getFaturaMonth, getFaturaPaymentDueDate } from '@/lib/fatura-utils';
import { ensureFaturaExists, getFaturaWindowStart, updateFaturaTotal } from '@/lib/actions/faturas';
import { addMonths } from '@/lib/utils';
import { syncAccountBalance } from '@/lib/actions/accounts';
import { getCurrentUserId } from '@/lib/auth';
import { checkBulkRateLimit } from '@/lib/rate-limit';
import { guardCrudOperation } from '@/lib/rate-limit-guard';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';
import { incrementCategoryFrequency, transferCategoryFrequency } from '@/lib/actions/category-frequency';
import { getPostHogClient } from '@/lib/posthog-server';
import { trackFirstExpense, trackUserActivity } from '@/lib/analytics';
import { users } from '@/lib/auth-schema';

type CreateExpenseData = {
  description?: string;
  totalAmount: number; // cents
  categoryId: number;
  accountId: number;
  purchaseDate: string; // 'YYYY-MM-DD' for first installment
  installments: number;
};

export async function createExpense(data: CreateExpenseData) {
  await guardCrudOperation(); // Rate limiting

  console.log('data', data);
  // Validate inputs
  if (!Number.isInteger(data.totalAmount) || data.totalAmount <= 0) {
    throw new Error(await t('errors.amountPositive'));
  }
  if (!Number.isInteger(data.installments) || data.installments < 1) {
    throw new Error(await t('errors.installmentsMinimum'));
  }
  if (!Number.isInteger(data.categoryId) || data.categoryId <= 0) {
    throw new Error(await t('errors.invalidCategoryId'));
  }
  if (!Number.isInteger(data.accountId) || data.accountId <= 0) {
    throw new Error(await t('errors.invalidAccountId'));
  }
  if (!data.purchaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.purchaseDate)) {
    throw new Error(await t('errors.invalidDateFormat'));
  }

  try {
    const userId = await getCurrentUserId();

    // 1. Get account to check type and billing config
    const account = await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, data.accountId))).limit(1);

    if (!account[0]) {
      throw new Error(await t('errors.accountNotFound'));
    }

    const isCreditCard = account[0].type === 'credit_card';
    const hasBillingConfig = isCreditCard && account[0].closingDay && account[0].paymentDueDay;

    // 2. Generate description from category if empty
    let finalDescription = data.description?.trim();
    if (!finalDescription) {
      const [category] = await db
        .select({ name: categories.name })
        .from(categories)
        .where(and(eq(categories.userId, userId), eq(categories.id, data.categoryId)))
        .limit(1);
      finalDescription = category?.name || 'Despesa';
    }

    // 3. Create transaction
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        description: finalDescription,
        totalAmount: data.totalAmount,
        totalInstallments: data.installments,
        categoryId: data.categoryId,
      })
      .returning();

    // 3. Generate entries for each installment
    const amountPerInstallment = Math.round(data.totalAmount / data.installments);
    const basePurchaseDate = new Date(data.purchaseDate + 'T00:00:00Z');

    const entriesToInsert: NewEntry[] = [];
    const affectedFaturas = new Set<string>();

    // Calculate the base fatura month from the first installment's purchase date
    const baseFaturaMonth = hasBillingConfig
      ? getFaturaMonth(basePurchaseDate, account[0].closingDay!)
      : basePurchaseDate.toISOString().slice(0, 7);

    for (let i = 0; i < data.installments; i++) {
      // Adjust for last installment (rounding differences)
      const amount =
        i === data.installments - 1
          ? data.totalAmount - amountPerInstallment * (data.installments - 1)
          : amountPerInstallment;

      let faturaMonth: string;
      let dueDate: string;
      let purchaseDate: string;

      if (hasBillingConfig) {
        // Credit card with billing config: compute fatura month and due date
        // Fatura month is calculated by adding months to the base fatura month
        faturaMonth = addMonths(baseFaturaMonth, i);
        dueDate = getFaturaPaymentDueDate(faturaMonth, account[0].paymentDueDay!, account[0].closingDay!);
        affectedFaturas.add(faturaMonth);

        if (i === 0) {
          // First installment: use actual purchase date
          purchaseDate = data.purchaseDate;
        } else {
          // Subsequent installments: use fatura window start date
          // This places them at the first day of their respective billing period
          purchaseDate = await getFaturaWindowStart(data.accountId, faturaMonth, account[0].closingDay!);
        }
      } else {
        // Non-credit card or card without config: fatura = purchase month
        const installmentPurchaseDate = new Date(basePurchaseDate);
        installmentPurchaseDate.setUTCMonth(installmentPurchaseDate.getUTCMonth() + i);
        purchaseDate = installmentPurchaseDate.toISOString().split('T')[0];
        faturaMonth = purchaseDate.slice(0, 7); // YYYY-MM
        dueDate = purchaseDate;
      }

      entriesToInsert.push({
        userId,
        transactionId: transaction.id,
        accountId: data.accountId,
        amount,
        purchaseDate,
        faturaMonth,
        dueDate,
        installmentNumber: i + 1,
        paidAt: null,
      });
    }

    await db.insert(entries).values(entriesToInsert);

    // 4. Ensure faturas exist and update totals for credit cards
    if (hasBillingConfig) {
      for (const month of affectedFaturas) {
        await ensureFaturaExists(data.accountId, month);
        await updateFaturaTotal(data.accountId, month);
      }
    }

    await syncAccountBalance(data.accountId);

    // Track category frequency for auto-suggestions
    await incrementCategoryFrequency(userId, finalDescription, data.categoryId, 'expense');

    // Analytics: Track first expense and user activity
    const [entryCount, user] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(entries).where(eq(entries.userId, userId)),
      db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1),
    ]);

    const isFirstExpense = Number(entryCount[0]?.count || 0) <= data.installments;

    if (isFirstExpense && user[0]?.createdAt) {
      await trackFirstExpense({
        userId,
        wasImported: false,
        accountType: account[0].type,
        userCreatedAt: user[0].createdAt,
        hadCategorySuggestion: false, // Manual creation, no suggestion
      });
    }

    await trackUserActivity({
      userId,
      activityType: 'create_expense',
    });

    // PostHog event tracking
    const posthog = getPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: userId,
        event: 'expense_created',
        properties: {
          total_amount_cents: data.totalAmount,
          installments: data.installments,
          category_id: data.categoryId,
          account_id: data.accountId,
          is_credit_card: isCreditCard,
          has_installments: data.installments > 1,
        },
      });
    }

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/faturas');
    revalidatePath('/settings/accounts');
  } catch (error) {
    console.error('Failed to create expense:', { data, error });
    throw new Error(await handleDbError(error, 'errors.failedToCreate'));
  }
}

export async function getTransactionWithEntries(transactionId: number) {
  const userId = await getCurrentUserId();
  const transaction = await db.query.transactions.findFirst({
    where: and(eq(transactions.userId, userId), eq(transactions.id, transactionId)),
    with: {
      entries: true,
    },
  });
  return transaction;
}

export async function updateExpense(transactionId: number, data: CreateExpenseData) {
  await guardCrudOperation(); // Rate limiting

  // Validate inputs
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    throw new Error(await t('errors.invalidTransactionId'));
  }
  if (!Number.isInteger(data.totalAmount) || data.totalAmount <= 0) {
    throw new Error(await t('errors.amountPositive'));
  }
  if (!Number.isInteger(data.installments) || data.installments < 1) {
    throw new Error(await t('errors.installmentsMinimum'));
  }
  if (!Number.isInteger(data.categoryId) || data.categoryId <= 0) {
    throw new Error(await t('errors.invalidCategoryId'));
  }
  if (!Number.isInteger(data.accountId) || data.accountId <= 0) {
    throw new Error(await t('errors.invalidAccountId'));
  }
  if (!data.purchaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.purchaseDate)) {
    throw new Error(await t('errors.invalidDateFormat'));
  }

  try {
    const userId = await getCurrentUserId();

    // 1. Get old entries to track affected faturas for cleanup
    const oldEntries = await db
      .select()
      .from(entries)
      .where(and(eq(entries.userId, userId), eq(entries.transactionId, transactionId)));

    const oldFaturas = new Map<number, Set<string>>();
    for (const entry of oldEntries) {
      if (!oldFaturas.has(entry.accountId)) {
        oldFaturas.set(entry.accountId, new Set());
      }
      oldFaturas.get(entry.accountId)!.add(entry.faturaMonth);
    }

    // 2. Get account to check type and billing config
    const account = await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, data.accountId))).limit(1);

    if (!account[0]) {
      throw new Error(await t('errors.accountNotFound'));
    }

    const isCreditCard = account[0].type === 'credit_card';
    const hasBillingConfig = isCreditCard && account[0].closingDay && account[0].paymentDueDay;

    // 3. Generate description from category if empty
    let finalDescription = data.description?.trim();
    if (!finalDescription) {
      const [category] = await db
        .select({ name: categories.name })
        .from(categories)
        .where(and(eq(categories.userId, userId), eq(categories.id, data.categoryId)))
        .limit(1);
      finalDescription = category?.name || 'Despesa';
    }

    // 4. Update transaction
    await db
      .update(transactions)
      .set({
        description: finalDescription,
        totalAmount: data.totalAmount,
        totalInstallments: data.installments,
        categoryId: data.categoryId,
      })
      .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)));

    // 5. Delete old entries
    await db.delete(entries).where(and(eq(entries.userId, userId), eq(entries.transactionId, transactionId)));

    // 6. Regenerate entries (same logic as create)
    const amountPerInstallment = Math.round(data.totalAmount / data.installments);
    const basePurchaseDate = new Date(data.purchaseDate + 'T00:00:00Z');

    const entriesToInsert: NewEntry[] = [];
    const newFaturas = new Set<string>();

    // Calculate the base fatura month from the first installment's purchase date
    const baseFaturaMonth = hasBillingConfig
      ? getFaturaMonth(basePurchaseDate, account[0].closingDay!)
      : basePurchaseDate.toISOString().slice(0, 7);

    for (let i = 0; i < data.installments; i++) {
      const amount =
        i === data.installments - 1
          ? data.totalAmount - amountPerInstallment * (data.installments - 1)
          : amountPerInstallment;

      let faturaMonth: string;
      let dueDate: string;
      let purchaseDate: string;

      if (hasBillingConfig) {
        // Fatura month is calculated by adding months to the base fatura month
        faturaMonth = addMonths(baseFaturaMonth, i);
        dueDate = getFaturaPaymentDueDate(faturaMonth, account[0].paymentDueDay!, account[0].closingDay!);
        newFaturas.add(faturaMonth);

        if (i === 0) {
          // First installment: use actual purchase date
          purchaseDate = data.purchaseDate;
        } else {
          // Subsequent installments: use fatura window start date
          purchaseDate = await getFaturaWindowStart(data.accountId, faturaMonth, account[0].closingDay!);
        }
      } else {
        const installmentPurchaseDate = new Date(basePurchaseDate);
        installmentPurchaseDate.setUTCMonth(installmentPurchaseDate.getUTCMonth() + i);
        purchaseDate = installmentPurchaseDate.toISOString().split('T')[0];
        faturaMonth = purchaseDate.slice(0, 7);
        dueDate = purchaseDate;
      }

      entriesToInsert.push({
        userId,
        transactionId,
        accountId: data.accountId,
        amount,
        purchaseDate,
        faturaMonth,
        dueDate,
        installmentNumber: i + 1,
        paidAt: null,
      });
    }

    await db.insert(entries).values(entriesToInsert);

    // 7. Update fatura totals (both old and new)
    if (hasBillingConfig) {
      const allAffectedFaturas = new Set([...newFaturas]);
      const oldAccountFaturas = oldFaturas.get(data.accountId) || new Set();
      for (const month of oldAccountFaturas) {
        allAffectedFaturas.add(month);
      }

      for (const month of allAffectedFaturas) {
        await ensureFaturaExists(data.accountId, month);
        await updateFaturaTotal(data.accountId, month);
      }
    }

    const affectedAccountIds = new Set<number>();
    for (const entry of oldEntries) {
      affectedAccountIds.add(entry.accountId);
    }
    affectedAccountIds.add(data.accountId);
    for (const accountId of affectedAccountIds) {
      await syncAccountBalance(accountId);
    }

    // Analytics: Track user activity
    await trackUserActivity({
      userId,
      activityType: 'edit_expense',
    });

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/faturas');
    revalidatePath('/settings/accounts');
  } catch (error) {
    console.error('Failed to update expense:', { transactionId, data, error });
    throw new Error(await handleDbError(error, 'errors.failedToUpdate'));
  }
}

export async function deleteExpense(transactionId: number) {
  await guardCrudOperation(); // Rate limiting

  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    throw new Error(await t('errors.invalidTransactionId'));
  }

  try {
    const userId = await getCurrentUserId();

    // Get entries before deletion to update affected faturas
    const oldEntries = await db
      .select()
      .from(entries)
      .where(and(eq(entries.userId, userId), eq(entries.transactionId, transactionId)));

    const affectedFaturas = new Map<number, Set<string>>();
    const affectedAccountIds = new Set<number>();
    for (const entry of oldEntries) {
      if (!affectedFaturas.has(entry.accountId)) {
        affectedFaturas.set(entry.accountId, new Set());
      }
      affectedFaturas.get(entry.accountId)!.add(entry.faturaMonth);
      affectedAccountIds.add(entry.accountId);
    }

    // CASCADE will delete entries automatically
    await db.delete(transactions).where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)));

    // Update fatura totals for affected faturas
    for (const [accountId, months] of affectedFaturas) {
      for (const month of months) {
        await updateFaturaTotal(accountId, month);
      }
    }

    for (const accountId of affectedAccountIds) {
      await syncAccountBalance(accountId);
    }

    // Analytics: Track user activity
    await trackUserActivity({
      userId,
      activityType: 'delete_expense',
    });

    // PostHog event tracking
    const posthog = getPostHogClient();
    if (posthog) {
      posthog.capture({
        distinctId: userId,
        event: 'expense_deleted',
        properties: {
          transaction_id: transactionId,
        },
      });
    }

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/faturas');
    revalidatePath('/settings/accounts');
  } catch (error) {
    console.error('Failed to delete expense:', { transactionId, error });
    throw new Error(await handleDbError(error, 'errors.failedToDelete'));
  }
}

export type ExpenseFilters = {
  yearMonth?: string; // 'YYYY-MM'
  categoryId?: number;
  accountId?: number;
  status?: 'all' | 'paid' | 'pending';
};

export const getExpenses = cache(async (filters: ExpenseFilters = {}) => {
  const userId = await getCurrentUserId();
  const { yearMonth, categoryId, accountId, status = 'all' } = filters;

  return unstable_cache(
    async () => {
      const conditions = [eq(entries.userId, userId)];

      // Filter ignored transactions (they should still appear but won't affect calculations)
      // Note: We don't filter them out, allowing them to be visible but dimmed in UI

      // Filter by month using SQL to extract year-month from purchaseDate (for budget tracking)
      if (yearMonth) {
        conditions.push(sql`to_char(${entries.purchaseDate}, 'YYYY-MM') = ${yearMonth}`);
      }

      if (categoryId) {
        conditions.push(eq(transactions.categoryId, categoryId));
      }

      if (accountId) {
        conditions.push(eq(entries.accountId, accountId));
      }

      if (status === 'pending') {
        conditions.push(isNull(entries.paidAt));
      } else if (status === 'paid') {
        conditions.push(isNotNull(entries.paidAt));
      }

      const results = await db
        .select({
          id: entries.id,
          amount: entries.amount,
          purchaseDate: entries.purchaseDate,
          faturaMonth: entries.faturaMonth,
          dueDate: entries.dueDate,
          paidAt: sql<string | null>`${entries.paidAt}::text`,
          installmentNumber: entries.installmentNumber,
          transactionId: transactions.id,
          description: transactions.description,
          totalInstallments: transactions.totalInstallments,
          totalAmount: transactions.totalAmount,
          ignored: transactions.ignored,
          refundedAmount: transactions.refundedAmount,
          isFullyRefunded: sql<boolean>`COALESCE(${transactions.refundedAmount}, 0) >= ${transactions.totalAmount}`,
          categoryId: categories.id,
          categoryName: categories.name,
          categoryColor: categories.color,
          categoryIcon: categories.icon,
          accountId: accounts.id,
          accountName: accounts.name,
          accountType: accounts.type,
          bankLogo: accounts.bankLogo,
        })
        .from(entries)
        .innerJoin(transactions, eq(entries.transactionId, transactions.id))
        .innerJoin(categories, eq(transactions.categoryId, categories.id))
        .innerJoin(accounts, eq(entries.accountId, accounts.id))
        .where(and(...conditions))
        .orderBy(desc(entries.dueDate));

      return results;
    },
    ['expenses', userId, yearMonth || 'all', categoryId?.toString() || 'all', accountId?.toString() || 'all', status],
    { tags: [`user-${userId}`], revalidate: 300 }
  )();
});

export async function markEntryPaid(entryId: number) {
  if (!Number.isInteger(entryId) || entryId <= 0) {
    throw new Error(await t('errors.invalidEntryId'));
  }

  try {
    const userId = await getCurrentUserId();

    await db
      .update(entries)
      .set({ paidAt: new Date() })
      .where(and(eq(entries.userId, userId), eq(entries.id, entryId)));

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to mark entry paid:', { entryId, error });
    throw new Error(await handleDbError(error, 'errors.failedToMarkPaid'));
  }
}

export async function markEntryPending(entryId: number) {
  if (!Number.isInteger(entryId) || entryId <= 0) {
    throw new Error(await t('errors.invalidEntryId'));
  }

  try {
    const userId = await getCurrentUserId();

    await db
      .update(entries)
      .set({ paidAt: null })
      .where(and(eq(entries.userId, userId), eq(entries.id, entryId)));

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to mark entry pending:', { entryId, error });
    throw new Error(await handleDbError(error, 'errors.failedToMarkPending'));
  }
}

export async function updateTransactionCategory(transactionId: number, categoryId: number) {
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    throw new Error(await t('errors.invalidTransactionId'));
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new Error(await t('errors.invalidCategoryId'));
  }

  try {
    const userId = await getCurrentUserId();

    // Get old category and description for frequency transfer
    const [transaction] = await db
      .select({ description: transactions.description, categoryId: transactions.categoryId })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)));

    if (!transaction) {
      throw new Error(await t('errors.transactionNotFound'));
    }

    await db
      .update(transactions)
      .set({ categoryId })
      .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)));

    // Transfer frequency from old to new category
    if (transaction.description) {
      await transferCategoryFrequency(
        userId,
        transaction.description,
        transaction.categoryId,
        categoryId,
        'expense'
      );
    }

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to update transaction category:', { transactionId, categoryId, error });
    throw new Error(await handleDbError(error, 'errors.failedToUpdateCategory'));
  }
}

export async function bulkUpdateTransactionCategories(
  transactionIds: number[],
  categoryId: number
) {
  if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
    throw new Error(await t('errors.transactionIdsRequired'));
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    throw new Error(await t('errors.invalidCategoryId'));
  }

  try {
    const userId = await getCurrentUserId();

    const rateLimit = await checkBulkRateLimit(userId);
    if (!rateLimit.allowed) {
      throw new Error(`Rate limited. Try again in ${rateLimit.retryAfter}s.`);
    }

    // Get old categories and descriptions for frequency transfer
    const oldTransactions = await db
      .select({ id: transactions.id, description: transactions.description, categoryId: transactions.categoryId })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, transactionIds)));

    await db
      .update(transactions)
      .set({ categoryId })
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, transactionIds)));

    // Transfer frequency for each transaction
    for (const txn of oldTransactions) {
      if (txn.description) {
        await transferCategoryFrequency(userId, txn.description, txn.categoryId, categoryId, 'expense');
      }
    }

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to bulk update categories:', { transactionIds, categoryId, error });
    throw new Error(await handleDbError(error, 'errors.failedToUpdate'));
  }
}

export async function toggleIgnoreTransaction(transactionId: number) {
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    throw new Error(await t('errors.invalidTransactionId'));
  }

  try {
    const userId = await getCurrentUserId();

    // Get current state
    const [txn] = await db
      .select({ ignored: transactions.ignored })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)))
      .limit(1);

    if (!txn) {
      throw new Error(await t('errors.notFound'));
    }

    // Toggle ignored state
    const newIgnored = !txn.ignored;

    await db
      .update(transactions)
      .set({ ignored: newIgnored })
      .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)));

    // Sync all affected account balances (entries may span multiple accounts for installments)
    const affectedAccounts = await db
      .selectDistinct({ accountId: entries.accountId })
      .from(entries)
      .where(eq(entries.transactionId, transactionId));

    for (const { accountId } of affectedAccounts) {
      await syncAccountBalance(accountId);
    }

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/budgets');
  } catch (error) {
    console.error('Failed to toggle ignore transaction:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(await handleDbError(error, 'errors.failedToUpdate'));
  }
}
