'use server';

import { db } from '@/lib/db';
import { transactions, entries, income, transfers, faturas } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUserId } from '@/lib/auth';
import { handleDbError } from '@/lib/db-errors';
import { reconcileAccountBalancesForUser } from '@/lib/actions/accounts';

export async function resetAllTransactions(): Promise<
  | {
      success: true;
      deletedTransfers: number;
      deletedFaturas: number;
      deletedEntries: number;
      deletedTransactions: number;
      deletedIncome: number;
      accountsReconciled: number;
    }
  | { success: false; error: string }
> {
  try {
    const userId = await getCurrentUserId();

    let deletedTransfers = 0;
    let deletedFaturas = 0;
    let deletedEntries = 0;
    let deletedTransactions = 0;
    let deletedIncome = 0;
    let accountsReconciled = 0;

    await db.transaction(async (tx) => {
      // 1. Delete transfers (references faturas.id via FK)
      const transfersResult = await tx
        .delete(transfers)
        .where(eq(transfers.userId, userId))
        .returning({ id: transfers.id });
      deletedTransfers = transfersResult.length;

      // 2. Delete income (independent)
      const incomeResult = await tx
        .delete(income)
        .where(eq(income.userId, userId))
        .returning({ id: income.id });
      deletedIncome = incomeResult.length;

      // 3. Delete entries (child of transactions)
      const entriesResult = await tx
        .delete(entries)
        .where(eq(entries.userId, userId))
        .returning({ id: entries.id });
      deletedEntries = entriesResult.length;

      // 4. Delete faturas (after transfers removed FK references)
      const faturasResult = await tx
        .delete(faturas)
        .where(eq(faturas.userId, userId))
        .returning({ id: faturas.id });
      deletedFaturas = faturasResult.length;

      // 5. Delete transactions (parent of entries)
      const transactionsResult = await tx
        .delete(transactions)
        .where(eq(transactions.userId, userId))
        .returning({ id: transactions.id });
      deletedTransactions = transactionsResult.length;

      // 6. Recalculate account balances
      const { updated } = await reconcileAccountBalancesForUser(userId, tx);
      accountsReconciled = updated;
    });

    revalidatePath('/expenses');
    revalidatePath('/income');
    revalidatePath('/transfers');
    revalidatePath('/dashboard');
    revalidatePath('/faturas');
    revalidatePath('/settings/accounts');

    return {
      success: true,
      deletedTransfers,
      deletedFaturas,
      deletedEntries,
      deletedTransactions,
      deletedIncome,
      accountsReconciled,
    };
  } catch (error) {
    console.error('Failed to reset transactions:', error);
    const errorMessage = await handleDbError(error, 'errors.failedToDelete');
    return { success: false, error: errorMessage };
  }
}
