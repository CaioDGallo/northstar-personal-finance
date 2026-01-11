import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID, testAccounts, testCategories } from '@/test/fixtures';
import { and, eq } from 'drizzle-orm';

type ImportActions = typeof import('@/lib/actions/import');
type FaturaActions = typeof import('@/lib/actions/faturas');

type DbClient = ReturnType<typeof getTestDb>;

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
  });
});
