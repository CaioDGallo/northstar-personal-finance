import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import { mockAuth } from '@/test/auth-utils';
import * as schema from '@/lib/schema';
import { testAccounts, testCategories, TEST_USER_ID } from '@/test/fixtures';

type IncomeActions = typeof import('@/lib/actions/income');

describe('Income Actions - Happy Path', () => {
  let db: ReturnType<typeof getTestDb>;
  let accountId: number;
  let categoryId: number;

  // Dynamic imports after mocking
  let createIncome: IncomeActions['createIncome'];
  let updateIncome: IncomeActions['updateIncome'];
  let deleteIncome: IncomeActions['deleteIncome'];
  let getIncome: IncomeActions['getIncome'];
  let markIncomeReceived: IncomeActions['markIncomeReceived'];
  let markIncomePending: IncomeActions['markIncomePending'];
  let updateIncomeCategory: IncomeActions['updateIncomeCategory'];

  beforeAll(async () => {
    db = await setupTestDb();

    // Mock the db module to use test database
    vi.doMock('@/lib/db', () => ({
      db,
    }));

    // Mock auth to prevent Next.js cookies() calls
    mockAuth();

    // Import actions after mocking
    const actions = await import('@/lib/actions/income');
    createIncome = actions.createIncome;
    updateIncome = actions.updateIncome;
    deleteIncome = actions.deleteIncome;
    getIncome = actions.getIncome;
    markIncomeReceived = actions.markIncomeReceived;
    markIncomePending = actions.markIncomePending;
    updateIncomeCategory = actions.updateIncomeCategory;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();

    // Seed test data
    const [account] = await db
      .insert(schema.accounts)
      .values(testAccounts.checking)
      .returning();

    const [category] = await db
      .insert(schema.categories)
      .values(testCategories.income)
      .returning();

    accountId = account.id;
    categoryId = category.id;
  });

  describe('createIncome', () => {
    it('creates income successfully', async () => {
      await createIncome({
        description: 'Salary',
        amount: 500000, // R$ 5000
        categoryId,
        accountId,
        receivedDate: '2025-01-15',
      });

      const incomes = await getIncome();

      expect(incomes).toHaveLength(1);
      expect(incomes[0]).toMatchObject({
        description: 'Salary',
        amount: 500000,
        receivedDate: '2025-01-15',
        categoryId,
        accountId,
      });
      expect(incomes[0].receivedAt).toBeNull();
    });

    it('trims description when creating', async () => {
      await createIncome({
        description: '  Freelance Payment  ',
        amount: 100000,
        categoryId,
        accountId,
        receivedDate: '2025-01-15',
      });

      const incomes = await getIncome();
      expect(incomes[0].description).toBe('Freelance Payment');
    });

    it('auto-generates description from category when empty', async () => {
      await createIncome({
        description: '',
        amount: 500000,
        categoryId,
        accountId,
        receivedDate: '2025-01-15',
      });

      const incomes = await getIncome();
      expect(incomes).toHaveLength(1);
      // Should use category name as description
      expect(incomes[0].description).toBe('Test Salary');
    });

    it('auto-generates description from category when whitespace-only', async () => {
      await createIncome({
        description: '   ',
        amount: 500000,
        categoryId,
        accountId,
        receivedDate: '2025-01-15',
      });

      const incomes = await getIncome();
      expect(incomes).toHaveLength(1);
      // Should use category name as description
      expect(incomes[0].description).toBe('Test Salary');
    });

    it('validates positive amount', async () => {
      await expect(
        createIncome({
          description: 'Test',
          amount: 0,
          categoryId,
          accountId,
          receivedDate: '2025-01-15',
        })
      ).rejects.toThrow('Amount must be a positive integer');

      await expect(
        createIncome({
          description: 'Test',
          amount: -1000,
          categoryId,
          accountId,
          receivedDate: '2025-01-15',
        })
      ).rejects.toThrow('Amount must be a positive integer');
    });

    it('validates integer amount', async () => {
      await expect(
        createIncome({
          description: 'Test',
          amount: 100.5,
          categoryId,
          accountId,
          receivedDate: '2025-01-15',
        })
      ).rejects.toThrow('Amount must be a positive integer');
    });

    it('validates date format', async () => {
      await expect(
        createIncome({
          description: 'Test',
          amount: 50000,
          categoryId,
          accountId,
          receivedDate: '15/01/2025', // Invalid format
        })
      ).rejects.toThrow('Invalid date format');

      await expect(
        createIncome({
          description: 'Test',
          amount: 50000,
          categoryId,
          accountId,
          receivedDate: '2025-1-15', // Missing zero padding
        })
      ).rejects.toThrow('Invalid date format');
    });

    it('validates categoryId', async () => {
      await expect(
        createIncome({
          description: 'Test',
          amount: 50000,
          categoryId: 0,
          accountId,
          receivedDate: '2025-01-15',
        })
      ).rejects.toThrow('Invalid category ID');

      await expect(
        createIncome({
          description: 'Test',
          amount: 50000,
          categoryId: -1,
          accountId,
          receivedDate: '2025-01-15',
        })
      ).rejects.toThrow('Invalid category ID');
    });

    it('validates accountId', async () => {
      await expect(
        createIncome({
          description: 'Test',
          amount: 50000,
          categoryId,
          accountId: 0,
          receivedDate: '2025-01-15',
        })
      ).rejects.toThrow('Invalid account ID');
    });
  });

  describe('getIncome', () => {
    beforeEach(async () => {
      // Create test data for filtering
      await createIncome({
        description: 'January Income',
        amount: 50000,
        categoryId,
        accountId,
        receivedDate: '2025-01-15',
      });

      await createIncome({
        description: 'February Income',
        amount: 60000,
        categoryId,
        accountId,
        receivedDate: '2025-02-10',
      });
    });

    it('returns all income without filters', async () => {
      const incomes = await getIncome();
      expect(incomes).toHaveLength(2);
    });

    it('filters by yearMonth', async () => {
      const janIncome = await getIncome({ yearMonth: '2025-01' });
      expect(janIncome).toHaveLength(1);
      expect(janIncome[0].description).toBe('January Income');

      const febIncome = await getIncome({ yearMonth: '2025-02' });
      expect(febIncome).toHaveLength(1);
      expect(febIncome[0].description).toBe('February Income');
    });

    it('filters by status: pending', async () => {
      const incomes = await getIncome();
      await markIncomeReceived(incomes[0].id);

      const pending = await getIncome({ status: 'pending' });
      expect(pending).toHaveLength(1);
      expect(pending[0].receivedAt).toBeNull();
    });

    it('filters by status: received', async () => {
      const incomes = await getIncome();
      await markIncomeReceived(incomes[0].id);

      const received = await getIncome({ status: 'received' });
      expect(received).toHaveLength(1);
      expect(received[0].receivedAt).not.toBeNull();
    });

    it('filters by categoryId', async () => {
      const [newCategory] = await db
        .insert(schema.categories)
        .values({ userId: TEST_USER_ID, name: 'Bonus', color: '#8b5cf6', type: 'income' })
        .returning();

      await createIncome({
        description: 'Year-end Bonus',
        amount: 100000,
        categoryId: newCategory.id,
        accountId,
        receivedDate: '2025-01-20',
      });

      const filtered = await getIncome({ categoryId: newCategory.id });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].categoryId).toBe(newCategory.id);
      expect(filtered[0].categoryName).toBe('Bonus');
    });

    it('filters by accountId', async () => {
      const [newAccount] = await db
        .insert(schema.accounts)
        .values({ userId: TEST_USER_ID, name: 'Business Account', type: 'checking' })
        .returning();

      await createIncome({
        description: 'Business Income',
        amount: 75000,
        categoryId,
        accountId: newAccount.id,
        receivedDate: '2025-01-20',
      });

      const filtered = await getIncome({ accountId: newAccount.id });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].accountId).toBe(newAccount.id);
      expect(filtered[0].accountName).toBe('Business Account');
    });

    it('handles month boundaries in yearMonth filter', async () => {
      // Test end of month
      await createIncome({
        description: 'End of January',
        amount: 50000,
        categoryId,
        accountId,
        receivedDate: '2025-01-31',
      });

      const jan = await getIncome({ yearMonth: '2025-01' });
      expect(jan.length).toBeGreaterThanOrEqual(1);
      expect(jan.some((i) => i.description === 'End of January')).toBe(true);
    });
  });

  describe('updateIncome', () => {
    it('updates income successfully', async () => {
      await createIncome({
        description: 'Original',
        amount: 50000,
        categoryId,
        accountId,
        receivedDate: '2025-01-15',
      });

      const initial = await getIncome();
      const incomeId = initial[0].id;

      await updateIncome(incomeId, {
        description: 'Updated Description',
        amount: 75000,
        categoryId,
        accountId,
        receivedDate: '2025-01-20',
      });

      const updated = await getIncome();
      expect(updated).toHaveLength(1);
      expect(updated[0].description).toBe('Updated Description');
      expect(updated[0].amount).toBe(75000);
      expect(updated[0].receivedDate).toBe('2025-01-20');
    });

    it('validates on update', async () => {
      await createIncome({
        description: 'Test',
        amount: 50000,
        categoryId,
        accountId,
        receivedDate: '2025-01-15',
      });

      const initial = await getIncome();

      // Auto-generates description from category when empty
      await updateIncome(initial[0].id, {
        description: '',
        amount: 50000,
        categoryId,
        accountId,
        receivedDate: '2025-01-15',
      });

      const updated = await getIncome();
      expect(updated[0].description).toBe('Test Salary'); // Uses category name
    });
  });

  describe('deleteIncome', () => {
    it('deletes income record', async () => {
      await createIncome({
        description: 'To Delete',
        amount: 50000,
        categoryId,
        accountId,
        receivedDate: '2025-01-15',
      });

      const initial = await getIncome();
      expect(initial).toHaveLength(1);

      await deleteIncome(initial[0].id);

      const after = await getIncome();
      expect(after).toHaveLength(0);
    });

    it('validates income ID', async () => {
      await expect(deleteIncome(0)).rejects.toThrow('Invalid income ID');
      await expect(deleteIncome(-1)).rejects.toThrow('Invalid income ID');
    });
  });

  describe('markIncomeReceived / markIncomePending', () => {
    it('marks income as received', async () => {
      await createIncome({
        description: 'Test',
        amount: 50000,
        categoryId,
        accountId,
        receivedDate: '2025-01-15',
      });

      const incomes = await getIncome();
      const incomeId = incomes[0].id;

      await markIncomeReceived(incomeId);

      const updated = await getIncome();
      expect(updated[0].receivedAt).not.toBeNull();
    });

    it('marks income as pending', async () => {
      await createIncome({
        description: 'Test',
        amount: 50000,
        categoryId,
        accountId,
        receivedDate: '2025-01-15',
      });

      const incomes = await getIncome();
      await markIncomeReceived(incomes[0].id);
      await markIncomePending(incomes[0].id);

      const updated = await getIncome();
      expect(updated[0].receivedAt).toBeNull();
    });

    it('validates income ID for status updates', async () => {
      await expect(markIncomeReceived(0)).rejects.toThrow('Invalid income ID');
      await expect(markIncomePending(-1)).rejects.toThrow('Invalid income ID');
    });
  });

  describe('updateIncomeCategory', () => {
    it('updates category for income', async () => {
      await createIncome({
        description: 'Test',
        amount: 50000,
        categoryId,
        accountId,
        receivedDate: '2025-01-15',
      });

      const [newCategory] = await db
        .insert(schema.categories)
        .values({ userId: TEST_USER_ID, name: 'New Income Category', color: '#10b981', type: 'income' })
        .returning();

      const initial = await getIncome();
      await updateIncomeCategory(initial[0].id, newCategory.id);

      const updated = await getIncome();
      expect(updated[0].categoryId).toBe(newCategory.id);
      expect(updated[0].categoryName).toBe('New Income Category');
    });
  });
});
