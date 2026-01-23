import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import { mockAuth } from '@/test/auth-utils';
import * as schema from '@/lib/schema';
import { testCategories, testAccounts, TEST_USER_ID } from '@/test/fixtures';
import { eq } from 'drizzle-orm';

type CategoryActions = typeof import('@/lib/actions/categories');

describe('Category Actions - CRUD', () => {
  let db: ReturnType<typeof getTestDb>;
  let categoryId: number;

  // Dynamic imports after mocking
  let getCategories: CategoryActions['getCategories'];
  let getCategoriesByUser: CategoryActions['getCategoriesByUser'];
  let createCategory: CategoryActions['createCategory'];
  let updateCategory: CategoryActions['updateCategory'];
  let deleteCategory: CategoryActions['deleteCategory'];

  const tMock = vi.fn(async (key: string) => key);

  beforeAll(async () => {
    db = await setupTestDb();

    // Mock the db module to use test database
    vi.doMock('@/lib/db', () => ({
      db,
    }));

    // Mock auth to prevent Next.js cookies() calls
    mockAuth();

    // Mock translations used in error paths
    vi.doMock('@/lib/i18n/server-errors', () => ({
      t: tMock,
    }));

    // Import actions after mocking
    const actions = await import('@/lib/actions/categories');
    getCategories = actions.getCategories;
    getCategoriesByUser = actions.getCategoriesByUser;
    createCategory = actions.createCategory;
    updateCategory = actions.updateCategory;
    deleteCategory = actions.deleteCategory;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();

    const [category] = await db
      .insert(schema.categories)
      .values(testCategories.expense)
      .returning();

    categoryId = category.id;
  });

  it('getCategories returns ordered categories and filters by type', async () => {
    await db.insert(schema.categories).values([
      testCategories.income,
      {
        userId: TEST_USER_ID,
        name: 'Auto',
        color: '#111111',
        type: 'expense',
      },
      {
        userId: 'other-user',
        name: 'Other User Category',
        color: '#111111',
        type: 'expense',
      },
    ]);

    const all = await getCategories();
    expect(all.map((cat) => cat.name)).toEqual(['Auto', 'Test Expense Category', 'Test Salary']);

    const expense = await getCategories('expense');
    expect(expense.map((cat) => cat.name)).toEqual(['Auto', 'Test Expense Category']);

    const income = await getCategories('income');
    expect(income.map((cat) => cat.name)).toEqual(['Test Salary']);
  });

  it('creates category for the current user', async () => {
    const result = await createCategory({
      name: 'Utilities',
      color: '#123456',
      icon: 'FlashIcon',
      type: 'expense',
    });

    expect(result.success).toBe(true);
    expect(result).toHaveProperty('data');
    if (result.success) {
      expect(result.data).toHaveProperty('id');
      expect(typeof result.data?.id).toBe('number');
    }

    const [created] = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.name, 'Utilities'));

    expect(created).toMatchObject({
      userId: TEST_USER_ID,
      name: 'Utilities',
      color: '#123456',
      icon: 'FlashIcon',
      type: 'expense',
    });
  });

  it('updates category fields', async () => {
    const result = await updateCategory(categoryId, {
      name: 'Updated Category',
      color: '#654321',
      icon: 'UpdatedIcon',
      type: 'income',
    });

    expect(result).toEqual({ success: true });

    const [updated] = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, categoryId));

    expect(updated).toMatchObject({
      userId: TEST_USER_ID,
      name: 'Updated Category',
      color: '#654321',
      icon: 'UpdatedIcon',
      type: 'income',
    });
  });

  it('getCategoriesByUser returns user categories ordered by name', async () => {
    await db.insert(schema.categories).values([
      testCategories.income,
      {
        userId: TEST_USER_ID,
        name: 'Auto',
        color: '#111111',
        type: 'expense',
      },
    ]);

    const all = await getCategoriesByUser(TEST_USER_ID);
    expect(all.map((cat) => cat.name)).toEqual(['Auto', 'Test Expense Category', 'Test Salary']);

    const expenses = await getCategoriesByUser(TEST_USER_ID, 'expense');
    expect(expenses.map((cat) => cat.name)).toEqual(['Auto', 'Test Expense Category']);

    const income = await getCategoriesByUser(TEST_USER_ID, 'income');
    expect(income.map((cat) => cat.name)).toEqual(['Test Salary']);
  });

  it('deletes category when unused', async () => {
    const result = await deleteCategory(categoryId);
    expect(result).toEqual({ success: true });

    const remaining = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, categoryId));

    expect(remaining).toHaveLength(0);
  });

  it('prevents delete when category is used by transactions', async () => {
    await db.insert(schema.transactions).values({
      userId: TEST_USER_ID,
      description: 'Test Transaction',
      totalAmount: 10000,
      totalInstallments: 1,
      categoryId,
    });

    const result = await deleteCategory(categoryId);
    expect(result).toEqual({
      success: false,
      error: 'errors.cannotDeleteCategoryWithTransactions',
    });

    const remaining = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, categoryId));

    expect(remaining).toHaveLength(1);
  });

  it('prevents delete when category is used by income', async () => {
    const [account] = await db
      .insert(schema.accounts)
      .values(testAccounts.checking)
      .returning();

    await db.insert(schema.income).values({
      userId: TEST_USER_ID,
      description: 'Salary',
      amount: 50000,
      categoryId,
      accountId: account.id,
      receivedDate: '2025-01-15',
    });

    const result = await deleteCategory(categoryId);
    expect(result).toEqual({
      success: false,
      error: 'errors.cannotDeleteCategoryWithIncome',
    });

    const remaining = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, categoryId));

    expect(remaining).toHaveLength(1);
  });
});
