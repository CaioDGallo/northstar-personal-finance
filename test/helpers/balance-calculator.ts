import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { entries, income, transfers } from '@/lib/schema';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { computeBalance } from '@/lib/balance';

/**
 * Calculates account balance from source data (for testing)
 * Mirrors the logic in /lib/actions/accounts.ts:calculateAccountBalanceForUser
 */
export async function calculateAccountBalanceForUser(
  db: PgliteDatabase,
  userId: string,
  accountId: number
): Promise<number> {
  const [{ total: totalExpenses }] = await db
    .select({ total: sql<number>`CAST(COALESCE(SUM(${entries.amount}), 0) AS INTEGER)` })
    .from(entries)
    .where(and(eq(entries.userId, userId), eq(entries.accountId, accountId)));

  const [{ total: totalIncome }] = await db
    .select({ total: sql<number>`CAST(COALESCE(SUM(${income.amount}), 0) AS INTEGER)` })
    .from(income)
    .where(
      and(eq(income.userId, userId), eq(income.accountId, accountId), isNotNull(income.receivedAt))
    );

  const [{ total: totalTransfersOut }] = await db
    .select({ total: sql<number>`CAST(COALESCE(SUM(${transfers.amount}), 0) AS INTEGER)` })
    .from(transfers)
    .where(and(eq(transfers.userId, userId), eq(transfers.fromAccountId, accountId)));

  const [{ total: totalTransfersIn }] = await db
    .select({ total: sql<number>`CAST(COALESCE(SUM(${transfers.amount}), 0) AS INTEGER)` })
    .from(transfers)
    .where(and(eq(transfers.userId, userId), eq(transfers.toAccountId, accountId)));

  return computeBalance({
    totalExpenses,
    totalReceivedIncome: totalIncome,
    totalTransfersIn,
    totalTransfersOut,
  });
}
