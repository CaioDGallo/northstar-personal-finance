'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { faturas, entries, accounts, transactions, categories, type Fatura, type NewFatura } from '@/lib/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getFaturaPaymentDueDate } from '@/lib/fatura-utils';

/**
 * Ensures a fatura exists for a given account and month.
 * Creates it if it doesn't exist.
 */
export async function ensureFaturaExists(accountId: number, yearMonth: string): Promise<Fatura> {
  // Check if fatura exists
  const existing = await db
    .select()
    .from(faturas)
    .where(and(eq(faturas.accountId, accountId), eq(faturas.yearMonth, yearMonth)))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  // Get account to compute due date
  const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);

  if (!account[0]) {
    throw new Error('Account not found');
  }

  // For non-credit cards or cards without billing config, use first day of next month
  const paymentDueDay = account[0].paymentDueDay || 1;
  const paymentDueDate = getFaturaPaymentDueDate(yearMonth, paymentDueDay);

  // Create fatura
  const [fatura] = await db
    .insert(faturas)
    .values({
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
  // Sum all entries for this fatura
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${entries.amount}), 0)` })
    .from(entries)
    .where(and(eq(entries.accountId, accountId), eq(entries.faturaMonth, yearMonth)));

  const totalAmount = result[0]?.total || 0;

  await db
    .update(faturas)
    .set({ totalAmount })
    .where(and(eq(faturas.accountId, accountId), eq(faturas.yearMonth, yearMonth)));
}

/**
 * Gets all faturas for a specific account, ordered by month descending.
 */
export const getFaturasByAccount = cache(async (accountId: number) => {
  return await db
    .select()
    .from(faturas)
    .where(eq(faturas.accountId, accountId))
    .orderBy(desc(faturas.yearMonth));
});

/**
 * Gets all faturas for a specific month across all credit card accounts.
 */
export const getFaturasByMonth = cache(async (yearMonth: string) => {
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
    .where(eq(faturas.yearMonth, yearMonth))
    .orderBy(accounts.name);
});

/**
 * Gets fatura details including all entries.
 */
export const getFaturaWithEntries = cache(async (faturaId: number) => {
  const fatura = await db.select().from(faturas).where(eq(faturas.id, faturaId)).limit(1);

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
    throw new Error('Invalid fatura ID');
  }
  if (!Number.isInteger(fromAccountId) || fromAccountId <= 0) {
    throw new Error('Invalid source account ID');
  }

  try {
    // 1. Get fatura details
    const fatura = await db.select().from(faturas).where(eq(faturas.id, faturaId)).limit(1);

    if (!fatura[0]) {
      throw new Error('Fatura not found');
    }

    if (fatura[0].paidAt) {
      throw new Error('Fatura already paid');
    }

    // 2. Verify source account exists and is not a credit card
    const sourceAccount = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, fromAccountId))
      .limit(1);

    if (!sourceAccount[0]) {
      throw new Error('Source account not found');
    }

    if (sourceAccount[0].type === 'credit_card') {
      throw new Error('Cannot pay fatura from a credit card account');
    }

    // 3. Mark fatura as paid
    await db
      .update(faturas)
      .set({
        paidAt: new Date(),
        paidFromAccountId: fromAccountId,
      })
      .where(eq(faturas.id, faturaId));

    // 4. Mark all entries in this fatura as paid
    await db
      .update(entries)
      .set({ paidAt: new Date() })
      .where(
        and(
          eq(entries.accountId, fatura[0].accountId),
          eq(entries.faturaMonth, fatura[0].yearMonth)
        )
      );

    revalidatePath('/faturas');
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to pay fatura:', { faturaId, fromAccountId, error });
    throw error instanceof Error ? error : new Error('Failed to pay fatura. Please try again.');
  }
}

/**
 * Marks a fatura as unpaid (reverses payment).
 */
export async function markFaturaUnpaid(faturaId: number): Promise<void> {
  if (!Number.isInteger(faturaId) || faturaId <= 0) {
    throw new Error('Invalid fatura ID');
  }

  try {
    // Get fatura details
    const fatura = await db.select().from(faturas).where(eq(faturas.id, faturaId)).limit(1);

    if (!fatura[0]) {
      throw new Error('Fatura not found');
    }

    // Mark fatura as unpaid
    await db
      .update(faturas)
      .set({
        paidAt: null,
        paidFromAccountId: null,
      })
      .where(eq(faturas.id, faturaId));

    // Mark all entries in this fatura as unpaid
    await db
      .update(entries)
      .set({ paidAt: null })
      .where(
        and(
          eq(entries.accountId, fatura[0].accountId),
          eq(entries.faturaMonth, fatura[0].yearMonth)
        )
      );

    revalidatePath('/faturas');
    revalidatePath('/expenses');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to mark fatura unpaid:', { faturaId, error });
    throw new Error('Failed to mark fatura as unpaid. Please try again.');
  }
}

/**
 * Backfills fatura records for existing credit card entries.
 * Creates faturas for all distinct (accountId, faturaMonth) combinations
 * where entries exist but no fatura record exists yet.
 */
export async function backfillFaturas(): Promise<{ created: number }> {
  try {
    // Get all distinct (accountId, faturaMonth) combinations from entries
    // Only for credit card accounts
    const distinctCombinations = await db
      .selectDistinct({
        accountId: entries.accountId,
        faturaMonth: entries.faturaMonth,
      })
      .from(entries)
      .innerJoin(accounts, eq(entries.accountId, accounts.id))
      .where(eq(accounts.type, 'credit_card'));

    let created = 0;

    // For each combination, ensure fatura exists and update total
    for (const combo of distinctCombinations) {
      const existing = await db
        .select()
        .from(faturas)
        .where(and(eq(faturas.accountId, combo.accountId), eq(faturas.yearMonth, combo.faturaMonth)))
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
    throw error instanceof Error ? error : new Error('Failed to backfill faturas');
  }
}
