'use server';

import { cache } from 'react';
import { db } from '@/lib/db';
import { accounts, faturas, transfers } from '@/lib/schema';
import { and, desc, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth';
import { t } from '@/lib/i18n/server-errors';
import { revalidatePath } from 'next/cache';
import { syncAccountBalance } from '@/lib/actions/accounts';

export type CreateTransferData = {
  fromAccountId?: number | null;
  toAccountId?: number | null;
  amount: number; // cents
  date: string; // YYYY-MM-DD
  type: 'fatura_payment' | 'internal_transfer' | 'deposit' | 'withdrawal';
  faturaId?: number;
  description?: string;
};

export type TransferFilters = {
  accountId?: number;
  yearMonth?: string; // YYYY-MM
  type?: CreateTransferData['type'];
};

export async function createTransfer(data: CreateTransferData) {
  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new Error(await t('errors.amountPositiveCents'));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    throw new Error(await t('errors.invalidDateFormat'));
  }

  const isInternal = data.type === 'internal_transfer' || data.type === 'fatura_payment';
  if (isInternal) {
    if (!Number.isInteger(data.fromAccountId) || !Number.isInteger(data.toAccountId)) {
      throw new Error(await t('errors.invalidAccountId'));
    }
    if (data.fromAccountId === data.toAccountId) {
      throw new Error(await t('errors.invalidAccountId'));
    }
  }
  if (data.type === 'deposit' && !Number.isInteger(data.toAccountId)) {
    throw new Error(await t('errors.invalidAccountId'));
  }
  if (data.type === 'deposit' && Number.isInteger(data.fromAccountId)) {
    throw new Error(await t('errors.invalidAccountId'));
  }
  if (data.type === 'withdrawal' && !Number.isInteger(data.fromAccountId)) {
    throw new Error(await t('errors.invalidAccountId'));
  }
  if (data.type === 'withdrawal' && Number.isInteger(data.toAccountId)) {
    throw new Error(await t('errors.invalidAccountId'));
  }

  const userId = await getCurrentUserId();

  await db.transaction(async (tx) => {
    const accountIds = [data.fromAccountId, data.toAccountId].filter((id): id is number => Number.isInteger(id));
    if (accountIds.length > 0) {
      const existingAccounts = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.userId, userId), inArray(accounts.id, accountIds)));

      if (existingAccounts.length !== new Set(accountIds).size) {
        throw new Error(await t('errors.accountNotFound'));
      }
    }

    await tx.insert(transfers).values({
      userId,
      fromAccountId: data.fromAccountId ?? null,
      toAccountId: data.toAccountId ?? null,
      amount: data.amount,
      date: data.date,
      type: data.type,
      faturaId: data.faturaId,
      description: data.description?.trim() || null,
    });

    if (data.fromAccountId) {
      await syncAccountBalance(data.fromAccountId, tx, userId);
    }
    if (data.toAccountId) {
      await syncAccountBalance(data.toAccountId, tx, userId);
    }
  });

  revalidatePath('/transfers');
  revalidatePath('/dashboard');
  revalidatePath('/settings/accounts');
}

export async function updateTransfer(transferId: number, data: CreateTransferData) {
  if (!Number.isInteger(transferId) || transferId <= 0) {
    throw new Error(await t('errors.invalidTransactionId'));
  }

  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new Error(await t('errors.amountPositiveCents'));
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    throw new Error(await t('errors.invalidDateFormat'));
  }

  const isInternal = data.type === 'internal_transfer' || data.type === 'fatura_payment';
  if (isInternal) {
    if (!Number.isInteger(data.fromAccountId) || !Number.isInteger(data.toAccountId)) {
      throw new Error(await t('errors.invalidAccountId'));
    }
    if (data.fromAccountId === data.toAccountId) {
      throw new Error(await t('errors.invalidAccountId'));
    }
  }
  if (data.type === 'deposit' && !Number.isInteger(data.toAccountId)) {
    throw new Error(await t('errors.invalidAccountId'));
  }
  if (data.type === 'deposit' && Number.isInteger(data.fromAccountId)) {
    throw new Error(await t('errors.invalidAccountId'));
  }
  if (data.type === 'withdrawal' && !Number.isInteger(data.fromAccountId)) {
    throw new Error(await t('errors.invalidAccountId'));
  }
  if (data.type === 'withdrawal' && Number.isInteger(data.toAccountId)) {
    throw new Error(await t('errors.invalidAccountId'));
  }

  const userId = await getCurrentUserId();

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(transfers)
      .where(and(eq(transfers.userId, userId), eq(transfers.id, transferId)))
      .limit(1);

    if (!existing) {
      throw new Error(await t('errors.relatedRecordNotFound'));
    }
    if (existing.faturaId) {
      throw new Error(await t('errors.invalidDataConstraint'));
    }

    const accountIds = [data.fromAccountId, data.toAccountId].filter((id): id is number => Number.isInteger(id));
    if (accountIds.length > 0) {
      const existingAccounts = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.userId, userId), inArray(accounts.id, accountIds)));

      if (existingAccounts.length !== new Set(accountIds).size) {
        throw new Error(await t('errors.accountNotFound'));
      }
    }

    await tx
      .update(transfers)
      .set({
        fromAccountId: data.fromAccountId ?? null,
        toAccountId: data.toAccountId ?? null,
        amount: data.amount,
        date: data.date,
        type: data.type,
        description: data.description?.trim() || null,
      })
      .where(and(eq(transfers.userId, userId), eq(transfers.id, transferId)));

    const affectedAccounts = new Set<number>();
    if (existing.fromAccountId) affectedAccounts.add(existing.fromAccountId);
    if (existing.toAccountId) affectedAccounts.add(existing.toAccountId);
    if (data.fromAccountId) affectedAccounts.add(data.fromAccountId);
    if (data.toAccountId) affectedAccounts.add(data.toAccountId);

    for (const accountId of affectedAccounts) {
      await syncAccountBalance(accountId, tx, userId);
    }
  });

  revalidatePath('/transfers');
  revalidatePath('/dashboard');
  revalidatePath('/settings/accounts');
}

export async function deleteTransfer(transferId: number) {
  if (!Number.isInteger(transferId) || transferId <= 0) {
    throw new Error(await t('errors.invalidTransactionId'));
  }

  const userId = await getCurrentUserId();

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(transfers)
      .where(and(eq(transfers.userId, userId), eq(transfers.id, transferId)))
      .limit(1);

    if (!existing) {
      throw new Error(await t('errors.relatedRecordNotFound'));
    }
    if (existing.faturaId) {
      throw new Error(await t('errors.invalidDataConstraint'));
    }

    await tx.delete(transfers).where(and(eq(transfers.userId, userId), eq(transfers.id, transferId)));

    const affectedAccounts = new Set<number>();
    if (existing.fromAccountId) affectedAccounts.add(existing.fromAccountId);
    if (existing.toAccountId) affectedAccounts.add(existing.toAccountId);

    for (const accountId of affectedAccounts) {
      await syncAccountBalance(accountId, tx, userId);
    }
  });

  revalidatePath('/transfers');
  revalidatePath('/dashboard');
  revalidatePath('/settings/accounts');
}

export const getTransfers = cache(async (filters: TransferFilters = {}) => {
  const userId = await getCurrentUserId();
  const conditions = [eq(transfers.userId, userId)];

  if (filters.type) {
    conditions.push(eq(transfers.type, filters.type));
  }

  if (filters.accountId) {
    const accountCondition = or(
      eq(transfers.fromAccountId, filters.accountId),
      eq(transfers.toAccountId, filters.accountId)
    );
    if (accountCondition) {
      conditions.push(accountCondition);
    }
  }

  if (filters.yearMonth) {
    conditions.push(sql`to_char(${transfers.date}, 'YYYY-MM') = ${filters.yearMonth}`);
  }

  const results = await db
    .select({
      id: transfers.id,
      amount: transfers.amount,
      date: transfers.date,
      type: transfers.type,
      description: transfers.description,
      fromAccountId: transfers.fromAccountId,
      toAccountId: transfers.toAccountId,
      faturaId: transfers.faturaId,
      ignored: transfers.ignored,
      createdAt: transfers.createdAt,
    })
    .from(transfers)
    .where(and(...conditions))
    .orderBy(desc(transfers.date), desc(transfers.createdAt));

  const accountIds = Array.from(
    new Set(results.flatMap((transfer) => [transfer.fromAccountId, transfer.toAccountId]).filter((id): id is number => !!id))
  );

  const accountMap = new Map<number, string>();
  if (accountIds.length > 0) {
    const accountRows = await db
      .select({ id: accounts.id, name: accounts.name })
      .from(accounts)
      .where(and(eq(accounts.userId, userId), inArray(accounts.id, accountIds)));

    for (const account of accountRows) {
      accountMap.set(account.id, account.name);
    }
  }

  return results.map((transfer) => ({
    ...transfer,
    fromAccountName: transfer.fromAccountId ? accountMap.get(transfer.fromAccountId) ?? null : null,
    toAccountName: transfer.toAccountId ? accountMap.get(transfer.toAccountId) ?? null : null,
  }));
});

export async function backfillFaturaTransfers(): Promise<{ created: number } | { error: string }> {
  try {
    const userId = await getCurrentUserId();
    const paidFaturas = await db
      .select({
        id: faturas.id,
        accountId: faturas.accountId,
        yearMonth: faturas.yearMonth,
        totalAmount: faturas.totalAmount,
        paidAt: faturas.paidAt,
        paidFromAccountId: faturas.paidFromAccountId,
      })
      .from(faturas)
      .where(and(eq(faturas.userId, userId), isNotNull(faturas.paidAt), isNotNull(faturas.paidFromAccountId)));

    let created = 0;

    for (const fatura of paidFaturas) {
      const existing = await db
        .select({ id: transfers.id })
        .from(transfers)
        .where(and(
          eq(transfers.userId, userId),
          eq(transfers.faturaId, fatura.id),
          eq(transfers.type, 'fatura_payment')
        ))
        .limit(1);

      if (existing.length > 0) continue;

      const paidAtValue = fatura.paidAt ?? new Date();
      const paidAtDate = (paidAtValue instanceof Date ? paidAtValue : new Date(paidAtValue)).toISOString().split('T')[0];

      await db.insert(transfers).values({
        userId,
        fromAccountId: fatura.paidFromAccountId,
        toAccountId: fatura.accountId,
        amount: fatura.totalAmount,
        date: paidAtDate,
        type: 'fatura_payment',
        faturaId: fatura.id,
        description: `Fatura ${fatura.yearMonth}`,
      });

      created++;
    }

    if (created > 0) {
      const accountIds = new Set<number>();
      for (const fatura of paidFaturas) {
        if (fatura.paidFromAccountId) accountIds.add(fatura.paidFromAccountId);
        accountIds.add(fatura.accountId);
      }
      for (const accountId of accountIds) {
        await syncAccountBalance(accountId);
      }
    }

    revalidatePath('/transfers');
    revalidatePath('/dashboard');
    revalidatePath('/settings/accounts');

    return { created };
  } catch (error) {
    console.error('Failed to backfill fatura transfers:', error);
    return { error: await t('errors.failedToUpdate') };
  }
}

export async function toggleIgnoreTransfer(transferId: number) {
  if (!Number.isInteger(transferId) || transferId <= 0) {
    throw new Error(await t('errors.invalidTransactionId'));
  }

  try {
    const userId = await getCurrentUserId();

    // Get current state
    const [record] = await db
      .select({
        ignored: transfers.ignored,
        fromAccountId: transfers.fromAccountId,
        toAccountId: transfers.toAccountId,
        faturaId: transfers.faturaId,
      })
      .from(transfers)
      .where(and(eq(transfers.userId, userId), eq(transfers.id, transferId)))
      .limit(1);

    if (!record) {
      throw new Error(await t('errors.relatedRecordNotFound'));
    }
    if (record.faturaId) {
      throw new Error(await t('errors.invalidDataConstraint'));
    }

    // Toggle ignored state
    const newIgnored = !record.ignored;

    await db
      .update(transfers)
      .set({ ignored: newIgnored })
      .where(and(eq(transfers.userId, userId), eq(transfers.id, transferId)));

    // Sync affected account balances
    if (record.fromAccountId) {
      await syncAccountBalance(record.fromAccountId);
    }
    if (record.toAccountId) {
      await syncAccountBalance(record.toAccountId);
    }

    revalidatePath('/transfers');
    revalidatePath('/dashboard');
  } catch (error) {
    console.error('Failed to toggle ignore transfer:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(await t('errors.failedToUpdate'));
  }
}
