import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { TEST_USER_ID, testAccounts, testCategories } from '@/test/fixtures';
import { verifyBalanceConsistency } from '@/test/helpers/balance-consistency';

type AccountsActions = typeof import('@/lib/actions/accounts');

describe('Balance Calculation', () => {
  let db: ReturnType<typeof getTestDb>;

  let calculateAccountBalance: AccountsActions['calculateAccountBalance'];
  let syncAccountBalance: AccountsActions['syncAccountBalance'];

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

    const accountActions = await import('@/lib/actions/accounts');
    calculateAccountBalance = accountActions.calculateAccountBalance;
    syncAccountBalance = accountActions.syncAccountBalance;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  describe('calculateAccountBalance', () => {
    it('returns zero for empty account', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.checking)
        .returning();

      const balance = await calculateAccountBalance(account.id);

      expect(balance).toBe(0);
    });

    it('includes received income in balance', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.checking)
        .returning();

      const [category] = await db
        .insert(schema.categories)
        .values(testCategories.income)
        .returning();

      await db.insert(schema.income).values({
        userId: TEST_USER_ID,
        description: 'Salary',
        amount: 500000, // R$ 5,000
        categoryId: category.id,
        accountId: account.id,
        receivedDate: '2025-01-15',
        receivedAt: new Date('2025-01-15T10:00:00Z'),
      });

      const balance = await calculateAccountBalance(account.id);

      expect(balance).toBe(500000);
    });

    it('excludes pending income from balance', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.checking)
        .returning();

      const [category] = await db
        .insert(schema.categories)
        .values(testCategories.income)
        .returning();

      // Received income
      await db.insert(schema.income).values({
        userId: TEST_USER_ID,
        description: 'Salary (Received)',
        amount: 500000,
        categoryId: category.id,
        accountId: account.id,
        receivedDate: '2025-01-15',
        receivedAt: new Date('2025-01-15T10:00:00Z'),
      });

      // Pending income (receivedAt = null)
      await db.insert(schema.income).values({
        userId: TEST_USER_ID,
        description: 'Bonus (Pending)',
        amount: 200000,
        categoryId: category.id,
        accountId: account.id,
        receivedDate: '2025-01-20',
        receivedAt: null,
      });

      const balance = await calculateAccountBalance(account.id);

      // Only received income should count
      expect(balance).toBe(500000);
    });

    it('subtracts expenses from balance regardless of paidAt', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.checking)
        .returning();

      const [category] = await db
        .insert(schema.categories)
        .values(testCategories.expense)
        .returning();

      // Add income first
      const [incomeCategory] = await db
        .insert(schema.categories)
        .values(testCategories.income)
        .returning();

      await db.insert(schema.income).values({
        userId: TEST_USER_ID,
        description: 'Salary',
        amount: 500000,
        categoryId: incomeCategory.id,
        accountId: account.id,
        receivedDate: '2025-01-01',
        receivedAt: new Date('2025-01-01T10:00:00Z'),
      });

      // Create paid expense
      const [paidTransaction] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Paid Expense',
          totalAmount: 10000,
          totalInstallments: 1,
          categoryId: category.id,
        })
        .returning();

      await db.insert(schema.entries).values({
        userId: TEST_USER_ID,
        transactionId: paidTransaction.id,
        accountId: account.id,
        amount: 10000,
        purchaseDate: '2025-01-05',
        faturaMonth: '2025-01',
        dueDate: '2025-01-05',
        installmentNumber: 1,
        paidAt: new Date('2025-01-05T10:00:00Z'),
      });

      // Create unpaid expense
      const [unpaidTransaction] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Unpaid Expense',
          totalAmount: 5000,
          totalInstallments: 1,
          categoryId: category.id,
        })
        .returning();

      await db.insert(schema.entries).values({
        userId: TEST_USER_ID,
        transactionId: unpaidTransaction.id,
        accountId: account.id,
        amount: 5000,
        purchaseDate: '2025-01-10',
        faturaMonth: '2025-01',
        dueDate: '2025-01-10',
        installmentNumber: 1,
        paidAt: null, // Unpaid
      });

      const balance = await calculateAccountBalance(account.id);

      // Both expenses should be subtracted: 500000 - 10000 - 5000 = 485000
      expect(balance).toBe(485000);
    });

    it('handles internal transfers as zero-sum between accounts', async () => {
      const [checking] = await db
        .insert(schema.accounts)
        .values({ ...testAccounts.checking, currentBalance: 0 })
        .returning();

      const [savings] = await db
        .insert(schema.accounts)
        .values({ userId: TEST_USER_ID, name: 'Savings', type: 'savings', currentBalance: 0 })
        .returning();

      const [category] = await db
        .insert(schema.categories)
        .values(testCategories.income)
        .returning();

      // Add income to checking
      await db.insert(schema.income).values({
        userId: TEST_USER_ID,
        description: 'Salary',
        amount: 500000,
        categoryId: category.id,
        accountId: checking.id,
        receivedDate: '2025-01-01',
        receivedAt: new Date('2025-01-01T10:00:00Z'),
      });

      // Transfer from checking to savings
      await db.insert(schema.transfers).values({
        userId: TEST_USER_ID,
        fromAccountId: checking.id,
        toAccountId: savings.id,
        amount: 200000,
        date: '2025-01-05',
        type: 'internal_transfer',
      });

      const checkingBalance = await calculateAccountBalance(checking.id);
      const savingsBalance = await calculateAccountBalance(savings.id);

      // Checking: 500000 - 200000 = 300000
      expect(checkingBalance).toBe(300000);
      // Savings: 0 + 200000 = 200000
      expect(savingsBalance).toBe(200000);
      // Total should be preserved
      expect(checkingBalance + savingsBalance).toBe(500000);
    });

    it('handles deposits (external money in)', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.checking)
        .returning();

      await db.insert(schema.transfers).values({
        userId: TEST_USER_ID,
        fromAccountId: null, // External source
        toAccountId: account.id,
        amount: 100000,
        date: '2025-01-10',
        type: 'deposit',
        description: 'ATM Deposit',
      });

      const balance = await calculateAccountBalance(account.id);

      expect(balance).toBe(100000);
    });

    it('handles withdrawals (external money out)', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.checking)
        .returning();

      const [category] = await db
        .insert(schema.categories)
        .values(testCategories.income)
        .returning();

      // Add income first
      await db.insert(schema.income).values({
        userId: TEST_USER_ID,
        description: 'Salary',
        amount: 500000,
        categoryId: category.id,
        accountId: account.id,
        receivedDate: '2025-01-01',
        receivedAt: new Date('2025-01-01T10:00:00Z'),
      });

      // Withdraw
      await db.insert(schema.transfers).values({
        userId: TEST_USER_ID,
        fromAccountId: account.id,
        toAccountId: null, // External destination
        amount: 50000,
        date: '2025-01-05',
        type: 'withdrawal',
        description: 'ATM Withdrawal',
      });

      const balance = await calculateAccountBalance(account.id);

      expect(balance).toBe(450000);
    });

    it('handles credit card fatura payment flow correctly', async () => {
      const [checking] = await db
        .insert(schema.accounts)
        .values(testAccounts.checking)
        .returning();

      const [creditCard] = await db
        .insert(schema.accounts)
        .values(testAccounts.creditCardWithBilling)
        .returning();

      const [category] = await db
        .insert(schema.categories)
        .values(testCategories.expense)
        .returning();

      const [incomeCategory] = await db
        .insert(schema.categories)
        .values(testCategories.income)
        .returning();

      // Add income to checking
      await db.insert(schema.income).values({
        userId: TEST_USER_ID,
        description: 'Salary',
        amount: 500000,
        categoryId: incomeCategory.id,
        accountId: checking.id,
        receivedDate: '2025-01-01',
        receivedAt: new Date('2025-01-01T10:00:00Z'),
      });

      // Create CC expense
      const [transaction] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Restaurant',
          totalAmount: 15000,
          totalInstallments: 1,
          categoryId: category.id,
        })
        .returning();

      await db.insert(schema.entries).values({
        userId: TEST_USER_ID,
        transactionId: transaction.id,
        accountId: creditCard.id,
        amount: 15000,
        purchaseDate: '2025-01-10',
        faturaMonth: '2025-01',
        dueDate: '2025-02-05',
        installmentNumber: 1,
        paidAt: null,
      });

      // Create fatura
      const [fatura] = await db
        .insert(schema.faturas)
        .values({
          userId: TEST_USER_ID,
          accountId: creditCard.id,
          yearMonth: '2025-01',
          totalAmount: 15000,
          dueDate: '2025-02-05',
        })
        .returning();

      // Pay fatura (creates transfer + marks entries paid)
      await db.insert(schema.transfers).values({
        userId: TEST_USER_ID,
        fromAccountId: checking.id,
        toAccountId: creditCard.id,
        amount: 15000,
        date: '2025-02-05',
        type: 'fatura_payment',
        faturaId: fatura.id,
        description: 'Fatura 2025-01',
      });

      const checkingBalance = await calculateAccountBalance(checking.id);
      const creditCardBalance = await calculateAccountBalance(creditCard.id);

      // Checking: 500000 - 15000 (transfer out) = 485000
      expect(checkingBalance).toBe(485000);
      // Credit card: -15000 (expense) + 15000 (payment) = 0
      expect(creditCardBalance).toBe(0);
    });

    it('handles multi-operation sequence correctly', async () => {
      const [checking] = await db
        .insert(schema.accounts)
        .values(testAccounts.checking)
        .returning();

      const [savings] = await db
        .insert(schema.accounts)
        .values({ userId: TEST_USER_ID, name: 'Savings', type: 'savings' })
        .returning();

      const [expenseCategory] = await db
        .insert(schema.categories)
        .values(testCategories.expense)
        .returning();

      const [incomeCategory] = await db
        .insert(schema.categories)
        .values(testCategories.income)
        .returning();

      // 1. Receive salary: +500000
      await db.insert(schema.income).values({
        userId: TEST_USER_ID,
        description: 'Salary Jan',
        amount: 500000,
        categoryId: incomeCategory.id,
        accountId: checking.id,
        receivedDate: '2025-01-01',
        receivedAt: new Date('2025-01-01T10:00:00Z'),
      });

      // 2. Pay rent: -150000
      const [transaction1] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Rent',
          totalAmount: 150000,
          totalInstallments: 1,
          categoryId: expenseCategory.id,
        })
        .returning();

      await db.insert(schema.entries).values({
        userId: TEST_USER_ID,
        transactionId: transaction1.id,
        accountId: checking.id,
        amount: 150000,
        purchaseDate: '2025-01-05',
        faturaMonth: '2025-01',
        dueDate: '2025-01-05',
        installmentNumber: 1,
        paidAt: new Date('2025-01-05T10:00:00Z'),
      });

      // 3. Transfer to savings: checking -100000, savings +100000
      await db.insert(schema.transfers).values({
        userId: TEST_USER_ID,
        fromAccountId: checking.id,
        toAccountId: savings.id,
        amount: 100000,
        date: '2025-01-10',
        type: 'internal_transfer',
      });

      // 4. Withdraw cash: -50000
      await db.insert(schema.transfers).values({
        userId: TEST_USER_ID,
        fromAccountId: checking.id,
        toAccountId: null,
        amount: 50000,
        date: '2025-01-15',
        type: 'withdrawal',
      });

      // 5. Deposit check: +30000
      await db.insert(schema.transfers).values({
        userId: TEST_USER_ID,
        fromAccountId: null,
        toAccountId: checking.id,
        amount: 30000,
        date: '2025-01-20',
        type: 'deposit',
      });

      const checkingBalance = await calculateAccountBalance(checking.id);
      const savingsBalance = await calculateAccountBalance(savings.id);

      // Checking: 500000 - 150000 - 100000 - 50000 + 30000 = 230000
      expect(checkingBalance).toBe(230000);
      // Savings: 100000
      expect(savingsBalance).toBe(100000);
    });

    it('allows negative balance for credit cards', async () => {
      const [creditCard] = await db
        .insert(schema.accounts)
        .values(testAccounts.creditCard)
        .returning();

      const [category] = await db
        .insert(schema.categories)
        .values(testCategories.expense)
        .returning();

      // Create expense on credit card
      const [transaction] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Purchase',
          totalAmount: 25000,
          totalInstallments: 1,
          categoryId: category.id,
        })
        .returning();

      await db.insert(schema.entries).values({
        userId: TEST_USER_ID,
        transactionId: transaction.id,
        accountId: creditCard.id,
        amount: 25000,
        purchaseDate: '2025-01-10',
        faturaMonth: '2025-01',
        dueDate: '2025-02-05',
        installmentNumber: 1,
        paidAt: null,
      });

      const balance = await calculateAccountBalance(creditCard.id);

      // Credit cards show negative balance (debt)
      expect(balance).toBe(-25000);
    });
  });

  describe('syncAccountBalance', () => {
    it('updates currentBalance field after sync', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values({ ...testAccounts.checking, currentBalance: 0 })
        .returning();

      const [category] = await db
        .insert(schema.categories)
        .values(testCategories.income)
        .returning();

      await db.insert(schema.income).values({
        userId: TEST_USER_ID,
        description: 'Salary',
        amount: 500000,
        categoryId: category.id,
        accountId: account.id,
        receivedDate: '2025-01-15',
        receivedAt: new Date('2025-01-15T10:00:00Z'),
      });

      await syncAccountBalance(account.id);

      const [updated] = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, account.id));

      expect(updated.currentBalance).toBe(500000);
      expect(updated.lastBalanceUpdate).toBeTruthy();
    });

    it('maintains consistency after multiple operations', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values({ ...testAccounts.checking, currentBalance: 0 })
        .returning();

      const [expenseCategory] = await db
        .insert(schema.categories)
        .values(testCategories.expense)
        .returning();

      const [incomeCategory] = await db
        .insert(schema.categories)
        .values(testCategories.income)
        .returning();

      // Add income
      await db.insert(schema.income).values({
        userId: TEST_USER_ID,
        description: 'Salary',
        amount: 500000,
        categoryId: incomeCategory.id,
        accountId: account.id,
        receivedDate: '2025-01-01',
        receivedAt: new Date('2025-01-01T10:00:00Z'),
      });

      await syncAccountBalance(account.id);

      // Add expense
      const [transaction] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Rent',
          totalAmount: 150000,
          totalInstallments: 1,
          categoryId: expenseCategory.id,
        })
        .returning();

      await db.insert(schema.entries).values({
        userId: TEST_USER_ID,
        transactionId: transaction.id,
        accountId: account.id,
        amount: 150000,
        purchaseDate: '2025-01-05',
        faturaMonth: '2025-01',
        dueDate: '2025-01-05',
        installmentNumber: 1,
        paidAt: null,
      });

      await syncAccountBalance(account.id);

      const result = await verifyBalanceConsistency(db, TEST_USER_ID, account.id);

      expect(result.consistent).toBe(true);
      expect(result.cached).toBe(350000);
      expect(result.computed).toBe(350000);
    });
  });
});
