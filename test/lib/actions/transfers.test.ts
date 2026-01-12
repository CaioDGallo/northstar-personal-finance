import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import { mockAuth } from '@/test/auth-utils';
import { TEST_USER_ID, testAccounts } from '@/test/fixtures';
import * as schema from '@/lib/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

type TransferActions = typeof import('@/lib/actions/transfers');

describe('Transfer Actions', () => {
  let db: ReturnType<typeof getTestDb>;
  let createTransfer: TransferActions['createTransfer'];
  let updateTransfer: TransferActions['updateTransfer'];
  let deleteTransfer: TransferActions['deleteTransfer'];
  let syncAccountBalanceMock: ReturnType<typeof vi.fn>;

  const tMock = vi.fn(async (key: string) => key);
  const revalidatePathMock = vi.mocked(revalidatePath);

  let accountFromId: number;
  let accountToId: number;
  let accountExtraId: number;
  let otherAccountId: number;

  beforeAll(async () => {
    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({ db }));
    mockAuth();
    vi.doMock('@/lib/i18n/server-errors', () => ({ t: tMock }));
    syncAccountBalanceMock = vi.fn(async () => 0);
    vi.doMock('@/lib/actions/accounts', () => ({ syncAccountBalance: syncAccountBalanceMock }));

    const actions = await import('@/lib/actions/transfers');
    createTransfer = actions.createTransfer;
    updateTransfer = actions.updateTransfer;
    deleteTransfer = actions.deleteTransfer;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();

    const [fromAccount] = await db
      .insert(schema.accounts)
      .values(testAccounts.checking)
      .returning();

    const [toAccount] = await db
      .insert(schema.accounts)
      .values(testAccounts.creditCard)
      .returning();

    const [extraAccount] = await db
      .insert(schema.accounts)
      .values({
        userId: TEST_USER_ID,
        name: 'Extra Account',
        type: 'savings',
      })
      .returning();

    const [otherAccount] = await db
      .insert(schema.accounts)
      .values({
        userId: 'other-user-id',
        name: 'Other User Account',
        type: 'checking',
      })
      .returning();

    accountFromId = fromAccount.id;
    accountToId = toAccount.id;
    accountExtraId = extraAccount.id;
    otherAccountId = otherAccount.id;
  });

  describe('createTransfer', () => {
    it('rejects invalid amount', async () => {
      await expect(
        createTransfer({
          amount: 0,
          date: '2026-01-10',
          type: 'deposit',
          toAccountId: accountToId,
        })
      ).rejects.toThrow('errors.amountPositiveCents');
    });

    it('rejects invalid date format', async () => {
      await expect(
        createTransfer({
          amount: 1000,
          date: '10-01-2026',
          type: 'deposit',
          toAccountId: accountToId,
        })
      ).rejects.toThrow('errors.invalidDateFormat');
    });

    it('validates internal transfer accounts', async () => {
      await expect(
        createTransfer({
          amount: 1000,
          date: '2026-01-10',
          type: 'internal_transfer',
          fromAccountId: accountFromId,
        })
      ).rejects.toThrow('errors.invalidAccountId');

      await expect(
        createTransfer({
          amount: 1000,
          date: '2026-01-10',
          type: 'internal_transfer',
          fromAccountId: accountFromId,
          toAccountId: accountFromId,
        })
      ).rejects.toThrow('errors.invalidAccountId');
    });

    it('validates deposit and withdrawal account rules', async () => {
      await expect(
        createTransfer({
          amount: 1000,
          date: '2026-01-10',
          type: 'deposit',
        })
      ).rejects.toThrow('errors.invalidAccountId');

      await expect(
        createTransfer({
          amount: 1000,
          date: '2026-01-10',
          type: 'deposit',
          fromAccountId: accountFromId,
          toAccountId: accountToId,
        })
      ).rejects.toThrow('errors.invalidAccountId');

      await expect(
        createTransfer({
          amount: 1000,
          date: '2026-01-10',
          type: 'withdrawal',
        })
      ).rejects.toThrow('errors.invalidAccountId');

      await expect(
        createTransfer({
          amount: 1000,
          date: '2026-01-10',
          type: 'withdrawal',
          fromAccountId: accountFromId,
          toAccountId: accountToId,
        })
      ).rejects.toThrow('errors.invalidAccountId');
    });

    it('enforces account ownership', async () => {
      await expect(
        createTransfer({
          amount: 1000,
          date: '2026-01-10',
          type: 'internal_transfer',
          fromAccountId: otherAccountId,
          toAccountId: accountToId,
        })
      ).rejects.toThrow('errors.accountNotFound');
    });

    it('creates transfer, trims description, syncs balances, and revalidates paths', async () => {
      await createTransfer({
        amount: 2500,
        date: '2026-01-10',
        type: 'internal_transfer',
        fromAccountId: accountFromId,
        toAccountId: accountToId,
        description: '  Transfer note  ',
      });

      const [transfer] = await db
        .select()
        .from(schema.transfers)
        .where(eq(schema.transfers.userId, TEST_USER_ID));

      expect(transfer).toMatchObject({
        fromAccountId: accountFromId,
        toAccountId: accountToId,
        amount: 2500,
        type: 'internal_transfer',
        description: 'Transfer note',
      });

      expect(syncAccountBalanceMock).toHaveBeenCalledWith(accountFromId, expect.anything(), TEST_USER_ID);
      expect(syncAccountBalanceMock).toHaveBeenCalledWith(accountToId, expect.anything(), TEST_USER_ID);
      expect(revalidatePathMock).toHaveBeenCalledWith('/transfers');
      expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard');
      expect(revalidatePathMock).toHaveBeenCalledWith('/settings/accounts');
    });
  });

  describe('updateTransfer', () => {
    it('rejects invalid transfer id', async () => {
      await expect(
        updateTransfer(0, {
          amount: 1000,
          date: '2026-01-10',
          type: 'deposit',
          toAccountId: accountToId,
        })
      ).rejects.toThrow('errors.invalidTransactionId');
    });

    it('rejects missing transfer for user', async () => {
      await expect(
        updateTransfer(9999, {
          amount: 1000,
          date: '2026-01-10',
          type: 'deposit',
          toAccountId: accountToId,
        })
      ).rejects.toThrow('errors.relatedRecordNotFound');
    });

    it('rejects updates for fatura-linked transfers', async () => {
      const [fatura] = await db
        .insert(schema.faturas)
        .values({
          userId: TEST_USER_ID,
          accountId: accountToId,
          yearMonth: '2026-01',
          totalAmount: 0,
          dueDate: '2026-02-01',
        })
        .returning();

      const [transfer] = await db
        .insert(schema.transfers)
        .values({
          userId: TEST_USER_ID,
          fromAccountId: accountFromId,
          toAccountId: accountToId,
          amount: 5000,
          date: '2026-01-10',
          type: 'fatura_payment',
          faturaId: fatura.id,
        })
        .returning();

      await expect(
        updateTransfer(transfer.id, {
          amount: 1000,
          date: '2026-01-10',
          type: 'internal_transfer',
          fromAccountId: accountFromId,
          toAccountId: accountToId,
        })
      ).rejects.toThrow('errors.invalidDataConstraint');
    });

    it('validates updated data', async () => {
      const [transfer] = await db
        .insert(schema.transfers)
        .values({
          userId: TEST_USER_ID,
          fromAccountId: accountFromId,
          toAccountId: accountToId,
          amount: 5000,
          date: '2026-01-10',
          type: 'internal_transfer',
        })
        .returning();

      await expect(
        updateTransfer(transfer.id, {
          amount: -1,
          date: '2026-01-10',
          type: 'internal_transfer',
          fromAccountId: accountFromId,
          toAccountId: accountToId,
        })
      ).rejects.toThrow('errors.amountPositiveCents');

      await expect(
        updateTransfer(transfer.id, {
          amount: 1000,
          date: '2026/01/10',
          type: 'internal_transfer',
          fromAccountId: accountFromId,
          toAccountId: accountToId,
        })
      ).rejects.toThrow('errors.invalidDateFormat');

      await expect(
        updateTransfer(transfer.id, {
          amount: 1000,
          date: '2026-01-10',
          type: 'deposit',
          fromAccountId: accountFromId,
          toAccountId: accountToId,
        })
      ).rejects.toThrow('errors.invalidAccountId');
    });

    it('updates transfer, syncs affected balances, and revalidates paths', async () => {
      const [transfer] = await db
        .insert(schema.transfers)
        .values({
          userId: TEST_USER_ID,
          fromAccountId: accountFromId,
          toAccountId: accountToId,
          amount: 5000,
          date: '2026-01-10',
          type: 'internal_transfer',
          description: 'Original',
        })
        .returning();

      await updateTransfer(transfer.id, {
        amount: 7500,
        date: '2026-01-11',
        type: 'internal_transfer',
        fromAccountId: accountToId,
        toAccountId: accountExtraId,
        description: '  Updated  ',
      });

      const [updated] = await db
        .select()
        .from(schema.transfers)
        .where(and(eq(schema.transfers.userId, TEST_USER_ID), eq(schema.transfers.id, transfer.id)));

      expect(updated).toMatchObject({
        fromAccountId: accountToId,
        toAccountId: accountExtraId,
        amount: 7500,
        date: '2026-01-11',
        description: 'Updated',
      });

      const syncedIds = new Set(syncAccountBalanceMock.mock.calls.map(([id]) => id));
      expect(syncedIds).toEqual(new Set([accountFromId, accountToId, accountExtraId]));
      expect(revalidatePathMock).toHaveBeenCalledWith('/transfers');
      expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard');
      expect(revalidatePathMock).toHaveBeenCalledWith('/settings/accounts');
    });
  });

  describe('deleteTransfer', () => {
    it('rejects invalid transfer id', async () => {
      await expect(deleteTransfer(-1)).rejects.toThrow('errors.invalidTransactionId');
    });

    it('rejects missing transfer for user', async () => {
      await expect(deleteTransfer(12345)).rejects.toThrow('errors.relatedRecordNotFound');
    });

    it('rejects deletes for fatura-linked transfers', async () => {
      const [fatura] = await db
        .insert(schema.faturas)
        .values({
          userId: TEST_USER_ID,
          accountId: accountToId,
          yearMonth: '2026-01',
          totalAmount: 0,
          dueDate: '2026-02-01',
        })
        .returning();

      const [transfer] = await db
        .insert(schema.transfers)
        .values({
          userId: TEST_USER_ID,
          fromAccountId: accountFromId,
          toAccountId: accountToId,
          amount: 5000,
          date: '2026-01-10',
          type: 'fatura_payment',
          faturaId: fatura.id,
        })
        .returning();

      await expect(deleteTransfer(transfer.id)).rejects.toThrow('errors.invalidDataConstraint');
    });

    it('deletes transfer, syncs balances, and revalidates paths', async () => {
      const [transfer] = await db
        .insert(schema.transfers)
        .values({
          userId: TEST_USER_ID,
          fromAccountId: accountFromId,
          toAccountId: accountToId,
          amount: 5000,
          date: '2026-01-10',
          type: 'internal_transfer',
        })
        .returning();

      await deleteTransfer(transfer.id);

      const remaining = await db
        .select()
        .from(schema.transfers)
        .where(eq(schema.transfers.userId, TEST_USER_ID));
      expect(remaining).toHaveLength(0);

      const syncedIds = new Set(syncAccountBalanceMock.mock.calls.map(([id]) => id));
      expect(syncedIds).toEqual(new Set([accountFromId, accountToId]));
      expect(revalidatePathMock).toHaveBeenCalledWith('/transfers');
      expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard');
      expect(revalidatePathMock).toHaveBeenCalledWith('/settings/accounts');
    });
  });
});
