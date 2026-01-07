'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { transactions, entries, accounts, categories, type NewEntry } from '@/lib/schema';
import { eq, and, isNull, isNotNull, desc, sql, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getFaturaMonth, getFaturaPaymentDueDate } from '@/lib/fatura-utils';
import { ensureFaturaExists, updateFaturaTotal } from '@/lib/actions/faturas';
import { getCurrentUserId } from '@/lib/auth';
import { checkBulkRateLimit } from '@/lib/rate-limit';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';

type CreateExpenseData = {
  description: string;
  totalAmount: number; // cents
  categoryId: number;
  accountId: number;
  purchaseDate: string; // 'YYYY-MM-DD' for first installment
  installments: number;
};

export async function createExpense(data: CreateExpenseData) {
  // Validate inputs
  if (!data.description?.trim()) {
    throw new Error(await t('errors.descriptionRequired'));
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

    // 1. Get account to check type and billing config
    const account = await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, data.accountId))).limit(1);

    if (!account[0]) {
      throw new Error(await t('errors.accountNotFound'));
    }

    const isCreditCard = account[0].type === 'credit_card';
    const hasBillingConfig = isCreditCard && account[0].closingDay && account[0].paymentDueDay;

    // 2. Create transaction
    const [transaction] = await db
      .insert(transactions)
      .values({
        userId,
        description: data.description,
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

    for (let i = 0; i < data.installments; i++) {
      const installmentPurchaseDate = new Date(basePurchaseDate);
      installmentPurchaseDate.setUTCMonth(installmentPurchaseDate.getUTCMonth() + i);

      // Adjust for last installment (rounding differences)
      const amount =
        i === data.installments - 1
          ? data.totalAmount - amountPerInstallment * (data.installments - 1)
          : amountPerInstallment;

      let faturaMonth: string;
      let dueDate: string;

      if (hasBillingConfig) {
        // Credit card with billing config: compute fatura month and due date
        faturaMonth = getFaturaMonth(installmentPurchaseDate, account[0].closingDay!);
        dueDate = getFaturaPaymentDueDate(faturaMonth, account[0].paymentDueDay!, account[0].closingDay!);
        affectedFaturas.add(faturaMonth);
      } else {
        // Non-credit card or card without config: fatura = purchase month
        faturaMonth = installmentPurchaseDate.toISOString().slice(0, 7); // YYYY-MM
        dueDate = installmentPurchaseDate.toISOString().split('T')[0];
      }

      entriesToInsert.push({
        userId,
        transactionId: transaction.id,
        accountId: data.accountId,
        amount,
        purchaseDate: installmentPurchaseDate.toISOString().split('T')[0],
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

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/faturas');
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
  // Validate inputs
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    throw new Error(await t('errors.invalidTransactionId'));
  }
  if (!data.description?.trim()) {
    throw new Error(await t('errors.descriptionRequired'));
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

    // 3. Update transaction
    await db
      .update(transactions)
      .set({
        description: data.description,
        totalAmount: data.totalAmount,
        totalInstallments: data.installments,
        categoryId: data.categoryId,
      })
      .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)));

    // 4. Delete old entries
    await db.delete(entries).where(and(eq(entries.userId, userId), eq(entries.transactionId, transactionId)));

    // 5. Regenerate entries (same logic as create)
    const amountPerInstallment = Math.round(data.totalAmount / data.installments);
    const basePurchaseDate = new Date(data.purchaseDate + 'T00:00:00Z');

    const entriesToInsert: NewEntry[] = [];
    const newFaturas = new Set<string>();

    for (let i = 0; i < data.installments; i++) {
      const installmentPurchaseDate = new Date(basePurchaseDate);
      installmentPurchaseDate.setUTCMonth(installmentPurchaseDate.getUTCMonth() + i);

      const amount =
        i === data.installments - 1
          ? data.totalAmount - amountPerInstallment * (data.installments - 1)
          : amountPerInstallment;

      let faturaMonth: string;
      let dueDate: string;

      if (hasBillingConfig) {
        faturaMonth = getFaturaMonth(installmentPurchaseDate, account[0].closingDay!);
        dueDate = getFaturaPaymentDueDate(faturaMonth, account[0].paymentDueDay!, account[0].closingDay!);
        newFaturas.add(faturaMonth);
      } else {
        faturaMonth = installmentPurchaseDate.toISOString().slice(0, 7);
        dueDate = installmentPurchaseDate.toISOString().split('T')[0];
      }

      entriesToInsert.push({
        userId,
        transactionId,
        accountId: data.accountId,
        amount,
        purchaseDate: installmentPurchaseDate.toISOString().split('T')[0],
        faturaMonth,
        dueDate,
        installmentNumber: i + 1,
        paidAt: null,
      });
    }

    await db.insert(entries).values(entriesToInsert);

    // 6. Update fatura totals (both old and new)
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

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/faturas');
  } catch (error) {
    console.error('Failed to update expense:', { transactionId, data, error });
    throw new Error(await handleDbError(error, 'errors.failedToUpdate'));
  }
}

export async function deleteExpense(transactionId: number) {
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
    for (const entry of oldEntries) {
      if (!affectedFaturas.has(entry.accountId)) {
        affectedFaturas.set(entry.accountId, new Set());
      }
      affectedFaturas.get(entry.accountId)!.add(entry.faturaMonth);
    }

    // CASCADE will delete entries automatically
    await db.delete(transactions).where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)));

    // Update fatura totals for affected faturas
    for (const [accountId, months] of affectedFaturas) {
      for (const month of months) {
        await updateFaturaTotal(accountId, month);
      }
    }

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/faturas');
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

  const conditions = [eq(entries.userId, userId)];

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
      categoryId: categories.id,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountId: accounts.id,
      accountName: accounts.name,
      accountType: accounts.type,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(accounts, eq(entries.accountId, accounts.id))
    .where(and(...conditions))
    .orderBy(desc(entries.dueDate));

  return results;
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

    await db
      .update(transactions)
      .set({ categoryId })
      .where(and(eq(transactions.userId, userId), eq(transactions.id, transactionId)));

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

    await db
      .update(transactions)
      .set({ categoryId })
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, transactionIds)));

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to bulk update categories:', { transactionIds, categoryId, error });
    throw new Error(await handleDbError(error, 'errors.failedToUpdate'));
  }
}
