import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { accounts } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { calculateAccountBalanceForUser } from './balance-calculator';

/**
 * Verifies that an account's cached balance matches its computed balance
 */
export async function verifyBalanceConsistency(
  db: PgliteDatabase,
  userId: string,
  accountId: number
): Promise<{
  cached: number;
  computed: number;
  consistent: boolean;
  delta: number;
}> {
  // Get cached balance from DB
  const [account] = await db
    .select({ currentBalance: accounts.currentBalance })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!account) {
    throw new Error(`Account ${accountId} not found`);
  }

  const cached = account.currentBalance;

  // Compute fresh balance
  const computed = await calculateAccountBalanceForUser(db, userId, accountId);

  const delta = Math.abs(cached - computed);

  return {
    cached,
    computed,
    consistent: cached === computed,
    delta,
  };
}

/**
 * Verifies balance consistency for all accounts belonging to a user
 */
export async function verifyAllBalancesConsistent(
  db: PgliteDatabase,
  userId: string
): Promise<{
  allConsistent: boolean;
  results: Array<{ accountId: number; cached: number; computed: number; delta: number }>;
}> {
  const userAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId));

  const results = [];
  let allConsistent = true;

  for (const account of userAccounts) {
    const result = await verifyBalanceConsistency(db, userId, account.id);
    results.push({
      accountId: account.id,
      cached: result.cached,
      computed: result.computed,
      delta: result.delta,
    });
    if (!result.consistent) {
      allConsistent = false;
    }
  }

  return { allConsistent, results };
}
