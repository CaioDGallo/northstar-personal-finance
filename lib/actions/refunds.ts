'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { db } from '@/lib/db';
import { income, transactions, entries, categories, accounts } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';
import { syncAccountBalance } from '@/lib/actions/accounts';
import { updateFaturaTotal } from '@/lib/actions/faturas';

export type CreateRefundData = {
  transactionId: number;
  amount: number; // cents (max = transaction.totalAmount - transaction.refundedAmount)
  refundDate: string; // 'YYYY-MM-DD'
  faturaMonth: string; // 'YYYY-MM' - which fatura to credit
  description?: string;
};

export async function createRefund(data: CreateRefundData) {
  // Validate inputs
  if (!Number.isInteger(data.transactionId) || data.transactionId <= 0) {
    throw new Error(await t('errors.invalidTransactionId'));
  }
  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new Error(await t('errors.amountPositiveCents'));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.refundDate)) {
    throw new Error(await t('errors.invalidDateFormat'));
  }
  if (!/^\d{4}-\d{2}$/.test(data.faturaMonth)) {
    throw new Error('Invalid fatura month format (expected YYYY-MM)');
  }

  try {
    const userId = await getCurrentUserId();

    // 1. Fetch transaction with category and first entry
    const [transaction] = await db
      .select({
        id: transactions.id,
        description: transactions.description,
        totalAmount: transactions.totalAmount,
        refundedAmount: transactions.refundedAmount,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryType: categories.type,
        accountId: entries.accountId,
        accountName: accounts.name,
        accountType: accounts.type,
        incomeCategoryId: sql<number>`(
          SELECT id FROM ${categories}
          WHERE user_id = ${userId}
          AND type = 'income'
          LIMIT 1
        )`,
      })
      .from(transactions)
      .innerJoin(entries, eq(entries.transactionId, transactions.id))
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .innerJoin(accounts, eq(entries.accountId, accounts.id))
      .where(and(eq(transactions.userId, userId), eq(transactions.id, data.transactionId)))
      .limit(1);

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    // 2. Validate refund amount doesn't exceed remaining amount
    const remainingAmount = transaction.totalAmount - (transaction.refundedAmount || 0);
    if (data.amount > remainingAmount) {
      throw new Error(`Refund amount (${data.amount}) exceeds remaining refundable amount (${remainingAmount})`);
    }

    // 3. Get or validate income category
    if (!transaction.incomeCategoryId) {
      throw new Error('No income category found. Please create an income category first.');
    }

    // 4. Create income entry with refund link
    const refundDescription = data.description || `Estorno - ${transaction.description}`;

    await db.insert(income).values({
      userId,
      description: refundDescription,
      amount: data.amount,
      categoryId: transaction.incomeCategoryId,
      accountId: transaction.accountId,
      receivedDate: data.refundDate,
      receivedAt: null, // Pending by default
      replenishCategoryId: transaction.categoryId, // Auto budget replenishment
      refundOfTransactionId: data.transactionId, // Link to original transaction
      faturaMonth: data.faturaMonth, // Which fatura to credit
    });

    // 5. Update transaction's refunded amount (denormalized for performance)
    await db
      .update(transactions)
      .set({
        refundedAmount: sql`COALESCE(${transactions.refundedAmount}, 0) + ${data.amount}`
      })
      .where(and(eq(transactions.userId, userId), eq(transactions.id, data.transactionId)));

    // 6. Update fatura total if credit card
    if (transaction.accountType === 'credit_card') {
      await updateFaturaTotal(transaction.accountId, data.faturaMonth);
    }

    // 7. Sync account balance
    await syncAccountBalance(transaction.accountId);

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/expenses');
    revalidatePath('/income');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to create refund:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(await handleDbError(error, 'errors.failedToCreate'));
  }
}

export async function deleteRefund(incomeId: number) {
  if (!Number.isInteger(incomeId) || incomeId <= 0) {
    throw new Error(await t('errors.invalidIncomeId'));
  }

  try {
    const userId = await getCurrentUserId();

    // 1. Get refund details
    const [refund] = await db
      .select({
        id: income.id,
        amount: income.amount,
        accountId: income.accountId,
        refundOfTransactionId: income.refundOfTransactionId,
        accountType: accounts.type,
        faturaMonth: income.faturaMonth,
      })
      .from(income)
      .leftJoin(accounts, eq(income.accountId, accounts.id))
      .where(and(eq(income.userId, userId), eq(income.id, incomeId)))
      .limit(1);

    if (!refund) {
      throw new Error(await t('errors.invalidIncomeId'));
    }

    if (!refund.refundOfTransactionId) {
      throw new Error('This income is not a refund');
    }

    // 2. Delete the refund
    await db.delete(income).where(and(eq(income.userId, userId), eq(income.id, incomeId)));

    // 3. Update transaction's refunded amount
    await db
      .update(transactions)
      .set({
        refundedAmount: sql`GREATEST(0, COALESCE(${transactions.refundedAmount}, 0) - ${refund.amount})`,
      })
      .where(and(eq(transactions.userId, userId), eq(transactions.id, refund.refundOfTransactionId)));

    // 4. Update fatura total if credit card
    if (refund.accountType === 'credit_card' && refund.faturaMonth) {
      await updateFaturaTotal(refund.accountId, refund.faturaMonth);
    }

    // 5. Sync account balance
    await syncAccountBalance(refund.accountId);

    revalidateTag(`user-${userId}`, {});
    revalidatePath('/expenses');
    revalidatePath('/income');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to delete refund:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(await handleDbError(error, 'errors.failedToDelete'));
  }
}

export async function getRefundsForTransaction(transactionId: number) {
  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    throw new Error('Invalid transaction ID');
  }

  try {
    const userId = await getCurrentUserId();

    const refunds = await db
      .select({
        id: income.id,
        description: income.description,
        amount: income.amount,
        receivedDate: income.receivedDate,
        receivedAt: sql<string | null>`${income.receivedAt}::text`,
        categoryId: categories.id,
        categoryName: categories.name,
        categoryColor: categories.color,
      })
      .from(income)
      .innerJoin(categories, eq(income.categoryId, categories.id))
      .where(
        and(
          eq(income.userId, userId),
          eq(income.refundOfTransactionId, transactionId)
        )
      )
      .orderBy(income.receivedDate);

    return refunds;
  } catch (error) {
    console.error('Failed to get refunds for transaction:', error);
    throw new Error('Failed to load refunds');
  }
}
