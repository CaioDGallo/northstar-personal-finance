'use server';

import { db } from '@/lib/db';
import { accounts, entries, income, transfers, transactions, type NewAccount } from '@/lib/schema';
import { eq, and, isNotNull, sql } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';
import { computeBalance } from '@/lib/balance';
import { activeTransactionCondition, activeIncomeCondition, activeTransferCondition } from '@/lib/query-helpers';

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

const ACCOUNT_TYPES = new Set(['credit_card', 'checking', 'savings', 'cash']);

async function validateAccountName(name: unknown) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) {
    throw new Error(await t('errors.accountNameRequired'));
  }
  return trimmed;
}

async function validateAccountType(type: unknown) {
  if (!ACCOUNT_TYPES.has(type as string)) {
    throw new Error(await t('errors.invalidAccountType'));
  }
}

async function validateBillingDay(day: unknown, errorKey: string) {
  if (day === null || day === undefined) {
    return;
  }
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 28) {
    throw new Error(await t(errorKey));
  }
}

async function validateCreditLimit(limit: unknown) {
  if (limit === null || limit === undefined) {
    return;
  }
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 0) {
    throw new Error(await t('errors.invalidCreditLimit'));
  }
}

async function validateCreditLimitRequired(type: string, limit: unknown) {
  if (type === 'credit_card' && (limit === null || limit === undefined || limit === '')) {
    throw new Error(await t('errors.creditLimitRequired'));
  }
}

async function validateCurrentBalance(balance: unknown) {
  if (balance === null || balance === undefined) {
    return;
  }
  if (typeof balance !== 'number' || !Number.isInteger(balance)) {
    throw new Error(await t('errors.invalidBalance'));
  }
}

export async function getAccounts() {
  const userId = await getCurrentUserId();
  return await db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(accounts.name);
}

type DbClient = Pick<typeof db, 'select' | 'update'>;

async function calculateAccountBalanceForUser(dbClient: DbClient, userId: string, accountId: number) {
  const [{ total: totalExpenses }] = await dbClient
    .select({ total: sql<number>`CAST(COALESCE(SUM(${entries.amount}), 0) AS INTEGER)` })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .where(and(
      eq(entries.userId, userId),
      eq(entries.accountId, accountId),
      activeTransactionCondition()
    ));

  const [{ total: totalIncome }] = await dbClient
    .select({ total: sql<number>`CAST(COALESCE(SUM(${income.amount}), 0) AS INTEGER)` })
    .from(income)
    .where(and(
      eq(income.userId, userId),
      eq(income.accountId, accountId),
      isNotNull(income.receivedAt),
      activeIncomeCondition()
    ));

  const [{ total: totalTransfersOut }] = await dbClient
    .select({ total: sql<number>`CAST(COALESCE(SUM(${transfers.amount}), 0) AS INTEGER)` })
    .from(transfers)
    .where(and(
      eq(transfers.userId, userId),
      eq(transfers.fromAccountId, accountId),
      activeTransferCondition()
    ));

  const [{ total: totalTransfersIn }] = await dbClient
    .select({ total: sql<number>`CAST(COALESCE(SUM(${transfers.amount}), 0) AS INTEGER)` })
    .from(transfers)
    .where(and(
      eq(transfers.userId, userId),
      eq(transfers.toAccountId, accountId),
      activeTransferCondition()
    ));

  return computeBalance({
    totalExpenses,
    totalReceivedIncome: totalIncome,
    totalTransfersIn,
    totalTransfersOut,
  });
}

export async function calculateAccountBalance(accountId: number): Promise<number> {
  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new Error(await t('errors.invalidAccountId'));
  }
  const userId = await getCurrentUserId();
  return calculateAccountBalanceForUser(db, userId, accountId);
}

export async function syncAccountBalance(
  accountId: number,
  dbClient: DbClient = db,
  userId?: string
): Promise<number> {
  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new Error(await t('errors.invalidAccountId'));
  }

  const effectiveUserId = userId ?? await getCurrentUserId();
  const balance = await calculateAccountBalanceForUser(dbClient, effectiveUserId, accountId);

  await dbClient
    .update(accounts)
    .set({ currentBalance: balance, lastBalanceUpdate: new Date() })
    .where(and(eq(accounts.userId, effectiveUserId), eq(accounts.id, accountId)));

  return balance;
}

export async function reconcileAccountBalancesForUser(
  userId: string,
  dbClient: DbClient = db
): Promise<{ updated: number }> {
  if (!userId) {
    throw new Error(await t('errors.notAuthenticated'));
  }

  const userAccounts = await dbClient
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  let updated = 0;
  for (const account of userAccounts) {
    const balance = await calculateAccountBalanceForUser(dbClient, userId, account.id);
    await dbClient
      .update(accounts)
      .set({ currentBalance: balance, lastBalanceUpdate: new Date() })
      .where(and(eq(accounts.userId, userId), eq(accounts.id, account.id)));
    updated += 1;
  }

  return { updated };
}

export async function reconcileCurrentUserBalances(): Promise<void> {
  const userId = await getCurrentUserId();
  await reconcileAccountBalancesForUser(userId);

  revalidatePath('/settings/accounts');
  revalidateTag('accounts', 'max');
}

export async function reconcileAllAccountBalances(): Promise<{ users: number; accounts: number }> {
  const userRows = await db
    .selectDistinct({ userId: accounts.userId })
    .from(accounts);

  let users = 0;
  let accountsUpdated = 0;

  for (const row of userRows) {
    const result = await reconcileAccountBalancesForUser(row.userId);
    users += 1;
    accountsUpdated += result.updated;
  }

  return { users, accounts: accountsUpdated };
}

export async function updateAccountBalance(
  accountId: number,
  amount: number,
  operation: 'add' | 'subtract',
  dbClient: DbClient = db,
  userId?: string
): Promise<void> {
  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new Error(await t('errors.invalidAccountId'));
  }
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(await t('errors.amountPositiveCents'));
  }

  const effectiveUserId = userId ?? await getCurrentUserId();
  const delta = operation === 'add' ? amount : -amount;

  await dbClient
    .update(accounts)
    .set({
      currentBalance: sql`${accounts.currentBalance} + ${delta}`,
      lastBalanceUpdate: new Date(),
    })
    .where(and(eq(accounts.userId, effectiveUserId), eq(accounts.id, accountId)));
}

export async function getAccountsWithBalances() {
  const userId = await getCurrentUserId();
  const userAccounts = await getAccountsByUser(userId);
  const balances = await Promise.all(
    userAccounts.map((account) => calculateAccountBalanceForUser(db, userId, account.id))
  );

  return userAccounts.map((account, index) => ({
    ...account,
    currentBalance: balances[index] ?? account.currentBalance,
  }));
}

// Internal helper so callers can reuse the same query shape.
export async function getAccountsByUser(userId: string) {
  return await db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(accounts.name);
}

export async function createAccount(data: Omit<NewAccount, 'id' | 'userId' | 'createdAt'>): Promise<ActionResult> {
  try {
    const name = await validateAccountName(data.name);
    await validateAccountType(data.type);
    await validateBillingDay(data.closingDay, 'errors.invalidClosingDay');
    await validateBillingDay(data.paymentDueDay, 'errors.invalidPaymentDueDay');
    await validateCreditLimit(data.creditLimit);
    await validateCreditLimitRequired(data.type, data.creditLimit);
    await validateCurrentBalance(data.currentBalance);

    const userId = await getCurrentUserId();
    const accountData = {
      ...data,
      name,
      userId,
      ...(data.currentBalance !== undefined && { lastBalanceUpdate: new Date() }),
    };
    await db.insert(accounts).values(accountData);
    revalidatePath('/settings/accounts');
    revalidateTag('accounts', 'max');
    return { success: true };
  } catch (error) {
    console.error('[accounts:create] Failed:', error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: await handleDbError(error, 'errors.failedToCreate') };
  }
}

export async function updateAccount(id: number, data: Partial<Omit<NewAccount, 'id' | 'userId' | 'createdAt'>>): Promise<ActionResult> {
  try {
    if (!Number.isInteger(id) || id <= 0) {
      return { success: false, error: await t('errors.invalidAccountId') };
    }

    const updates = { ...data };
    if (updates.name !== undefined) {
      updates.name = await validateAccountName(updates.name);
    }
    if (updates.type !== undefined) {
      await validateAccountType(updates.type);
    }
    if (updates.closingDay !== undefined) {
      await validateBillingDay(updates.closingDay, 'errors.invalidClosingDay');
    }
    if (updates.paymentDueDay !== undefined) {
      await validateBillingDay(updates.paymentDueDay, 'errors.invalidPaymentDueDay');
    }
    if (updates.creditLimit !== undefined) {
      await validateCreditLimit(updates.creditLimit);
    }
    if (updates.currentBalance !== undefined) {
      await validateCurrentBalance(updates.currentBalance);
    }

    // When changing type to credit card, require credit limit
    if (updates.type === 'credit_card') {
      await validateCreditLimitRequired(updates.type, updates.creditLimit);
    }

    const userId = await getCurrentUserId();
    await db.update(accounts).set(updates).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
    revalidatePath('/settings/accounts');
    revalidateTag('accounts', 'max');
    return { success: true };
  } catch (error) {
    console.error('[accounts:update] Failed:', error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    }
    return { success: false, error: await handleDbError(error, 'errors.failedToUpdate') };
  }
}

export async function deleteAccount(id: number) {
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(await t('errors.invalidAccountId'));
  }

  try {
    const userId = await getCurrentUserId();
    await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
    revalidatePath('/settings/accounts');
    revalidateTag('accounts', 'max');
  } catch (error) {
    console.error('[accounts:delete] Failed:', error);
    throw new Error(await handleDbError(error, 'errors.failedToDelete'));
  }
}
