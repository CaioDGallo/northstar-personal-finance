import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { TEST_USER_ID, testAccounts, testCategories } from '@/test/fixtures';
import { verifyBalanceConsistency } from '@/test/helpers/balance-consistency';

type IncomeActions = typeof import('@/lib/actions/income');

describe('Income Balance Sync Bug Fix', () => {
  let db: ReturnType<typeof getTestDb>;
  let createIncome: IncomeActions['createIncome'];
  let getCurrentUserIdMock: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({
      db,
    }));

    getCurrentUserIdMock = vi.fn().mockResolvedValue(TEST_USER_ID);
    vi.doMock('@/lib/auth', () => ({
      getCurrentUserId: getCurrentUserIdMock,
    }));

    const incomeActions = await import('@/lib/actions/income');
    createIncome = incomeActions.createIncome;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  it('syncs account balance after creating income', async () => {
    const [account] = await db
      .insert(schema.accounts)
      .values({ ...testAccounts.checking, currentBalance: 0 })
      .returning();

    const [category] = await db
      .insert(schema.categories)
      .values(testCategories.income)
      .returning();

    // Create income (receivedAt defaults to null)
    await createIncome({
      description: 'Salary',
      amount: 500000,
      categoryId: category.id,
      accountId: account.id,
      receivedDate: '2025-01-15',
    });

    // Verify balance is NOT updated yet (income is pending)
    const resultPending = await verifyBalanceConsistency(db, TEST_USER_ID, account.id);
    expect(resultPending.consistent).toBe(true);
    expect(resultPending.cached).toBe(0); // Pending income doesn't count

    // Mark income as received
    const [incomeRecord] = await db
      .select()
      .from(schema.income)
      .where(eq(schema.income.accountId, account.id))
      .limit(1);

    await db
      .update(schema.income)
      .set({ receivedAt: new Date() })
      .where(eq(schema.income.id, incomeRecord.id));

    // Import and call syncAccountBalance directly to test
    const { syncAccountBalance } = await import('@/lib/actions/accounts');
    await syncAccountBalance(account.id);

    // Verify balance is now updated
    const resultReceived = await verifyBalanceConsistency(db, TEST_USER_ID, account.id);
    expect(resultReceived.consistent).toBe(true);
    expect(resultReceived.cached).toBe(500000);
  });

  it('maintains consistency when creating multiple income records', async () => {
    const [account] = await db
      .insert(schema.accounts)
      .values({ ...testAccounts.checking, currentBalance: 0 })
      .returning();

    const [category] = await db
      .insert(schema.categories)
      .values(testCategories.income)
      .returning();

    // Create first income
    await createIncome({
      description: 'Salary Jan',
      amount: 500000,
      categoryId: category.id,
      accountId: account.id,
      receivedDate: '2025-01-15',
    });

    // Create second income
    await createIncome({
      description: 'Bonus Jan',
      amount: 100000,
      categoryId: category.id,
      accountId: account.id,
      receivedDate: '2025-01-20',
    });

    // Verify balance is still consistent after multiple creates
    const result = await verifyBalanceConsistency(db, TEST_USER_ID, account.id);
    expect(result.consistent).toBe(true);
  });
});
