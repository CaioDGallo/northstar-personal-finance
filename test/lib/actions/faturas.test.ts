import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID, testAccounts, testCategories } from '@/test/fixtures';
import { and, eq } from 'drizzle-orm';

type FaturaActions = typeof import('@/lib/actions/faturas');
type ExpenseActions = typeof import('@/lib/actions/expenses');

type DbClient = ReturnType<typeof getTestDb>;

type SeedFaturaOptions = {
  faturaMonth?: string;
  amount?: number;
  dueDate?: string;
  entryPaidAt?: Date | null;
  faturaPaidAt?: Date | null;
  paidFromAccountId?: number | null;
};

const OTHER_USER_ID = 'other-user-id';

describe('Fatura Actions', () => {
  let db: DbClient;

  let ensureFaturaExists: FaturaActions['ensureFaturaExists'];
  let updateFaturaTotal: FaturaActions['updateFaturaTotal'];
  let getFaturasByMonth: FaturaActions['getFaturasByMonth'];
  let getFaturasByAccount: FaturaActions['getFaturasByAccount'];
  let getFaturaWithEntries: FaturaActions['getFaturaWithEntries'];
  let payFatura: FaturaActions['payFatura'];
  let markFaturaUnpaid: FaturaActions['markFaturaUnpaid'];
  let convertExpenseToFaturaPayment: FaturaActions['convertExpenseToFaturaPayment'];

  let createExpense: ExpenseActions['createExpense'];
  let updateExpense: ExpenseActions['updateExpense'];
  let deleteExpense: ExpenseActions['deleteExpense'];

  let getCurrentUserIdMock: ReturnType<typeof vi.fn>;

  const seedAccount = async (values: typeof schema.accounts.$inferInsert) => {
    const [account] = await db.insert(schema.accounts).values(values).returning();
    return account;
  };

  const seedCategory = async () => {
    const [category] = await db.insert(schema.categories).values(testCategories.expense).returning();
    return category;
  };

  const seedFaturaWithEntry = async (options: SeedFaturaOptions = {}) => {
    const account = await seedAccount(testAccounts.creditCardWithBilling);
    const category = await seedCategory();

    const amount = options.amount ?? 10000;
    const faturaMonth = options.faturaMonth ?? '2025-01';
    const dueDate = options.dueDate ?? '2025-02-05';

    const [transaction] = await db
      .insert(schema.transactions)
      .values({
        userId: TEST_USER_ID,
        description: 'Test Transaction',
        totalAmount: amount,
        totalInstallments: 1,
        categoryId: category.id,
      })
      .returning();

    await db.insert(schema.entries).values({
      userId: TEST_USER_ID,
      transactionId: transaction.id,
      accountId: account.id,
      amount,
      purchaseDate: '2025-01-10',
      faturaMonth,
      dueDate,
      installmentNumber: 1,
      paidAt: options.entryPaidAt ?? null,
    });

    const [fatura] = await db
      .insert(schema.faturas)
      .values({
        userId: TEST_USER_ID,
        accountId: account.id,
        yearMonth: faturaMonth,
        totalAmount: amount,
        dueDate,
        paidAt: options.faturaPaidAt ?? null,
        paidFromAccountId: options.paidFromAccountId ?? null,
      })
      .returning();

    return { account, category, transaction, fatura, faturaMonth, amount };
  };

  const seedExpenseFromChecking = async (amount: number, purchaseDate: string = '2025-01-10') => {
    const checking = await seedAccount(testAccounts.checking);
    const category = await seedCategory();

    const [transaction] = await db
      .insert(schema.transactions)
      .values({
        userId: TEST_USER_ID,
        description: 'Test Expense',
        totalAmount: amount,
        totalInstallments: 1,
        categoryId: category.id,
      })
      .returning();

    const [entry] = await db
      .insert(schema.entries)
      .values({
        userId: TEST_USER_ID,
        transactionId: transaction.id,
        accountId: checking.id,
        amount,
        purchaseDate,
        faturaMonth: purchaseDate.slice(0, 7), // Extract YYYY-MM
        dueDate: purchaseDate,
        installmentNumber: 1,
      })
      .returning();

    return { entry, transaction, checking, category, amount };
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

    const faturaActions = await import('@/lib/actions/faturas');
    ensureFaturaExists = faturaActions.ensureFaturaExists;
    updateFaturaTotal = faturaActions.updateFaturaTotal;
    getFaturasByMonth = faturaActions.getFaturasByMonth;
    getFaturasByAccount = faturaActions.getFaturasByAccount;
    getFaturaWithEntries = faturaActions.getFaturaWithEntries;
    payFatura = faturaActions.payFatura;
    markFaturaUnpaid = faturaActions.markFaturaUnpaid;
    convertExpenseToFaturaPayment = faturaActions.convertExpenseToFaturaPayment;

    const expenseActions = await import('@/lib/actions/expenses');
    createExpense = expenseActions.createExpense;
    updateExpense = expenseActions.updateExpense;
    deleteExpense = expenseActions.deleteExpense;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  describe('ensureFaturaExists', () => {
    it('creates a new fatura with correct due date and defaults', async () => {
      const account = await seedAccount(testAccounts.creditCardWithBilling);

      const fatura = await ensureFaturaExists(account.id, '2025-01');

      expect(fatura).toMatchObject({
        accountId: account.id,
        yearMonth: '2025-01',
        totalAmount: 0,
        dueDate: '2025-02-05',
      });
    });

    it('does not create duplicates for same account and month', async () => {
      const account = await seedAccount(testAccounts.creditCardWithBilling);

      const first = await ensureFaturaExists(account.id, '2025-01');
      const second = await ensureFaturaExists(account.id, '2025-01');

      const faturas = await db
        .select()
        .from(schema.faturas)
        .where(and(eq(schema.faturas.userId, TEST_USER_ID), eq(schema.faturas.accountId, account.id)));

      expect(faturas).toHaveLength(1);
      expect(first.id).toBe(second.id);
    });

    it('uses fallback billing config when account has no billing days', async () => {
      const account = await seedAccount(testAccounts.creditCard);

      const fatura = await ensureFaturaExists(account.id, '2025-01');

      expect(fatura.dueDate).toBe('2025-02-01');
    });

    it('throws when account does not exist', async () => {
      await expect(ensureFaturaExists(999, '2025-01')).rejects.toThrow('Account not found');
    });
  });

  describe('updateFaturaTotal', () => {
    it('sums entries for the account and month', async () => {
      const account = await seedAccount(testAccounts.creditCardWithBilling);
      const category = await seedCategory();

      const [transaction] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Test Transaction',
          totalAmount: 3000,
          totalInstallments: 2,
          categoryId: category.id,
        })
        .returning();

      await db.insert(schema.faturas).values({
        userId: TEST_USER_ID,
        accountId: account.id,
        yearMonth: '2025-01',
        totalAmount: 0,
        dueDate: '2025-02-05',
      });

      await db.insert(schema.entries).values([
        {
          userId: TEST_USER_ID,
          transactionId: transaction.id,
          accountId: account.id,
          amount: 1000,
          purchaseDate: '2025-01-10',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
          installmentNumber: 1,
          paidAt: null,
        },
        {
          userId: TEST_USER_ID,
          transactionId: transaction.id,
          accountId: account.id,
          amount: 2000,
          purchaseDate: '2025-01-12',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
          installmentNumber: 2,
          paidAt: null,
        },
        {
          userId: OTHER_USER_ID,
          transactionId: transaction.id,
          accountId: account.id,
          amount: 9999,
          purchaseDate: '2025-01-12',
          faturaMonth: '2025-01',
          dueDate: '2025-02-05',
          installmentNumber: 1,
          paidAt: null,
        },
      ]);

      await updateFaturaTotal(account.id, '2025-01');

      const [fatura] = await db
        .select()
        .from(schema.faturas)
        .where(and(eq(schema.faturas.userId, TEST_USER_ID), eq(schema.faturas.accountId, account.id)));

      expect(fatura.totalAmount).toBe(3000);
    });

    it('sets total to 0 when there are no entries', async () => {
      const account = await seedAccount(testAccounts.creditCardWithBilling);

      await db.insert(schema.faturas).values({
        userId: TEST_USER_ID,
        accountId: account.id,
        yearMonth: '2025-02',
        totalAmount: 5000,
        dueDate: '2025-03-05',
      });

      await updateFaturaTotal(account.id, '2025-02');

      const [fatura] = await db
        .select()
        .from(schema.faturas)
        .where(and(eq(schema.faturas.userId, TEST_USER_ID), eq(schema.faturas.accountId, account.id)));

      expect(fatura.totalAmount).toBe(0);
    });
  });

  describe('getFaturasByMonth', () => {
    it('returns faturas for the month ordered by account name', async () => {
      const accountA = await seedAccount({
        userId: TEST_USER_ID,
        name: 'Alpha Card',
        type: 'credit_card',
        closingDay: 10,
        paymentDueDay: 20,
      });
      const accountB = await seedAccount({
        userId: TEST_USER_ID,
        name: 'Beta Card',
        type: 'credit_card',
        closingDay: 8,
        paymentDueDay: 12,
      });
      const otherAccount = await seedAccount({
        userId: OTHER_USER_ID,
        name: 'Other Card',
        type: 'credit_card',
        closingDay: 5,
        paymentDueDay: 10,
      });

      await db.insert(schema.faturas).values([
        {
          userId: TEST_USER_ID,
          accountId: accountB.id,
          yearMonth: '2025-01',
          totalAmount: 5000,
          dueDate: '2025-01-12',
        },
        {
          userId: TEST_USER_ID,
          accountId: accountA.id,
          yearMonth: '2025-01',
          totalAmount: 10000,
          dueDate: '2025-02-20',
        },
        {
          userId: OTHER_USER_ID,
          accountId: otherAccount.id,
          yearMonth: '2025-01',
          totalAmount: 20000,
          dueDate: '2025-02-20',
        },
      ]);

      const faturas = await getFaturasByMonth('2025-01');

      expect(faturas).toHaveLength(2);
      expect(faturas.map((fatura) => fatura.accountName)).toEqual(['Alpha Card', 'Beta Card']);
    });
  });

  describe('getFaturasByAccount', () => {
    it('returns faturas for the account ordered by month descending', async () => {
      const account = await seedAccount(testAccounts.creditCardWithBilling);

      await db.insert(schema.faturas).values([
        {
          userId: TEST_USER_ID,
          accountId: account.id,
          yearMonth: '2025-01',
          totalAmount: 5000,
          dueDate: '2025-02-05',
        },
        {
          userId: TEST_USER_ID,
          accountId: account.id,
          yearMonth: '2025-03',
          totalAmount: 15000,
          dueDate: '2025-04-05',
        },
      ]);

      const faturas = await getFaturasByAccount(account.id);

      expect(faturas.map((fatura) => fatura.yearMonth)).toEqual(['2025-03', '2025-01']);
    });
  });

  describe('getFaturaWithEntries', () => {
    it('returns fatura with joined entries and category details', async () => {
      const account = await seedAccount(testAccounts.creditCardWithBilling);
      const category = await seedCategory();

      const [transaction] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Streaming Service',
          totalAmount: 3000,
          totalInstallments: 1,
          categoryId: category.id,
        })
        .returning();

      await db.insert(schema.entries).values({
        userId: TEST_USER_ID,
        transactionId: transaction.id,
        accountId: account.id,
        amount: 3000,
        purchaseDate: '2025-01-14',
        faturaMonth: '2025-01',
        dueDate: '2025-02-05',
        installmentNumber: 1,
        paidAt: null,
      });

      const [fatura] = await db
        .insert(schema.faturas)
        .values({
          userId: TEST_USER_ID,
          accountId: account.id,
          yearMonth: '2025-01',
          totalAmount: 3000,
          dueDate: '2025-02-05',
        })
        .returning();

      const result = await getFaturaWithEntries(fatura.id);

      expect(result).not.toBeNull();
      expect(result?.entries).toHaveLength(1);
      expect(result?.entries[0]).toMatchObject({
        description: 'Streaming Service',
        amount: 3000,
        categoryName: category.name,
        categoryColor: category.color,
        categoryIcon: category.icon,
        installmentNumber: 1,
        totalInstallments: 1,
      });
    });

    it('returns null when fatura does not exist', async () => {
      const result = await getFaturaWithEntries(9999);
      expect(result).toBeNull();
    });
  });

  describe('payFatura', () => {
    it('validates ids before paying', async () => {
      await expect(payFatura(0, 1)).rejects.toThrow('Invalid bill ID');
      await expect(payFatura(1, 0)).rejects.toThrow('Invalid account ID');
    });

    it('throws when fatura is missing or already paid', async () => {
      await expect(payFatura(999, 1)).rejects.toThrow('Bill not found');

      const { fatura } = await seedFaturaWithEntry({
        faturaPaidAt: new Date('2025-01-20T00:00:00Z'),
      });

      await expect(payFatura(fatura.id, 1)).rejects.toThrow('Bill already paid');
    });

    it('prevents paying from credit card accounts', async () => {
      const { account, fatura } = await seedFaturaWithEntry();

      await expect(payFatura(fatura.id, account.id)).rejects.toThrow(
        'Cannot pay bill from a credit card account'
      );
    });

    it('marks fatura and entries as paid', async () => {
      const { account, fatura } = await seedFaturaWithEntry();
      const checking = await seedAccount(testAccounts.checking);

      await payFatura(fatura.id, checking.id);

      const [updatedFatura] = await db
        .select()
        .from(schema.faturas)
        .where(and(eq(schema.faturas.userId, TEST_USER_ID), eq(schema.faturas.id, fatura.id)));

      expect(updatedFatura.paidAt).not.toBeNull();
      expect(updatedFatura.paidFromAccountId).toBe(checking.id);

      const updatedEntries = await db
        .select()
        .from(schema.entries)
        .where(and(eq(schema.entries.userId, TEST_USER_ID), eq(schema.entries.accountId, account.id)));

      expect(updatedEntries).toHaveLength(1);
      expect(updatedEntries[0].paidAt).not.toBeNull();
    });

    it('creates a transfer and updates account balances', async () => {
      const { account, fatura, amount } = await seedFaturaWithEntry();
      const checking = await seedAccount(testAccounts.checking);

      await payFatura(fatura.id, checking.id);

      const [transfer] = await db
        .select()
        .from(schema.transfers)
        .where(and(eq(schema.transfers.userId, TEST_USER_ID), eq(schema.transfers.faturaId, fatura.id)));

      expect(transfer).toMatchObject({
        fromAccountId: checking.id,
        toAccountId: account.id,
        amount,
        type: 'fatura_payment',
      });

      const [updatedChecking] = await db
        .select()
        .from(schema.accounts)
        .where(and(eq(schema.accounts.userId, TEST_USER_ID), eq(schema.accounts.id, checking.id)));

      const [updatedCard] = await db
        .select()
        .from(schema.accounts)
        .where(and(eq(schema.accounts.userId, TEST_USER_ID), eq(schema.accounts.id, account.id)));

      expect(updatedChecking.currentBalance).toBe(-amount);
      expect(updatedCard.currentBalance).toBe(0);
    });
  });

  describe('markFaturaUnpaid', () => {
    it('validates ids before marking unpaid', async () => {
      await expect(markFaturaUnpaid(0)).rejects.toThrow('Invalid bill ID');
    });

    it('throws when fatura is missing', async () => {
      await expect(markFaturaUnpaid(999)).rejects.toThrow('Bill not found');
    });

    it('clears paid state for fatura and entries', async () => {
      const checking = await seedAccount(testAccounts.checking);
      const paidAt = new Date('2025-01-20T00:00:00Z');
      const { account, fatura } = await seedFaturaWithEntry({
        entryPaidAt: paidAt,
        faturaPaidAt: paidAt,
        paidFromAccountId: checking.id,
      });

      await markFaturaUnpaid(fatura.id);

      const [updatedFatura] = await db
        .select()
        .from(schema.faturas)
        .where(and(eq(schema.faturas.userId, TEST_USER_ID), eq(schema.faturas.id, fatura.id)));

      expect(updatedFatura.paidAt).toBeNull();
      expect(updatedFatura.paidFromAccountId).toBeNull();

      const [entry] = await db
        .select()
        .from(schema.entries)
        .where(and(eq(schema.entries.userId, TEST_USER_ID), eq(schema.entries.accountId, account.id)));

      expect(entry.paidAt).toBeNull();
    });
  });

  describe('expense integration with faturas', () => {
    it('creates faturas and totals for credit card expenses', async () => {
      const account = await seedAccount(testAccounts.creditCardWithBilling);
      const category = await seedCategory();

      await createExpense({
        description: 'Groceries',
        totalAmount: 10000,
        categoryId: category.id,
        accountId: account.id,
        purchaseDate: '2025-01-10',
        installments: 1,
      });

      await createExpense({
        description: 'Flights',
        totalAmount: 20000,
        categoryId: category.id,
        accountId: account.id,
        purchaseDate: '2025-01-20',
        installments: 1,
      });

      const faturas = await db
        .select()
        .from(schema.faturas)
        .where(and(eq(schema.faturas.userId, TEST_USER_ID), eq(schema.faturas.accountId, account.id)))
        .orderBy(schema.faturas.yearMonth);

      expect(faturas.map((fatura) => fatura.yearMonth)).toEqual(['2025-01', '2025-02']);
      expect(faturas.map((fatura) => fatura.totalAmount)).toEqual([10000, 20000]);
    });

    it('updates fatura totals when expense moves months', async () => {
      const account = await seedAccount(testAccounts.creditCardWithBilling);
      const category = await seedCategory();

      await createExpense({
        description: 'Laptop',
        totalAmount: 15000,
        categoryId: category.id,
        accountId: account.id,
        purchaseDate: '2025-01-10',
        installments: 1,
      });

      const [transaction] = await db.select().from(schema.transactions);

      await updateExpense(transaction.id, {
        description: 'Laptop',
        totalAmount: 15000,
        categoryId: category.id,
        accountId: account.id,
        purchaseDate: '2025-01-20',
        installments: 1,
      });

      const faturas = await db
        .select()
        .from(schema.faturas)
        .where(and(eq(schema.faturas.userId, TEST_USER_ID), eq(schema.faturas.accountId, account.id)))
        .orderBy(schema.faturas.yearMonth);

      const totalsByMonth = new Map(faturas.map((fatura) => [fatura.yearMonth, fatura.totalAmount]));

      expect(totalsByMonth.get('2025-01')).toBe(0);
      expect(totalsByMonth.get('2025-02')).toBe(15000);
    });

    it('updates fatura totals when expense is deleted', async () => {
      const account = await seedAccount(testAccounts.creditCardWithBilling);
      const category = await seedCategory();

      await createExpense({
        description: 'Subscription',
        totalAmount: 8000,
        categoryId: category.id,
        accountId: account.id,
        purchaseDate: '2025-01-10',
        installments: 1,
      });

      const [transaction] = await db.select().from(schema.transactions);

      await deleteExpense(transaction.id);

      const [fatura] = await db
        .select()
        .from(schema.faturas)
        .where(and(eq(schema.faturas.userId, TEST_USER_ID), eq(schema.faturas.accountId, account.id)));

      expect(fatura.totalAmount).toBe(0);
    });
  });

  describe('convertExpenseToFaturaPayment', () => {
    it('validates entryId', async () => {
      await expect(convertExpenseToFaturaPayment(0, 1)).rejects.toThrow('Invalid transaction ID');
      await expect(convertExpenseToFaturaPayment(-1, 1)).rejects.toThrow('Invalid transaction ID');
    });

    it('validates faturaId', async () => {
      await expect(convertExpenseToFaturaPayment(1, 0)).rejects.toThrow('Invalid bill ID');
      await expect(convertExpenseToFaturaPayment(1, -1)).rejects.toThrow('Invalid bill ID');
    });

    it('throws when entry not found', async () => {
      const { fatura } = await seedFaturaWithEntry();
      await expect(convertExpenseToFaturaPayment(999, fatura.id)).rejects.toThrow('Invalid transaction ID');
    });

    it('throws when fatura not found', async () => {
      const { entry } = await seedExpenseFromChecking(10000);
      await expect(convertExpenseToFaturaPayment(entry.id, 999)).rejects.toThrow('Bill not found');
    });

    it('prevents conversion from credit card accounts', async () => {
      const { fatura, amount } = await seedFaturaWithEntry({ amount: 10000 });
      const creditCard = await seedAccount(testAccounts.creditCardWithBilling);
      const category = await seedCategory();

      const [transaction] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'CC Expense',
          totalAmount: amount,
          totalInstallments: 1,
          categoryId: category.id,
        })
        .returning();

      const [entry] = await db
        .insert(schema.entries)
        .values({
          userId: TEST_USER_ID,
          transactionId: transaction.id,
          accountId: creditCard.id,
          amount,
          purchaseDate: '2025-01-10',
          faturaMonth: '2025-01',
          dueDate: '2025-01-10',
          installmentNumber: 1,
        })
        .returning();

      await expect(convertExpenseToFaturaPayment(entry.id, fatura.id)).rejects.toThrow(
        'This expense cannot be converted to a fatura payment'
      );
    });

    it('prevents conversion for installment transactions', async () => {
      const { fatura, amount } = await seedFaturaWithEntry({ amount: 10000 });
      const checking = await seedAccount(testAccounts.checking);
      const category = await seedCategory();

      const [transaction] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Installment Expense',
          totalAmount: amount,
          totalInstallments: 3, // Multiple installments
          categoryId: category.id,
        })
        .returning();

      const [entry] = await db
        .insert(schema.entries)
        .values({
          userId: TEST_USER_ID,
          transactionId: transaction.id,
          accountId: checking.id,
          amount: Math.floor(amount / 3),
          purchaseDate: '2025-01-10',
          faturaMonth: '2025-01',
          dueDate: '2025-01-10',
          installmentNumber: 1,
        })
        .returning();

      await expect(convertExpenseToFaturaPayment(entry.id, fatura.id)).rejects.toThrow(
        'This expense cannot be converted to a fatura payment'
      );
    });

    it('prevents conversion for already paid fatura', async () => {
      const checking = await seedAccount(testAccounts.checking);
      const { fatura, amount } = await seedFaturaWithEntry({
        amount: 10000,
        faturaPaidAt: new Date('2025-01-20T00:00:00Z'),
        paidFromAccountId: checking.id,
      });
      const { entry } = await seedExpenseFromChecking(amount);

      await expect(convertExpenseToFaturaPayment(entry.id, fatura.id)).rejects.toThrow('Bill already paid');
    });

    it('prevents conversion when amounts do not match', async () => {
      const { fatura } = await seedFaturaWithEntry({ amount: 10000 });
      const { entry } = await seedExpenseFromChecking(5000); // Different amount

      await expect(convertExpenseToFaturaPayment(entry.id, fatura.id)).rejects.toThrow(
        'Expense amount must match fatura total'
      );
    });

    it('marks fatura and entries as paid', async () => {
      const { account, fatura, amount } = await seedFaturaWithEntry({ amount: 10000 });
      const { entry, checking } = await seedExpenseFromChecking(amount);

      await convertExpenseToFaturaPayment(entry.id, fatura.id);

      // Verify fatura is paid
      const [updatedFatura] = await db
        .select()
        .from(schema.faturas)
        .where(and(eq(schema.faturas.userId, TEST_USER_ID), eq(schema.faturas.id, fatura.id)));

      expect(updatedFatura.paidAt).not.toBeNull();
      expect(updatedFatura.paidFromAccountId).toBe(checking.id);

      // KEY: Verify entries are paid
      const updatedEntries = await db
        .select()
        .from(schema.entries)
        .where(
          and(
            eq(schema.entries.userId, TEST_USER_ID),
            eq(schema.entries.accountId, account.id),
            eq(schema.entries.faturaMonth, fatura.yearMonth)
          )
        );

      expect(updatedEntries).toHaveLength(1);
      expect(updatedEntries.every((e) => e.paidAt !== null)).toBe(true);
    });

    it('creates fatura_payment transfer', async () => {
      const { fatura, amount } = await seedFaturaWithEntry({ amount: 10000 });
      const { entry, checking } = await seedExpenseFromChecking(amount);

      await convertExpenseToFaturaPayment(entry.id, fatura.id);

      const [transfer] = await db
        .select()
        .from(schema.transfers)
        .where(and(eq(schema.transfers.userId, TEST_USER_ID), eq(schema.transfers.faturaId, fatura.id)));

      expect(transfer).toMatchObject({
        fromAccountId: checking.id,
        toAccountId: fatura.accountId,
        amount,
        type: 'fatura_payment',
      });
    });

    it('deletes original expense', async () => {
      const { fatura, amount } = await seedFaturaWithEntry({ amount: 10000 });
      const { entry, transaction } = await seedExpenseFromChecking(amount);

      await convertExpenseToFaturaPayment(entry.id, fatura.id);

      // Verify transaction deleted
      const deletedTransaction = await db
        .select()
        .from(schema.transactions)
        .where(and(eq(schema.transactions.userId, TEST_USER_ID), eq(schema.transactions.id, transaction.id)));

      expect(deletedTransaction).toHaveLength(0);

      // Verify source entry deleted (cascade)
      const deletedEntry = await db
        .select()
        .from(schema.entries)
        .where(and(eq(schema.entries.userId, TEST_USER_ID), eq(schema.entries.id, entry.id)));

      expect(deletedEntry).toHaveLength(0);
    });

    it('updates account balances', async () => {
      const { account, fatura, amount } = await seedFaturaWithEntry({ amount: 10000 });
      const { entry, checking } = await seedExpenseFromChecking(amount);

      await convertExpenseToFaturaPayment(entry.id, fatura.id);

      const [updatedChecking] = await db
        .select()
        .from(schema.accounts)
        .where(and(eq(schema.accounts.userId, TEST_USER_ID), eq(schema.accounts.id, checking.id)));

      const [updatedCard] = await db
        .select()
        .from(schema.accounts)
        .where(and(eq(schema.accounts.userId, TEST_USER_ID), eq(schema.accounts.id, account.id)));

      // Checking balance should be negative (money out)
      expect(updatedChecking.currentBalance).toBe(-amount);
      // Credit card balance should be 0 (paid off)
      expect(updatedCard.currentBalance).toBe(0);
    });

    it('preserves externalId in transfer for duplicate detection on reimport', async () => {
      const { fatura, amount } = await seedFaturaWithEntry({ amount: 10000 });
      const checking = await seedAccount(testAccounts.checking);
      const category = await seedCategory();
      const externalId = 'bank-uuid-12345';

      // Create transaction with externalId (simulating an import)
      const [transaction] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Imported Expense',
          totalAmount: amount,
          totalInstallments: 1,
          categoryId: category.id,
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

      await convertExpenseToFaturaPayment(entry.id, fatura.id);

      // Verify transaction is deleted
      const deletedTransaction = await db
        .select()
        .from(schema.transactions)
        .where(and(eq(schema.transactions.userId, TEST_USER_ID), eq(schema.transactions.id, transaction.id)));

      expect(deletedTransaction).toHaveLength(0);

      // Verify externalId is preserved in the transfer
      const [transfer] = await db
        .select()
        .from(schema.transfers)
        .where(and(eq(schema.transfers.userId, TEST_USER_ID), eq(schema.transfers.faturaId, fatura.id)));

      expect(transfer).toMatchObject({
        fromAccountId: checking.id,
        toAccountId: fatura.accountId,
        amount,
        type: 'fatura_payment',
        externalId,
      });
    });
  });
});
