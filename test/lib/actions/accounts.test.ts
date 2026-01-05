import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { TEST_USER_ID, testAccounts, testCategories } from '@/test/fixtures';
import { and, eq } from 'drizzle-orm';
import { revalidatePath, revalidateTag } from 'next/cache';

type AccountsActions = typeof import('@/lib/actions/accounts');
type ExpensesActions = typeof import('@/lib/actions/expenses');
type CreateAccountData = Parameters<AccountsActions['createAccount']>[0];

const OTHER_USER_ID = 'other-user-id';

describe('Account Actions', () => {
  let db: ReturnType<typeof getTestDb>;

  let getAccounts: AccountsActions['getAccounts'];
  let createAccount: AccountsActions['createAccount'];
  let updateAccount: AccountsActions['updateAccount'];
  let deleteAccount: AccountsActions['deleteAccount'];
  let createExpense: ExpensesActions['createExpense'];

  let getCurrentUserIdMock: ReturnType<typeof vi.fn>;

  const revalidatePathMock = vi.mocked(revalidatePath);
  const revalidateTagMock = vi.mocked(revalidateTag);

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
    getAccounts = accountActions.getAccounts;
    createAccount = accountActions.createAccount;
    updateAccount = accountActions.updateAccount;
    deleteAccount = accountActions.deleteAccount;

    const expenseActions = await import('@/lib/actions/expenses');
    createExpense = expenseActions.createExpense;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue(TEST_USER_ID);
  });

  describe('getAccounts', () => {
    it('returns empty array when user has no accounts', async () => {
      const accounts = await getAccounts();
      expect(accounts).toEqual([]);
    });

    it('returns accounts for current user ordered by name', async () => {
      await db.insert(schema.accounts).values([
        { userId: TEST_USER_ID, name: 'B Account', type: 'checking' },
        { userId: TEST_USER_ID, name: 'A Account', type: 'savings' },
        { userId: OTHER_USER_ID, name: 'Other Account', type: 'cash' },
        { userId: TEST_USER_ID, name: 'C Account', type: 'cash' },
      ]);

      const accounts = await getAccounts();

      expect(accounts).toHaveLength(3);
      expect(accounts.map((account) => account.name)).toEqual([
        'A Account',
        'B Account',
        'C Account',
      ]);
      expect(accounts.every((account) => account.userId === TEST_USER_ID)).toBe(true);
    });
  });

  describe('createAccount', () => {
    it('creates accounts for each type and defaults currency', async () => {
      await createAccount({ name: 'Checking', type: 'checking' });
      await createAccount({ name: 'Savings', type: 'savings' });
      await createAccount({ name: 'Cash', type: 'cash' });
      await createAccount({ name: 'Card', type: 'credit_card' });

      const accounts = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.userId, TEST_USER_ID));

      const types = accounts.map((account) => account.type).sort();
      expect(types).toEqual(['cash', 'checking', 'credit_card', 'savings']);
      expect(accounts.every((account) => account.currency === 'BRL')).toBe(true);
    });

    it('sets userId automatically and stores billing config', async () => {
      const data = {
        name: 'Card with Billing',
        type: 'credit_card',
        closingDay: 15,
        paymentDueDay: 5,
        userId: OTHER_USER_ID,
      } as unknown as CreateAccountData;

      await createAccount(data);

      const [account] = await db.select().from(schema.accounts);
      expect(account.userId).toBe(TEST_USER_ID);
      expect(account.closingDay).toBe(15);
      expect(account.paymentDueDay).toBe(5);
    });

    it('accepts other currency codes', async () => {
      await createAccount({ name: 'USD Account', type: 'checking', currency: 'USD' });
      const [account] = await db.select().from(schema.accounts);
      expect(account.currency).toBe('USD');
    });

    it('allows duplicate names and special characters', async () => {
      await createAccount({ name: 'Conta #1 & Co', type: 'checking' });
      await createAccount({ name: 'Conta #1 & Co', type: 'savings' });

      const accounts = await db.select().from(schema.accounts);
      expect(accounts).toHaveLength(2);
    });

    it('accepts very long names', async () => {
      const longName = 'A'.repeat(200);
      await createAccount({ name: longName, type: 'cash' });
      const [account] = await db.select().from(schema.accounts);
      expect(account.name).toBe(longName);
    });

    it('revalidates accounts cache on create', async () => {
      await createAccount({ name: 'Test', type: 'checking' });
      expect(revalidatePathMock).toHaveBeenCalledWith('/settings/accounts');
      expect(revalidateTagMock).toHaveBeenCalledWith('accounts', 'max');
    });

    it('validates required name', async () => {
      await expect(createAccount({ name: '', type: 'checking' })).rejects.toThrow(
        'Account name is required'
      );

      await expect(createAccount({ name: '   ', type: 'checking' })).rejects.toThrow(
        'Account name is required'
      );
    });

    it('validates account type', async () => {
      const invalidType = 'brokerage' as unknown as CreateAccountData['type'];
      await expect(createAccount({ name: 'Invalid', type: invalidType })).rejects.toThrow(
        'Invalid account type'
      );
    });

    it('validates billing day ranges', async () => {
      await expect(
        createAccount({
          name: 'Bad Closing',
          type: 'credit_card',
          closingDay: 0,
          paymentDueDay: 5,
        })
      ).rejects.toThrow('Closing day must be between 1 and 28');

      await expect(
        createAccount({
          name: 'Bad Due',
          type: 'credit_card',
          closingDay: 10,
          paymentDueDay: 29,
        })
      ).rejects.toThrow('Payment due day must be between 1 and 28');
    });
  });

  describe('updateAccount', () => {
    it('updates account name and type', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.checking)
        .returning();

      await updateAccount(account.id, { name: 'Updated Name', type: 'savings' });

      const [updated] = await db.select().from(schema.accounts);
      expect(updated.name).toBe('Updated Name');
      expect(updated.type).toBe('savings');
    });

    it('adds and removes billing config', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.creditCard)
        .returning();

      await updateAccount(account.id, { closingDay: 12, paymentDueDay: 4 });
      let [updated] = await db.select().from(schema.accounts);
      expect(updated.closingDay).toBe(12);
      expect(updated.paymentDueDay).toBe(4);

      await updateAccount(account.id, { closingDay: null, paymentDueDay: null });
      [updated] = await db.select().from(schema.accounts);
      expect(updated.closingDay).toBeNull();
      expect(updated.paymentDueDay).toBeNull();
    });

    it('does not update accounts belonging to another user', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values({ userId: OTHER_USER_ID, name: 'Other', type: 'checking' })
        .returning();

      await updateAccount(account.id, { name: 'Should Not Update' });

      const [unchanged] = await db.select().from(schema.accounts);
      expect(unchanged.name).toBe('Other');
    });

    it('revalidates accounts cache on update', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.checking)
        .returning();

      await updateAccount(account.id, { name: 'Updated' });
      expect(revalidatePathMock).toHaveBeenCalledWith('/settings/accounts');
      expect(revalidateTagMock).toHaveBeenCalledWith('accounts', 'max');
    });

    it('validates account id', async () => {
      await expect(updateAccount(0, { name: 'Test' })).rejects.toThrow('Invalid account ID');
    });

    it('validates billing day ranges on update', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.creditCard)
        .returning();

      await expect(updateAccount(account.id, { closingDay: 0 })).rejects.toThrow(
        'Closing day must be between 1 and 28'
      );
    });

    it('validates empty name on update', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.checking)
        .returning();

      await expect(updateAccount(account.id, { name: '   ' })).rejects.toThrow(
        'Account name is required'
      );
    });
  });

  describe('deleteAccount', () => {
    it('deletes account for current user', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.checking)
        .returning();

      await deleteAccount(account.id);

      const accounts = await db.select().from(schema.accounts);
      expect(accounts).toHaveLength(0);
    });

    it('does not delete account belonging to another user', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values({ userId: OTHER_USER_ID, name: 'Other', type: 'checking' })
        .returning();

      await deleteAccount(account.id);

      const accounts = await db.select().from(schema.accounts);
      expect(accounts).toHaveLength(1);
    });

    it('revalidates accounts cache on delete', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.checking)
        .returning();

      await deleteAccount(account.id);
      expect(revalidatePathMock).toHaveBeenCalledWith('/settings/accounts');
      expect(revalidateTagMock).toHaveBeenCalledWith('accounts', 'max');
    });

    it('validates account id', async () => {
      await expect(deleteAccount(0)).rejects.toThrow('Invalid account ID');
    });

    it('fails to delete account with entries', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.checking)
        .returning();

      const [category] = await db
        .insert(schema.categories)
        .values(testCategories.expense)
        .returning();

      const [transaction] = await db
        .insert(schema.transactions)
        .values({
          userId: TEST_USER_ID,
          description: 'Test',
          totalAmount: 1000,
          totalInstallments: 1,
          categoryId: category.id,
        })
        .returning();

      await db.insert(schema.entries).values({
        userId: TEST_USER_ID,
        transactionId: transaction.id,
        accountId: account.id,
        amount: 1000,
        purchaseDate: '2025-01-01',
        faturaMonth: '2025-01',
        dueDate: '2025-01-01',
        installmentNumber: 1,
        paidAt: null,
      });

      await expect(deleteAccount(account.id)).rejects.toThrow();

      const accounts = await db.select().from(schema.accounts);
      expect(accounts).toHaveLength(1);
    });

    it('fails to delete account with income', async () => {
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
        description: 'Test Income',
        amount: 50000,
        categoryId: category.id,
        accountId: account.id,
        receivedDate: '2025-01-10',
        receivedAt: null,
      });

      await expect(deleteAccount(account.id)).rejects.toThrow();

      const accounts = await db.select().from(schema.accounts);
      expect(accounts).toHaveLength(1);
    });

    it('cascades delete to faturas', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.creditCardWithBilling)
        .returning();

      await db.insert(schema.faturas).values({
        userId: TEST_USER_ID,
        accountId: account.id,
        yearMonth: '2025-01',
        totalAmount: 0,
        dueDate: '2025-02-05',
        paidAt: null,
        paidFromAccountId: null,
      });

      await deleteAccount(account.id);

      const faturas = await db.select().from(schema.faturas);
      expect(faturas).toHaveLength(0);
    });
  });

  describe('integration', () => {
    it('creates a fatura for credit card expenses', async () => {
      const [account] = await db
        .insert(schema.accounts)
        .values(testAccounts.creditCardWithBilling)
        .returning();

      const [category] = await db
        .insert(schema.categories)
        .values(testCategories.expense)
        .returning();

      await createExpense({
        description: 'Test Expense',
        totalAmount: 10000,
        categoryId: category.id,
        accountId: account.id,
        purchaseDate: '2025-01-10',
        installments: 1,
      });

      const faturas = await db
        .select()
        .from(schema.faturas)
        .where(
          and(eq(schema.faturas.userId, TEST_USER_ID), eq(schema.faturas.accountId, account.id))
        );

      expect(faturas).toHaveLength(1);
      expect(faturas[0].yearMonth).toBe('2025-01');
    });
  });
});
