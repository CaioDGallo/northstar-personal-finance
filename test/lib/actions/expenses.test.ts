import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import { mockAuth } from '@/test/auth-utils';
import * as schema from '@/lib/schema';
import { testAccounts, testCategories, TEST_USER_ID } from '@/test/fixtures';

type ExpenseActions = typeof import('@/lib/actions/expenses');

describe('Expense Actions - Happy Path', () => {
  let db: ReturnType<typeof getTestDb>;
  let accountId: number;
  let categoryId: number;

  // Dynamic imports after mocking
  let createExpense: ExpenseActions['createExpense'];
  let updateExpense: ExpenseActions['updateExpense'];
  let deleteExpense: ExpenseActions['deleteExpense'];
  let getExpenses: ExpenseActions['getExpenses'];
  let markEntryPaid: ExpenseActions['markEntryPaid'];
  let markEntryPending: ExpenseActions['markEntryPending'];
  let updateTransactionCategory: ExpenseActions['updateTransactionCategory'];

  beforeAll(async () => {
    db = await setupTestDb();

    // Mock the db module to use test database
    vi.doMock('@/lib/db', () => ({
      db,
    }));

    // Mock auth to prevent Next.js cookies() calls
    mockAuth();

    // Import actions after mocking
    const actions = await import('@/lib/actions/expenses');
    createExpense = actions.createExpense;
    updateExpense = actions.updateExpense;
    deleteExpense = actions.deleteExpense;
    getExpenses = actions.getExpenses;
    markEntryPaid = actions.markEntryPaid;
    markEntryPending = actions.markEntryPending;
    updateTransactionCategory = actions.updateTransactionCategory;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();

    // Seed test data
    const [account] = await db
      .insert(schema.accounts)
      .values(testAccounts.creditCard)
      .returning();

    const [category] = await db
      .insert(schema.categories)
      .values(testCategories.expense)
      .returning();

    accountId = account.id;
    categoryId = category.id;
  });

  describe('createExpense', () => {
    it('creates a single installment expense', async () => {
      await createExpense({
        description: 'Groceries',
        totalAmount: 10000, // R$ 100
        categoryId,
        accountId,
        purchaseDate: '2025-01-15',
        installments: 1,
      });

      const expenses = await getExpenses();

      expect(expenses).toHaveLength(1);
      expect(expenses[0]).toMatchObject({
        description: 'Groceries',
        amount: 10000,
        dueDate: '2025-01-15',
        installmentNumber: 1,
        totalInstallments: 1,
      });
      expect(expenses[0].paidAt).toBeNull();
    });

    it('creates multiple installment expense with correct amounts', async () => {
      await createExpense({
        description: 'Laptop',
        totalAmount: 300000, // R$ 3000
        categoryId,
        accountId,
        purchaseDate: '2025-01-15',
        installments: 3,
      });

      const expenses = await getExpenses();

      expect(expenses).toHaveLength(3);

      // Each installment should be R$ 1000 (100000 cents)
      expect(expenses[2].amount).toBe(100000);
      expect(expenses[1].amount).toBe(100000);
      expect(expenses[0].amount).toBe(100000);

      // Verify sum equals total
      const sum = expenses.reduce((acc, e) => acc + e.amount, 0);
      expect(sum).toBe(300000);
    });

    it('generates installments with incrementing months', async () => {
      await createExpense({
        description: 'Test',
        totalAmount: 30000,
        categoryId,
        accountId,
        purchaseDate: '2025-01-15',
        installments: 3,
      });

      const expenses = await getExpenses();

      // Ordered by dueDate desc, so newest first
      expect(expenses[2].dueDate).toBe('2025-01-15');
      expect(expenses[1].dueDate).toBe('2025-02-15');
      expect(expenses[0].dueDate).toBe('2025-03-15');
    });

    it('handles non-divisible amounts with rounding', async () => {
      // R$ 100 / 3 = 33.33... cents per installment
      await createExpense({
        description: 'Test',
        totalAmount: 10000,
        categoryId,
        accountId,
        purchaseDate: '2025-01-15',
        installments: 3,
      });

      const expenses = await getExpenses();

      // First two installments get 3333, last gets 3334 (absorbs remainder)
      expect(expenses[2].amount).toBe(3333);
      expect(expenses[1].amount).toBe(3333);
      expect(expenses[0].amount).toBe(3334);

      // Sum must equal total
      const sum = expenses.reduce((acc, e) => acc + e.amount, 0);
      expect(sum).toBe(10000);
    });
  });

  describe('getExpenses', () => {
    beforeEach(async () => {
      // Create test data for filtering
      await createExpense({
        description: 'January Expense',
        totalAmount: 10000,
        categoryId,
        accountId,
        purchaseDate: '2025-01-15',
        installments: 1,
      });

      await createExpense({
        description: 'February Expense',
        totalAmount: 20000,
        categoryId,
        accountId,
        purchaseDate: '2025-02-15',
        installments: 1,
      });
    });

    it('returns all expenses without filters', async () => {
      const expenses = await getExpenses();
      expect(expenses).toHaveLength(2);
    });

    it('filters by yearMonth', async () => {
      const janExpenses = await getExpenses({ yearMonth: '2025-01' });
      expect(janExpenses).toHaveLength(1);
      expect(janExpenses[0].description).toBe('January Expense');

      const febExpenses = await getExpenses({ yearMonth: '2025-02' });
      expect(febExpenses).toHaveLength(1);
      expect(febExpenses[0].description).toBe('February Expense');
    });

    it('filters by status: pending', async () => {
      const expenses = await getExpenses();
      await markEntryPaid(expenses[0].id);

      const pending = await getExpenses({ status: 'pending' });
      expect(pending).toHaveLength(1);
      expect(pending[0].paidAt).toBeNull();
    });

    it('filters by status: paid', async () => {
      const expenses = await getExpenses();
      await markEntryPaid(expenses[0].id);

      const paid = await getExpenses({ status: 'paid' });
      expect(paid).toHaveLength(1);
      expect(paid[0].paidAt).not.toBeNull();
    });

    it('filters by categoryId', async () => {
      const [newCategory] = await db
        .insert(schema.categories)
        .values({ userId: TEST_USER_ID, name: 'Entertainment', color: '#3b82f6', type: 'expense' })
        .returning();

      await createExpense({
        description: 'Movie',
        totalAmount: 5000,
        categoryId: newCategory.id,
        accountId,
        purchaseDate: '2025-01-20',
        installments: 1,
      });

      const filtered = await getExpenses({ categoryId: newCategory.id });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].categoryId).toBe(newCategory.id);
      expect(filtered[0].categoryName).toBe('Entertainment');
    });

    it('filters by accountId', async () => {
      const [newAccount] = await db
        .insert(schema.accounts)
        .values({ userId: TEST_USER_ID, name: 'Savings Account', type: 'savings' })
        .returning();

      await createExpense({
        description: 'Savings Expense',
        totalAmount: 5000,
        categoryId,
        accountId: newAccount.id,
        purchaseDate: '2025-01-20',
        installments: 1,
      });

      const filtered = await getExpenses({ accountId: newAccount.id });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].accountId).toBe(newAccount.id);
      expect(filtered[0].accountName).toBe('Savings Account');
    });
  });

  describe('updateExpense', () => {
    it('updates expense description and amount', async () => {
      await createExpense({
        description: 'Original',
        totalAmount: 10000,
        categoryId,
        accountId,
        purchaseDate: '2025-01-15',
        installments: 1,
      });

      const initial = await getExpenses();
      const transactionId = initial[0].transactionId;

      await updateExpense(transactionId, {
        description: 'Updated Description',
        totalAmount: 20000,
        categoryId,
        accountId,
        purchaseDate: '2025-01-15',
        installments: 1,
      });

      const updated = await getExpenses();
      expect(updated).toHaveLength(1);
      expect(updated[0].description).toBe('Updated Description');
      expect(updated[0].amount).toBe(20000);
    });

    it('updates installment count and regenerates entries', async () => {
      await createExpense({
        description: 'Test',
        totalAmount: 12000,
        categoryId,
        accountId,
        purchaseDate: '2025-01-15',
        installments: 2,
      });

      const initial = await getExpenses();
      expect(initial).toHaveLength(2);
      const transactionId = initial[0].transactionId;

      // Change from 2 to 4 installments
      await updateExpense(transactionId, {
        description: 'Test',
        totalAmount: 12000,
        categoryId,
        accountId,
        purchaseDate: '2025-01-15',
        installments: 4,
      });

      const updated = await getExpenses();
      expect(updated).toHaveLength(4);

      // Each should be R$ 30 (3000 cents)
      updated.forEach((entry) => {
        expect(entry.amount).toBe(3000);
      });
    });
  });

  describe('deleteExpense', () => {
    it('deletes transaction and all entries', async () => {
      await createExpense({
        description: 'To Delete',
        totalAmount: 30000,
        categoryId,
        accountId,
        purchaseDate: '2025-01-15',
        installments: 3,
      });

      const initial = await getExpenses();
      expect(initial).toHaveLength(3);

      await deleteExpense(initial[0].transactionId);

      const after = await getExpenses();
      expect(after).toHaveLength(0);
    });
  });

  describe('markEntryPaid / markEntryPending', () => {
    it('marks entry as paid', async () => {
      await createExpense({
        description: 'Test',
        totalAmount: 10000,
        categoryId,
        accountId,
        purchaseDate: '2025-01-15',
        installments: 1,
      });

      const expenses = await getExpenses();
      const entryId = expenses[0].id;

      await markEntryPaid(entryId);

      const updated = await getExpenses();
      expect(updated[0].paidAt).not.toBeNull();
    });

    it('marks entry as pending', async () => {
      await createExpense({
        description: 'Test',
        totalAmount: 10000,
        categoryId,
        accountId,
        purchaseDate: '2025-01-15',
        installments: 1,
      });

      const expenses = await getExpenses();
      await markEntryPaid(expenses[0].id);
      await markEntryPending(expenses[0].id);

      const updated = await getExpenses();
      expect(updated[0].paidAt).toBeNull();
    });

    it('only affects single entry, not all installments', async () => {
      await createExpense({
        description: 'Test',
        totalAmount: 30000,
        categoryId,
        accountId,
        purchaseDate: '2025-01-15',
        installments: 3,
      });

      const expenses = await getExpenses();
      await markEntryPaid(expenses[1].id); // Mark middle installment as paid

      const updated = await getExpenses();
      expect(updated[2].paidAt).toBeNull(); // First still pending
      expect(updated[1].paidAt).not.toBeNull(); // Middle is paid
      expect(updated[0].paidAt).toBeNull(); // Last still pending
    });
  });

  describe('updateTransactionCategory', () => {
    it('updates category for transaction', async () => {
      await createExpense({
        description: 'Test',
        totalAmount: 10000,
        categoryId,
        accountId,
        purchaseDate: '2025-01-15',
        installments: 1,
      });

      const [newCategory] = await db
        .insert(schema.categories)
        .values({ userId: TEST_USER_ID, name: 'New Category', color: '#10b981', type: 'expense' })
        .returning();

      const initial = await getExpenses();
      await updateTransactionCategory(initial[0].transactionId, newCategory.id);

      const updated = await getExpenses();
      expect(updated[0].categoryId).toBe(newCategory.id);
      expect(updated[0].categoryName).toBe('New Category');
    });
  });

  describe('Fatura Integration', () => {
    let ccAccountId: number;

    beforeEach(async () => {
      await clearAllTables();

      // Create CC with billing config
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.creditCardWithBilling)
        .returning();

      const [category] = await db
        .insert(schema.categories)
        .values(testCategories.expense)
        .returning();

      ccAccountId = account.id;
      categoryId = category.id;
    });

    describe('faturaMonth computation', () => {
    it('purchase before closing day belongs to current month fatura', async () => {
      // closingDay=15, purchase on Jan 10
      await createExpense({
        description: 'Before Closing',
        totalAmount: 10000,
        categoryId,
        accountId: ccAccountId,
        purchaseDate: '2025-01-10',
        installments: 1,
      });

      const expenses = await getExpenses();
      expect(expenses[0].faturaMonth).toBe('2025-01');
    });

    it('purchase on closing day belongs to current month fatura', async () => {
      // closingDay=15, purchase on Jan 15
      await createExpense({
        description: 'On Closing Day',
        totalAmount: 10000,
        categoryId,
        accountId: ccAccountId,
        purchaseDate: '2025-01-15',
        installments: 1,
      });

      const expenses = await getExpenses();
      expect(expenses[0].faturaMonth).toBe('2025-01');
    });

    it('purchase after closing day belongs to next month fatura', async () => {
      // closingDay=15, purchase on Jan 20
      await createExpense({
        description: 'After Closing',
        totalAmount: 10000,
        categoryId,
        accountId: ccAccountId,
        purchaseDate: '2025-01-20',
        installments: 1,
      });

      const expenses = await getExpenses();
      expect(expenses[0].faturaMonth).toBe('2025-02');
    });
  });

  describe('dueDate computation', () => {
    it('computes dueDate as month after fatura + paymentDueDay', async () => {
      // faturaMonth='2025-01', paymentDueDay=5 → dueDate='2025-02-05'
      await createExpense({
        description: 'Test',
        totalAmount: 10000,
        categoryId,
        accountId: ccAccountId,
        purchaseDate: '2025-01-10', // faturaMonth='2025-01'
        installments: 1,
      });

      const expenses = await getExpenses();
      expect(expenses[0].dueDate).toBe('2025-02-05');
    });
  });

  describe('installments span multiple faturas', () => {
    it('creates entries with correct faturaMonth and dueDate for each installment', async () => {
      // Purchase on Jan 10, 3 installments
      // With new behavior:
      // - Installment 1: purchaseDate = actual (Jan 10), faturaMonth = Jan
      // - Installment 2: purchaseDate = fatura window start (Jan 16), faturaMonth = Feb
      // - Installment 3: purchaseDate = fatura window start (Feb 16), faturaMonth = Mar
      await createExpense({
        description: 'Multi-installment',
        totalAmount: 30000,
        categoryId,
        accountId: ccAccountId,
        purchaseDate: '2025-01-10',
        installments: 3,
      });

      const expenses = await getExpenses();
      expect(expenses).toHaveLength(3);

      // Ordered desc by dueDate, so newest first
      // Entry 3 (Mar): purchaseDate=2025-02-16 (fatura window start), faturaMonth=2025-03, dueDate=2025-04-05
      expect(expenses[0].installmentNumber).toBe(3);
      expect(expenses[0].purchaseDate).toBe('2025-02-16');
      expect(expenses[0].faturaMonth).toBe('2025-03');
      expect(expenses[0].dueDate).toBe('2025-04-05');

      // Entry 2 (Feb): purchaseDate=2025-01-16 (fatura window start), faturaMonth=2025-02, dueDate=2025-03-05
      expect(expenses[1].installmentNumber).toBe(2);
      expect(expenses[1].purchaseDate).toBe('2025-01-16');
      expect(expenses[1].faturaMonth).toBe('2025-02');
      expect(expenses[1].dueDate).toBe('2025-03-05');

      // Entry 1 (Jan): purchaseDate=2025-01-10 (actual purchase), faturaMonth=2025-01, dueDate=2025-02-05
      expect(expenses[2].installmentNumber).toBe(1);
      expect(expenses[2].purchaseDate).toBe('2025-01-10');
      expect(expenses[2].faturaMonth).toBe('2025-01');
      expect(expenses[2].dueDate).toBe('2025-02-05');
    });
  });

  describe('getExpenses filters by purchaseDate (budget month)', () => {
    it('filters by purchaseDate month, not dueDate or faturaMonth', async () => {
      // Purchase on Jan 20 (after closing)
      // → purchaseDate='2025-01-20'
      // → faturaMonth='2025-02' (next month)
      // → dueDate='2025-03-05' (month after fatura)
      await createExpense({
        description: 'Late January Purchase',
        totalAmount: 10000,
        categoryId,
        accountId: ccAccountId,
        purchaseDate: '2025-01-20',
        installments: 1,
      });

      // Should appear in January budget (purchaseDate month)
      const janExpenses = await getExpenses({ yearMonth: '2025-01' });
      expect(janExpenses).toHaveLength(1);
      expect(janExpenses[0].description).toBe('Late January Purchase');

      // Should NOT appear in February budget
      const febExpenses = await getExpenses({ yearMonth: '2025-02' });
      expect(febExpenses).toHaveLength(0);

      // Should NOT appear in March budget
      const marExpenses = await getExpenses({ yearMonth: '2025-03' });
      expect(marExpenses).toHaveLength(0);
    });
  });
  });
});
