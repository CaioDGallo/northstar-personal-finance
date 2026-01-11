'use server';

import { getCurrentUserId } from '@/lib/auth';
import { db } from '@/lib/db';
import { getFaturaPaymentDueDate } from '@/lib/fatura-utils';
import { t } from '@/lib/i18n/server-errors';
import { checkBulkRateLimit } from '@/lib/rate-limit';
import { accounts, categories, entries, faturas, transactions, transfers, type Fatura } from '@/lib/schema';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cache } from 'react';
import { syncAccountBalance } from '@/lib/actions/accounts';

export type UnpaidFatura = {
  id: number;
  accountId: number;
  accountName: string;
  yearMonth: string;
  totalAmount: number;
  dueDate: string;
};

/**
 * Ensures a fatura exists for a given account and month.
 * Creates it if it doesn't exist.
 */
export async function ensureFaturaExists(accountId: number, yearMonth: string): Promise<Fatura> {
  const userId = await getCurrentUserId();

  // Check if fatura exists
  const existing = await db
    .select()
    .from(faturas)
    .where(and(eq(faturas.userId, userId), eq(faturas.accountId, accountId), eq(faturas.yearMonth, yearMonth)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Get account to compute due date
  const account = await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, accountId))).limit(1);

  if (!account[0]) {
    throw new Error(await t('errors.accountNotFound'));
  }

  // For non-credit cards or cards without billing config, use first day of next month
  const paymentDueDay = account[0].paymentDueDay || 1;
  const closingDay = account[0].closingDay || 1;
  const paymentDueDate = getFaturaPaymentDueDate(yearMonth, paymentDueDay, closingDay);

  // Create fatura
  const [fatura] = await db
    .insert(faturas)
    .values({
      userId,
      accountId,
      yearMonth,
      totalAmount: 0,
      dueDate: paymentDueDate,
    })
    .returning();

  return fatura;
}

/**
 * Updates the total amount for a fatura by summing all its entries.
 */
export async function updateFaturaTotal(accountId: number, yearMonth: string): Promise<void> {
  const userId = await getCurrentUserId();

  // Sum all entries for this fatura
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${entries.amount}), 0)` })
    .from(entries)
    .where(and(eq(entries.userId, userId), eq(entries.accountId, accountId), eq(entries.faturaMonth, yearMonth)));

  const totalAmount = result[0]?.total || 0;

  await db
    .update(faturas)
    .set({ totalAmount })
    .where(and(eq(faturas.userId, userId), eq(faturas.accountId, accountId), eq(faturas.yearMonth, yearMonth)));
}

/**
 * Gets all faturas for a specific account, ordered by month descending.
 */
export const getFaturasByAccount = cache(async (accountId: number) => {
  const userId = await getCurrentUserId();
  return await db
    .select()
    .from(faturas)
    .where(and(eq(faturas.userId, userId), eq(faturas.accountId, accountId)))
    .orderBy(desc(faturas.yearMonth));
});

/**
 * Gets all faturas for a specific month across all credit card accounts.
 */
export const getFaturasByMonth = cache(async (yearMonth: string) => {
  const userId = await getCurrentUserId();
  return await db
    .select({
      id: faturas.id,
      accountId: faturas.accountId,
      accountName: accounts.name,
      yearMonth: faturas.yearMonth,
      totalAmount: faturas.totalAmount,
      dueDate: faturas.dueDate,
      paidAt: sql<string | null>`${faturas.paidAt}::text`,
      paidFromAccountId: faturas.paidFromAccountId,
    })
    .from(faturas)
    .innerJoin(accounts, eq(faturas.accountId, accounts.id))
    .where(and(eq(faturas.userId, userId), eq(faturas.yearMonth, yearMonth)))
    .orderBy(accounts.name);
});

/**
 * Gets all unpaid faturas across all credit card accounts.
 */
export const getUnpaidFaturas = cache(async (): Promise<UnpaidFatura[]> => {
  const userId = await getCurrentUserId();
  return await db
    .select({
      id: faturas.id,
      accountId: faturas.accountId,
      accountName: accounts.name,
      yearMonth: faturas.yearMonth,
      totalAmount: faturas.totalAmount,
      dueDate: faturas.dueDate,
    })
    .from(faturas)
    .innerJoin(accounts, eq(faturas.accountId, accounts.id))
    .where(and(
      eq(faturas.userId, userId),
      isNull(faturas.paidAt)
    ))
    .orderBy(desc(faturas.yearMonth), accounts.name);
});

/**
 * Gets fatura details including all entries.
 */
export const getFaturaWithEntries = cache(async (faturaId: number) => {
  const userId = await getCurrentUserId();
  const fatura = await db.select().from(faturas).where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId))).limit(1);

  if (!fatura[0]) {
    return null;
  }

  const faturaEntries = await db
    .select({
      id: entries.id,
      amount: entries.amount,
      purchaseDate: entries.purchaseDate,
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
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(entries.userId, userId),
        eq(entries.accountId, fatura[0].accountId),
        eq(entries.faturaMonth, fatura[0].yearMonth)
      )
    )
    .orderBy(desc(entries.purchaseDate));

  return {
    ...fatura[0],
    entries: faturaEntries,
  };
});

/**
 * Marks a fatura as paid from a specific account.
 * Also marks all entries in the fatura as paid.
 */
export async function payFatura(faturaId: number, fromAccountId: number): Promise<void> {
  if (!Number.isInteger(faturaId) || faturaId <= 0) {
    throw new Error(await t('errors.invalidFaturaId'));
  }
  if (!Number.isInteger(fromAccountId) || fromAccountId <= 0) {
    throw new Error(await t('errors.invalidAccountId'));
  }

  try {
    const userId = await getCurrentUserId();
    const now = new Date();
    const paymentDate = now.toISOString().split('T')[0];

    await db.transaction(async (tx) => {
      // 1. Get fatura details
      const fatura = await tx
        .select()
        .from(faturas)
        .where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId)))
        .limit(1);

      if (!fatura[0]) {
        throw new Error(await t('errors.faturaNotFound'));
      }

      if (fatura[0].paidAt) {
        throw new Error(await t('errors.faturaAlreadyPaid'));
      }

      // 2. Verify source account exists and is not a credit card
      const sourceAccount = await tx
        .select()
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.id, fromAccountId)))
        .limit(1);

      if (!sourceAccount[0]) {
        throw new Error(await t('errors.accountNotFound'));
      }

      if (sourceAccount[0].type === 'credit_card') {
        throw new Error(await t('errors.cannotPayFromCreditCard'));
      }

      // 3. Create transfer record
      await tx
        .insert(transfers)
        .values({
          userId,
          fromAccountId,
          toAccountId: fatura[0].accountId,
          amount: fatura[0].totalAmount,
          date: paymentDate,
          type: 'fatura_payment',
          faturaId: faturaId,
          description: `Fatura ${fatura[0].yearMonth}`,
        });

      // 4. Mark fatura as paid
      await tx
        .update(faturas)
        .set({
          paidAt: now,
          paidFromAccountId: fromAccountId,
        })
        .where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId)));

      // 5. Mark all entries in this fatura as paid
      await tx
        .update(entries)
        .set({ paidAt: now })
        .where(
          and(
            eq(entries.userId, userId),
            eq(entries.accountId, fatura[0].accountId),
            eq(entries.faturaMonth, fatura[0].yearMonth)
          )
        );

      await syncAccountBalance(fromAccountId, tx, userId);
      await syncAccountBalance(fatura[0].accountId, tx, userId);
    });

    revalidatePath('/faturas');
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/transfers');
    revalidatePath('/settings/accounts');
  } catch (error) {
    console.error('Failed to pay fatura:', { faturaId, fromAccountId, error });
    throw error instanceof Error ? error : new Error(await t('errors.failedToPay'));
  }
}

/**
 * Marks a fatura as unpaid (reverses payment).
 */
export async function markFaturaUnpaid(faturaId: number): Promise<void> {
  if (!Number.isInteger(faturaId) || faturaId <= 0) {
    throw new Error(await t('errors.invalidFaturaId'));
  }

  try {
    const userId = await getCurrentUserId();
    const now = new Date();
    const reversalDate = now.toISOString().split('T')[0];

    await db.transaction(async (tx) => {
      // Get fatura details
      const fatura = await tx
        .select()
        .from(faturas)
        .where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId)))
        .limit(1);

      if (!fatura[0]) {
        throw new Error(await t('errors.faturaNotFound'));
      }

      const wasPaid = !!fatura[0].paidAt;

      const [paymentTransfer] = await tx
        .select()
        .from(transfers)
        .where(and(
          eq(transfers.userId, userId),
          eq(transfers.faturaId, faturaId),
          eq(transfers.type, 'fatura_payment')
        ))
        .orderBy(desc(transfers.createdAt))
        .limit(1);

      // Mark fatura as unpaid
      await tx
        .update(faturas)
        .set({
          paidAt: null,
          paidFromAccountId: null,
        })
        .where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId)));

      // Mark all entries in this fatura as unpaid
      await tx
        .update(entries)
        .set({ paidAt: null })
        .where(
          and(
            eq(entries.userId, userId),
            eq(entries.accountId, fatura[0].accountId),
            eq(entries.faturaMonth, fatura[0].yearMonth)
          )
        );

      if (wasPaid && paymentTransfer?.fromAccountId && paymentTransfer?.toAccountId) {
        await tx.insert(transfers).values({
          userId,
          fromAccountId: paymentTransfer.toAccountId,
          toAccountId: paymentTransfer.fromAccountId,
          amount: paymentTransfer.amount,
          date: reversalDate,
          type: 'internal_transfer',
          faturaId,
          description: `Reversal: ${paymentTransfer.description ?? 'Fatura payment'}`,
        });
      }

      const affectedAccounts = new Set<number>();
      if (fatura[0].paidFromAccountId) {
        affectedAccounts.add(fatura[0].paidFromAccountId);
      }
      affectedAccounts.add(fatura[0].accountId);
      for (const accountId of affectedAccounts) {
        await syncAccountBalance(accountId, tx, userId);
      }
    });

    revalidatePath('/faturas');
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/transfers');
    revalidatePath('/settings/accounts');
  } catch (error) {
    console.error('Failed to mark fatura unpaid:', { faturaId, error });
    throw error instanceof Error ? error : new Error(await t('errors.failedToMarkPending'));
  }
}

/**
 * Converts an expense (from checking/savings/cash) into a fatura payment.
 * Deletes the expense and creates a fatura_payment transfer.
 */
export async function convertExpenseToFaturaPayment(entryId: number, faturaId: number): Promise<void> {
  if (!Number.isInteger(entryId) || entryId <= 0) {
    throw new Error(await t('errors.invalidTransactionId'));
  }
  if (!Number.isInteger(faturaId) || faturaId <= 0) {
    throw new Error(await t('errors.invalidFaturaId'));
  }

  try {
    const userId = await getCurrentUserId();

    await db.transaction(async (tx) => {
      // 1. Load entry + transaction, validate ownership
      const entry = await tx
        .select({
          entryId: entries.id,
          entryAmount: entries.amount,
          purchaseDate: entries.purchaseDate,
          transactionId: entries.transactionId,
          accountId: entries.accountId,
        })
        .from(entries)
        .where(and(eq(entries.userId, userId), eq(entries.id, entryId)))
        .limit(1);

      if (!entry[0]) {
        throw new Error(await t('errors.invalidTransactionId'));
      }

      const transaction = await tx
        .select({
          id: transactions.id,
          totalInstallments: transactions.totalInstallments,
          externalId: transactions.externalId,
        })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.id, entry[0].transactionId)))
        .limit(1);

      if (!transaction[0]) {
        throw new Error(await t('errors.invalidTransactionId'));
      }

      // 2. Validate: accountType !== credit_card, totalInstallments === 1
      const sourceAccount = await tx
        .select({ type: accounts.type })
        .from(accounts)
        .where(and(eq(accounts.userId, userId), eq(accounts.id, entry[0].accountId)))
        .limit(1);

      if (!sourceAccount[0]) {
        throw new Error(await t('errors.accountNotFound'));
      }

      if (sourceAccount[0].type === 'credit_card') {
        throw new Error(await t('errors.invalidConversion'));
      }

      if (transaction[0].totalInstallments !== 1) {
        throw new Error(await t('errors.invalidConversion'));
      }

      // 3. Load fatura, validate unpaid + amount matches entry.amount
      const fatura = await tx
        .select()
        .from(faturas)
        .where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId)))
        .limit(1);

      if (!fatura[0]) {
        throw new Error(await t('errors.faturaNotFound'));
      }

      if (fatura[0].paidAt) {
        throw new Error(await t('errors.faturaAlreadyPaid'));
      }

      if (fatura[0].totalAmount !== entry[0].entryAmount) {
        throw new Error(await t('errors.amountMismatch'));
      }

      // 4. Create fatura_payment transfer (preserve externalId for duplicate detection on reimport)
      const paymentDate = entry[0].purchaseDate;
      const paymentTimestamp = new Date(paymentDate);

      await tx.insert(transfers).values({
        userId,
        fromAccountId: entry[0].accountId,
        toAccountId: fatura[0].accountId,
        amount: entry[0].entryAmount,
        date: paymentDate,
        type: 'fatura_payment',
        faturaId: faturaId,
        description: `Fatura ${fatura[0].yearMonth}`,
        externalId: transaction[0].externalId,
      });

      // 5. Mark fatura paid
      await tx
        .update(faturas)
        .set({
          paidAt: paymentTimestamp,
          paidFromAccountId: entry[0].accountId,
        })
        .where(and(eq(faturas.userId, userId), eq(faturas.id, faturaId)));

      // 6. Mark all fatura entries as paid
      await tx
        .update(entries)
        .set({ paidAt: paymentTimestamp })
        .where(
          and(
            eq(entries.userId, userId),
            eq(entries.accountId, fatura[0].accountId),
            eq(entries.faturaMonth, fatura[0].yearMonth)
          )
        );

      // 7. Delete expense transaction + entries (cascade handles entries)
      await tx
        .delete(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.id, entry[0].transactionId)));

      // 8. Sync both account balances
      await syncAccountBalance(entry[0].accountId, tx, userId);
      await syncAccountBalance(fatura[0].accountId, tx, userId);
    });

    // 9. Revalidate paths
    revalidatePath('/faturas');
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/transfers');
    revalidatePath('/settings/accounts');
  } catch (error) {
    console.error('Failed to convert expense to fatura payment:', { entryId, faturaId, error });
    throw error instanceof Error ? error : new Error(await t('errors.failedToUpdate'));
  }
}

/**
 * Backfills fatura records for existing credit card entries.
 * Creates faturas for all distinct (accountId, faturaMonth) combinations
 * where entries exist but no fatura record exists yet.
 */
export async function backfillFaturas(): Promise<{ created: number } | { error: string }> {
  try {
    const userId = await getCurrentUserId();

    const rateLimit = await checkBulkRateLimit(userId);
    if (!rateLimit.allowed) {
      return { error: await t('errors.tooManyAttempts', { retryAfter: rateLimit.retryAfter }) };
    }

    // Get all distinct (accountId, faturaMonth) combinations from entries
    // Only for credit card accounts
    const distinctCombinations = await db
      .selectDistinct({
        accountId: entries.accountId,
        faturaMonth: entries.faturaMonth,
      })
      .from(entries)
      .innerJoin(accounts, eq(entries.accountId, accounts.id))
      .where(and(eq(entries.userId, userId), eq(accounts.type, 'credit_card')));

    let created = 0;

    // For each combination, ensure fatura exists and update total
    for (const combo of distinctCombinations) {
      const existing = await db
        .select()
        .from(faturas)
        .where(and(
          eq(faturas.userId, userId),
          eq(faturas.accountId, combo.accountId),
          eq(faturas.yearMonth, combo.faturaMonth)
        ))
        .limit(1);

      // Skip if fatura already exists
      if (existing.length > 0) continue;

      // Create fatura using existing utility
      await ensureFaturaExists(combo.accountId, combo.faturaMonth);

      // Update total amount
      await updateFaturaTotal(combo.accountId, combo.faturaMonth);

      created++;
    }

    return { created };
  } catch (error) {
    console.error('Failed to backfill faturas:', error);
    return { error: await t('errors.failedToBackfillFaturas') };
  }
}
