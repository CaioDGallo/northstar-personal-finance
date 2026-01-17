import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID, testAccounts, testCategories } from '@/test/fixtures';
import { and, eq } from 'drizzle-orm';

type ImportActions = typeof import('@/lib/actions/import');
type FaturaActions = typeof import('@/lib/actions/faturas');

type DbClient = ReturnType<typeof getTestDb>;

// Mock rate limit module
vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>();
  return {
    ...actual,
    checkBulkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  };
});

describe('Import Actions', () => {
  let db: DbClient;

  let importMixed: ImportActions['importMixed'];
  let convertExpenseToFaturaPayment: FaturaActions['convertExpenseToFaturaPayment'];

  let getCurrentUserIdMock: ReturnType<typeof vi.fn>;

  const seedAccount = async (values: typeof schema.accounts.$inferInsert) => {
    const [account] = await db.insert(schema.accounts).values(values).returning();
    return account;
  };

  const seedCategory = async (type: 'expense' | 'income' = 'expense') => {
    const categoryData = type === 'expense' ? testCategories.expense : testCategories.income;
    const [category] = await db
      .insert(schema.categories)
      .values({ ...categoryData, isImportDefault: true })
      .returning();
    return category;
  };

  const seedFaturaWithEntry = async (accountId: number, categoryId: number, amount: number) => {
    const faturaMonth = '2025-01';
    const dueDate = '2025-02-05';

    const [transaction] = await db
      .insert(schema.transactions)
      .values({
        userId: TEST_USER_ID,
        description: 'Test Transaction',
        totalAmount: amount,
        totalInstallments: 1,
        categoryId,
      })
      .returning();

    await db.insert(schema.entries).values({
      userId: TEST_USER_ID,
      transactionId: transaction.id,
      accountId,
      amount,
      purchaseDate: '2025-01-10',
      faturaMonth,
      dueDate,
      installmentNumber: 1,
      paidAt: null,
    });

    const [fatura] = await db
      .insert(schema.faturas)
      .values({
        userId: TEST_USER_ID,
        accountId,
        yearMonth: faturaMonth,
        closingDate: '2025-01-15',
        totalAmount: amount,
        dueDate,
        paidAt: null,
      })
      .returning();

    return { transaction, fatura, faturaMonth, amount };
  };

  beforeAll(async () => {
    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({
      db,
    }));

    getCurrentUserIdMock = vi.fn().mockResolvedValue(TEST_USER_ID);
    vi.doMock('@/lib/auth', () => ({
      getCurrentUserId: getCurrentUserIdMock,
    }));

    const importActions = await import('@/lib/actions/import');
    importMixed = importActions.importMixed;

    const faturaActions = await import('@/lib/actions/faturas');
    convertExpenseToFaturaPayment = faturaActions.convertExpenseToFaturaPayment;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  describe('importMixed duplicate detection', () => {
    it('skips expenses with externalId already in transactions', async () => {
      const checking = await seedAccount(testAccounts.checking);
      const expenseCategory = await seedCategory('expense');
      await seedCategory('income');
      const externalId = 'existing-bank-uuid';

      // Create existing transaction with this externalId
      await db.insert(schema.transactions).values({
        userId: TEST_USER_ID,
        description: 'Existing Transaction',
        totalAmount: 5000,
        totalInstallments: 1,
        categoryId: expenseCategory.id,
        externalId,
      });

      // Try to import with the same externalId
      const result = await importMixed({
        accountId: checking.id,
        rows: [
          {
            date: '2025-01-10',
            description: 'Duplicate Expense',
            amountCents: 5000,
            rowIndex: 0,
            type: 'expense',
            externalId,
          },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.importedExpenses).toBe(0);
        expect(result.skippedDuplicates).toBe(1);
      }
    });

    it('skips expenses with externalId already in transfers (converted to fatura payment)', async () => {
      const checking = await seedAccount(testAccounts.checking);
      const creditCard = await seedAccount(testAccounts.creditCardWithBilling);
      const expenseCategory = await seedCategory('expense');
      await seedCategory('income');
      const externalId = 'fatura-payment-uuid';
      const amount = 10000;

      // Create fatura with entry
      const { fatura } = await seedFaturaWithEntry(creditCard.id, expenseCategory.id, amount);

      // Create expense from checking that will be converted
      const [transaction] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Expense to Convert',
          totalAmount: amount,
          totalInstallments: 1,
          categoryId: expenseCategory.id,
          externalId,
        })
        .returning();

      const [entry] = await db
        .insert(schema.entries)
        .values({
          userId: TEST_USER_ID,
          transactionId: transaction.id,
          accountId: checking.id,
          amount,
          purchaseDate: '2025-01-10',
          faturaMonth: '2025-01',
          dueDate: '2025-01-10',
          installmentNumber: 1,
        })
        .returning();

      // Convert the expense to a fatura payment
      await convertExpenseToFaturaPayment(entry.id, fatura.id);

      // Verify the externalId is now in transfers
      const [transfer] = await db
        .select()
        .from(schema.transfers)
        .where(and(eq(schema.transfers.userId, TEST_USER_ID), eq(schema.transfers.externalId, externalId)));

      expect(transfer).toBeDefined();
      expect(transfer.externalId).toBe(externalId);

      // Verify the original transaction is deleted
      const deletedTransaction = await db
        .select()
        .from(schema.transactions)
        .where(and(eq(schema.transactions.userId, TEST_USER_ID), eq(schema.transactions.externalId, externalId)));

      expect(deletedTransaction).toHaveLength(0);

      // Now try to import with the same externalId - should be skipped
      const result = await importMixed({
        accountId: checking.id,
        rows: [
          {
            date: '2025-01-10',
            description: 'Reimported Expense',
            amountCents: amount,
            rowIndex: 0,
            type: 'expense',
            externalId,
          },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.importedExpenses).toBe(0);
        expect(result.skippedDuplicates).toBe(1);
      }

      // Verify no new transaction was created
      const allTransactions = await db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.userId, TEST_USER_ID));

      // Should only have the fatura entry transaction, not the reimported one
      expect(allTransactions).toHaveLength(1);
    });

    it('imports new expenses without externalId conflict', async () => {
      const checking = await seedAccount(testAccounts.checking);
      await seedCategory('expense');
      await seedCategory('income');

      const result = await importMixed({
        accountId: checking.id,
        rows: [
          {
            date: '2025-01-10',
            description: 'New Expense',
            amountCents: 5000,
            rowIndex: 0,
            type: 'expense',
            externalId: 'new-unique-uuid',
          },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.importedExpenses).toBe(1);
        expect(result.skippedDuplicates).toBe(0);
      }
    });

    it('skips income with externalId already in income table', async () => {
      const checking = await seedAccount(testAccounts.checking);
      await seedCategory('expense');
      const incomeCategory = await seedCategory('income');
      const externalId = 'existing-income-uuid';

      await db.insert(schema.income).values({
        userId: TEST_USER_ID,
        description: 'Existing Income',
        amount: 25000,
        categoryId: incomeCategory.id,
        accountId: checking.id,
        receivedDate: '2025-01-15',
        receivedAt: new Date('2025-01-15T00:00:00Z'),
        externalId,
      });

      const result = await importMixed({
        accountId: checking.id,
        rows: [
          {
            date: '2025-01-15',
            description: 'Duplicate Income',
            amountCents: 25000,
            rowIndex: 0,
            type: 'income',
            externalId,
          },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.importedIncome).toBe(0);
        expect(result.skippedDuplicates).toBe(1);
      }
    });
  });

  describe('importMixed installment handling', () => {
    it('imports partial installments when only parcela 2/3 is provided', async () => {
      const creditCard = await seedAccount(testAccounts.creditCardWithBilling);
      await seedCategory('expense');
      await seedCategory('income');

      const result = await importMixed({
        accountId: creditCard.id,
        rows: [
          {
            date: '2025-01-20',
            description: 'Notebook - Parcela 2/3',
            amountCents: 120000,
            rowIndex: 0,
            type: 'expense',
            installmentInfo: {
              current: 2,
              total: 3,
              baseDescription: 'Notebook',
            },
          },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.importedExpenses).toBe(1);
      }

      const [transaction] = await db.select().from(schema.transactions);
      expect(transaction.totalInstallments).toBe(3);
      expect(transaction.totalAmount).toBe(360000);

      const entries = await db
        .select()
        .from(schema.entries)
        .where(eq(schema.entries.transactionId, transaction.id));
      expect(entries).toHaveLength(2);

      // With new behavior: subsequent installments use fatura window start
      // Base purchase date is calculated: parcela 2 date (Jan 20) - 1 month = Dec 20
      // Base fatura month: Dec 20 is after closing day 15, so base fatura = Jan
      // Entry 2: faturaMonth = Feb, purchaseDate = fatura window start = Jan 16
      // Entry 3: faturaMonth = Mar, purchaseDate = fatura window start = Feb 16
      const entry2 = entries.find((entry) => entry.installmentNumber === 2);
      const entry3 = entries.find((entry) => entry.installmentNumber === 3);

      expect(entry2?.purchaseDate).toBe('2025-01-16');
      expect(entry2?.faturaMonth).toBe('2025-02');
      expect(entry2?.dueDate).toBe('2025-03-05');

      expect(entry3?.purchaseDate).toBe('2025-02-16');
      expect(entry3?.faturaMonth).toBe('2025-03');
      expect(entry3?.dueDate).toBe('2025-04-05');
      expect(entry3?.amount).toBe(120000);
    });

    it('adds missing installments to an existing transaction and updates totals', async () => {
      const checking = await seedAccount(testAccounts.checking);
      const expenseCategory = await seedCategory('expense');
      await seedCategory('income');

      const [transaction] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Laptop - Parcela 1/3',
          totalAmount: 300000,
          totalInstallments: 3,
          categoryId: expenseCategory.id,
        })
        .returning();

      await db.insert(schema.entries).values([
        {
          userId: TEST_USER_ID,
          transactionId: transaction.id,
          accountId: checking.id,
          amount: 100000,
          purchaseDate: '2025-01-10',
          faturaMonth: '2025-01',
          dueDate: '2025-01-10',
          installmentNumber: 1,
          paidAt: null,
        },
        {
          userId: TEST_USER_ID,
          transactionId: transaction.id,
          accountId: checking.id,
          amount: 100000,
          purchaseDate: '2025-02-10',
          faturaMonth: '2025-02',
          dueDate: '2025-02-10',
          installmentNumber: 2,
          paidAt: null,
        },
      ]);

      const result = await importMixed({
        accountId: checking.id,
        rows: [
          {
            date: '2025-02-10',
            description: 'Laptop - Parcela 2/3',
            amountCents: 120000,
            rowIndex: 0,
            type: 'expense',
            installmentInfo: {
              current: 2,
              total: 3,
              baseDescription: 'Laptop',
            },
          },
          {
            date: '2025-03-10',
            description: 'Laptop - Parcela 3/3',
            amountCents: 130000,
            rowIndex: 1,
            type: 'expense',
            installmentInfo: {
              current: 3,
              total: 3,
              baseDescription: 'Laptop',
            },
          },
        ],
      });

      expect(result.success).toBe(true);

      const entries = await db
        .select()
        .from(schema.entries)
        .where(eq(schema.entries.transactionId, transaction.id));
      expect(entries).toHaveLength(3);

      const updatedEntry2 = entries.find((entry) => entry.installmentNumber === 2);
      const entry3 = entries.find((entry) => entry.installmentNumber === 3);
      expect(updatedEntry2?.amount).toBe(120000);
      expect(entry3?.amount).toBe(130000);
      expect(entry3?.purchaseDate).toBe('2025-03-10');

      const [updatedTransaction] = await db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.id, transaction.id));
      expect(updatedTransaction.totalAmount).toBe(350000);
    });
  });

  describe('importMixed mixed expense and income', () => {
    it('imports expenses and income in a single batch', async () => {
      const checking = await seedAccount(testAccounts.checking);
      await seedCategory('expense');
      await seedCategory('income');

      const result = await importMixed({
        accountId: checking.id,
        rows: [
          {
            date: '2025-01-05',
            description: 'Coffee',
            amountCents: 1500,
            rowIndex: 0,
            type: 'expense',
          },
          {
            date: '2025-01-06',
            description: 'Salary',
            amountCents: 250000,
            rowIndex: 1,
            type: 'income',
          },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.importedExpenses).toBe(1);
        expect(result.importedIncome).toBe(1);
      }

      const transactions = await db.select().from(schema.transactions);
      const entries = await db.select().from(schema.entries);
      const incomeRows = await db.select().from(schema.income);

      expect(transactions).toHaveLength(1);
      expect(entries).toHaveLength(1);
      expect(incomeRows).toHaveLength(1);
    });
  });

  describe('Category Auto-Suggestions', () => {
    let getCategorySuggestions: ImportActions['getCategorySuggestions'];

    beforeAll(async () => {
      const importActions = await import('@/lib/actions/import');
      getCategorySuggestions = importActions.getCategorySuggestions;
    });

    it('returns suggestions sorted by frequency', async () => {
      const category1 = await seedCategory('expense');
      const category2 = await db
        .insert(schema.categories)
        .values({ ...testCategories.expense, name: 'Category 2' })
        .returning()
        .then((rows) => rows[0]);

      // Seed frequency data - category1 used 5 times, category2 used 10 times
      await db.insert(schema.categoryFrequency).values([
        {
          userId: TEST_USER_ID,
          descriptionNormalized: 'coffee',
          categoryId: category1.id,
          type: 'expense',
          count: 5,
          lastUsedAt: new Date('2025-01-10'),
        },
        {
          userId: TEST_USER_ID,
          descriptionNormalized: 'coffee',
          categoryId: category2.id,
          type: 'expense',
          count: 10,
          lastUsedAt: new Date('2025-01-15'),
        },
      ]);

      const result = await getCategorySuggestions({
        expenseDescriptions: ['Coffee'],
        incomeDescriptions: [],
      });

      // Should suggest category2 (higher frequency)
      expect(result.expense['Coffee']).toEqual({
        id: category2.id,
        name: 'Category 2',
        color: category2.color,
      });
    });

    it('handles normalized descriptions (case-insensitive)', async () => {
      const category = await seedCategory('expense');

      await db.insert(schema.categoryFrequency).values({
        userId: TEST_USER_ID,
        descriptionNormalized: 'starbucks coffee',
        categoryId: category.id,
        type: 'expense',
        count: 3,
        lastUsedAt: new Date('2025-01-10'),
      });

      const result = await getCategorySuggestions({
        expenseDescriptions: ['Starbucks Coffee', 'STARBUCKS COFFEE', '  starbucks coffee  '],
        incomeDescriptions: [],
      });

      // All variations should get the same suggestion
      expect(result.expense['Starbucks Coffee']).toBeDefined();
      expect(result.expense['STARBUCKS COFFEE']).toBeUndefined(); // Only first occurrence
      expect(result.expense['  starbucks coffee  ']).toBeUndefined(); // Only first occurrence
    });

    it('separates expense vs income suggestions', async () => {
      const expenseCategory = await seedCategory('expense');
      const incomeCategory = await seedCategory('income');

      await db.insert(schema.categoryFrequency).values([
        {
          userId: TEST_USER_ID,
          descriptionNormalized: 'paycheck',
          categoryId: incomeCategory.id,
          type: 'income',
          count: 5,
          lastUsedAt: new Date('2025-01-10'),
        },
        {
          userId: TEST_USER_ID,
          descriptionNormalized: 'grocery',
          categoryId: expenseCategory.id,
          type: 'expense',
          count: 10,
          lastUsedAt: new Date('2025-01-15'),
        },
      ]);

      const result = await getCategorySuggestions({
        expenseDescriptions: ['Grocery'],
        incomeDescriptions: ['Paycheck'],
      });

      expect(result.expense['Grocery']).toEqual({
        id: expenseCategory.id,
        name: expenseCategory.name,
        color: expenseCategory.color,
      });
      expect(result.income['Paycheck']).toEqual({
        id: incomeCategory.id,
        name: incomeCategory.name,
        color: incomeCategory.color,
      });
    });

    it('returns empty when no history', async () => {
      await seedCategory('expense');
      await seedCategory('income');

      const result = await getCategorySuggestions({
        expenseDescriptions: ['Unknown Expense'],
        incomeDescriptions: ['Unknown Income'],
      });

      expect(result.expense).toEqual({});
      expect(result.income).toEqual({});
    });
  });

  describe('Error Handling', () => {
    it('rejects invalid accountId', async () => {
      await seedCategory('expense');
      await seedCategory('income');

      const result = await importMixed({
        accountId: -1,
        rows: [
          {
            date: '2025-01-10',
            description: 'Test',
            amountCents: 5000,
            rowIndex: 0,
            type: 'expense',
          },
        ],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('rejects missing account', async () => {
      await seedCategory('expense');
      await seedCategory('income');

      const result = await importMixed({
        accountId: 9999,
        rows: [
          {
            date: '2025-01-10',
            description: 'Test',
            amountCents: 5000,
            rowIndex: 0,
            type: 'expense',
          },
        ],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('rejects empty rows array', async () => {
      const checking = await seedAccount(testAccounts.checking);
      await seedCategory('expense');
      await seedCategory('income');

      const result = await importMixed({
        accountId: checking.id,
        rows: [],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });

    it('rejects rate limit exceeded', async () => {
      const checking = await seedAccount(testAccounts.checking);
      await seedCategory('expense');
      await seedCategory('income');

      // Mock rate limit check to return not allowed
      const rateLimitModule = await import('@/lib/rate-limit');
      vi.mocked(rateLimitModule.checkBulkRateLimit).mockResolvedValueOnce({
        allowed: false,
        retryAfter: 60,
      });

      const result = await importMixed({
        accountId: checking.id,
        rows: [
          {
            date: '2025-01-10',
            description: 'Test',
            amountCents: 5000,
            rowIndex: 0,
            type: 'expense',
          },
        ],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
      }

      // Reset to default (allowed: true)
      vi.mocked(rateLimitModule.checkBulkRateLimit).mockResolvedValue({
        allowed: true,
      });
    });
  });

  describe('Account Balance Sync', () => {
    it('updates account currentBalance after import', async () => {
      const checking = await seedAccount({ ...testAccounts.checking, currentBalance: 100000 });
      await seedCategory('expense');
      await seedCategory('income');

      // Import expense of 25000
      await importMixed({
        accountId: checking.id,
        rows: [
          {
            date: '2025-01-10',
            description: 'Purchase',
            amountCents: 25000,
            rowIndex: 0,
            type: 'expense',
          },
        ],
      });

      // Balance is recalculated from actual transactions (starting from 0)
      // So after -25000 expense, balance should be -25000
      const [account] = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, checking.id));
      expect(account.currentBalance).toBe(-25000);
    });

    it('updates lastBalanceUpdate timestamp', async () => {
      const oldTimestamp = new Date('2020-01-01');
      const checking = await seedAccount({
        ...testAccounts.checking,
        currentBalance: 50000,
        lastBalanceUpdate: oldTimestamp,
      });
      await seedCategory('expense');
      await seedCategory('income');

      const beforeTimestamp = oldTimestamp.getTime();

      await importMixed({
        accountId: checking.id,
        rows: [
          {
            date: '2025-01-10',
            description: 'Purchase',
            amountCents: 10000,
            rowIndex: 0,
            type: 'expense',
          },
        ],
      });

      const [account] = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, checking.id));

      expect(account.lastBalanceUpdate).toBeDefined();
      if (account.lastBalanceUpdate) {
        expect(account.lastBalanceUpdate.getTime()).toBeGreaterThan(beforeTimestamp);
      }
    });

    it('handles multiple imports correctly', async () => {
      const checking = await seedAccount({ ...testAccounts.checking, currentBalance: 200000 });
      await seedCategory('expense');
      await seedCategory('income');

      // First import - expense 30000
      await importMixed({
        accountId: checking.id,
        rows: [
          {
            date: '2025-01-10',
            description: 'Purchase 1',
            amountCents: 30000,
            rowIndex: 0,
            type: 'expense',
          },
        ],
      });

      // Balance recalculated from actual transactions: 0 - 30000 = -30000
      let [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, checking.id));
      expect(account.currentBalance).toBe(-30000);

      // Second import - expense 20000
      await importMixed({
        accountId: checking.id,
        rows: [
          {
            date: '2025-01-15',
            description: 'Purchase 2',
            amountCents: 20000,
            rowIndex: 0,
            type: 'expense',
          },
        ],
      });

      // Balance: 0 - 30000 - 20000 = -50000
      [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, checking.id));
      expect(account.currentBalance).toBe(-50000);

      // Third import - income 100000
      await importMixed({
        accountId: checking.id,
        rows: [
          {
            date: '2025-01-20',
            description: 'Income',
            amountCents: 100000,
            rowIndex: 0,
            type: 'income',
          },
        ],
      });

      // Balance: 100000 - 30000 - 20000 = 50000
      [account] = await db.select().from(schema.accounts).where(eq(schema.accounts.id, checking.id));
      expect(account.currentBalance).toBe(50000);
    });
  });

  describe('Category Frequency Post-Import', () => {
    it('creates categoryFrequency rows for imported expenses', async () => {
      const checking = await seedAccount(testAccounts.checking);
      const category = await seedCategory('expense');
      await seedCategory('income');

      await importMixed({
        accountId: checking.id,
        rows: [
          {
            date: '2025-01-10',
            description: 'Coffee Shop',
            amountCents: 1500,
            rowIndex: 0,
            type: 'expense',
          },
        ],
      });

      const frequencies = await db
        .select()
        .from(schema.categoryFrequency)
        .where(
          and(
            eq(schema.categoryFrequency.userId, TEST_USER_ID),
            eq(schema.categoryFrequency.type, 'expense')
          )
        );

      expect(frequencies).toHaveLength(1);
      expect(frequencies[0].descriptionNormalized).toBe('coffee shop');
      expect(frequencies[0].categoryId).toBe(category.id);
      expect(frequencies[0].count).toBe(1);
    });

    it('increments existing categoryFrequency', async () => {
      const checking = await seedAccount(testAccounts.checking);
      const category = await seedCategory('expense');
      await seedCategory('income');

      // Seed existing frequency
      await db.insert(schema.categoryFrequency).values({
        userId: TEST_USER_ID,
        descriptionNormalized: 'grocery store',
        categoryId: category.id,
        type: 'expense',
        count: 3,
        lastUsedAt: new Date('2025-01-01'),
      });

      // Import same description again
      await importMixed({
        accountId: checking.id,
        rows: [
          {
            date: '2025-01-15',
            description: 'Grocery Store',
            amountCents: 8000,
            rowIndex: 0,
            type: 'expense',
          },
        ],
      });

      const [frequency] = await db
        .select()
        .from(schema.categoryFrequency)
        .where(
          and(
            eq(schema.categoryFrequency.userId, TEST_USER_ID),
            eq(schema.categoryFrequency.descriptionNormalized, 'grocery store')
          )
        );

      expect(frequency.count).toBe(4);
      expect(frequency.lastUsedAt.getTime()).toBeGreaterThan(new Date('2025-01-01').getTime());
    });

    it('handles both expense and income types separately', async () => {
      const checking = await seedAccount(testAccounts.checking);
      const expenseCategory = await seedCategory('expense');
      const incomeCategory = await seedCategory('income');

      await importMixed({
        accountId: checking.id,
        rows: [
          {
            date: '2025-01-10',
            description: 'Paycheck',
            amountCents: 300000,
            rowIndex: 0,
            type: 'income',
          },
          {
            date: '2025-01-11',
            description: 'Grocery',
            amountCents: 15000,
            rowIndex: 1,
            type: 'expense',
          },
        ],
      });

      const expenseFreq = await db
        .select()
        .from(schema.categoryFrequency)
        .where(
          and(
            eq(schema.categoryFrequency.userId, TEST_USER_ID),
            eq(schema.categoryFrequency.type, 'expense')
          )
        );

      const incomeFreq = await db
        .select()
        .from(schema.categoryFrequency)
        .where(
          and(
            eq(schema.categoryFrequency.userId, TEST_USER_ID),
            eq(schema.categoryFrequency.type, 'income')
          )
        );

      expect(expenseFreq).toHaveLength(1);
      expect(expenseFreq[0].descriptionNormalized).toBe('grocery');
      expect(expenseFreq[0].categoryId).toBe(expenseCategory.id);

      expect(incomeFreq).toHaveLength(1);
      expect(incomeFreq[0].descriptionNormalized).toBe('paycheck');
      expect(incomeFreq[0].categoryId).toBe(incomeCategory.id);
    });
  });

  describe('Installment Edge Cases', () => {
    it('imports parcela 3/5 only (creates entries 3,4,5)', async () => {
      const creditCard = await seedAccount(testAccounts.creditCardWithBilling);
      await seedCategory('expense');
      await seedCategory('income');

      const result = await importMixed({
        accountId: creditCard.id,
        rows: [
          {
            date: '2025-01-20',
            description: 'Furniture - Parcela 3/5',
            amountCents: 50000,
            rowIndex: 0,
            type: 'expense',
            installmentInfo: {
              current: 3,
              total: 5,
              baseDescription: 'Furniture',
            },
          },
        ],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.importedExpenses).toBe(1);
      }

      const [transaction] = await db.select().from(schema.transactions);
      expect(transaction.totalInstallments).toBe(5);
      expect(transaction.totalAmount).toBe(250000); // 50000 * 5

      const entries = await db
        .select()
        .from(schema.entries)
        .where(eq(schema.entries.transactionId, transaction.id));

      expect(entries).toHaveLength(3); // Only 3, 4, 5
      expect(entries.map((e) => e.installmentNumber).sort()).toEqual([3, 4, 5]);
    });

    it('imports parcelas out of order (3, then 1, then 2)', async () => {
      const creditCard = await seedAccount(testAccounts.creditCardWithBilling);
      await seedCategory('expense');
      await seedCategory('income');

      // Import parcela 3/3 first
      await importMixed({
        accountId: creditCard.id,
        rows: [
          {
            date: '2025-03-15',
            description: 'Appliance - Parcela 3/3',
            amountCents: 80000,
            rowIndex: 0,
            type: 'expense',
            installmentInfo: {
              current: 3,
              total: 3,
              baseDescription: 'Appliance',
            },
          },
        ],
      });

      const [transaction] = await db.select().from(schema.transactions);
      let entries = await db
        .select()
        .from(schema.entries)
        .where(eq(schema.entries.transactionId, transaction.id));

      expect(entries).toHaveLength(1);
      expect(entries[0].installmentNumber).toBe(3);

      // Import parcela 1/3
      await importMixed({
        accountId: creditCard.id,
        rows: [
          {
            date: '2025-01-15',
            description: 'Appliance - Parcela 1/3',
            amountCents: 80000,
            rowIndex: 0,
            type: 'expense',
            installmentInfo: {
              current: 1,
              total: 3,
              baseDescription: 'Appliance',
            },
          },
        ],
      });

      entries = await db
        .select()
        .from(schema.entries)
        .where(eq(schema.entries.transactionId, transaction.id));

      expect(entries).toHaveLength(2);
      expect(entries.map((e) => e.installmentNumber).sort()).toEqual([1, 3]);

      // Import parcela 2/3
      await importMixed({
        accountId: creditCard.id,
        rows: [
          {
            date: '2025-02-15',
            description: 'Appliance - Parcela 2/3',
            amountCents: 80000,
            rowIndex: 0,
            type: 'expense',
            installmentInfo: {
              current: 2,
              total: 3,
              baseDescription: 'Appliance',
            },
          },
        ],
      });

      entries = await db
        .select()
        .from(schema.entries)
        .where(eq(schema.entries.transactionId, transaction.id));

      expect(entries).toHaveLength(3);
      expect(entries.map((e) => e.installmentNumber).sort()).toEqual([1, 2, 3]);
      expect(entries.every((e) => e.amount === 80000)).toBe(true);
    });
  });
});
