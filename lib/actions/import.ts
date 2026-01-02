'use server';

import { db } from '@/lib/db';
import { transactions, entries, accounts, categories } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ValidatedImportRow } from '@/lib/import/types';
import { getFaturaMonth, getFaturaPaymentDueDate } from '@/lib/fatura-utils';
import { ensureFaturaExists, updateFaturaTotal } from '@/lib/actions/faturas';

type ImportExpenseData = {
  rows: ValidatedImportRow[];
  accountId: number;
  categoryId: number;
};

type ImportResult =
  | {
      success: true;
      imported: number;
    }
  | {
      success: false;
      error: string;
    };

export async function importExpenses(data: ImportExpenseData): Promise<ImportResult> {
  const { rows, accountId, categoryId } = data;

  if (rows.length === 0) {
    return { success: false, error: 'No valid rows to import' };
  }

  // Validate accountId and categoryId exist
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return { success: false, error: 'Invalid account ID' };
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { success: false, error: 'Invalid category ID' };
  }

  try {
    // Verify account exists and fetch billing config
    const account = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    if (account.length === 0) {
      return { success: false, error: 'Account not found' };
    }

    // Verify category exists
    const category = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
    if (category.length === 0) {
      return { success: false, error: 'Category not found' };
    }

    // Check if this is a credit card with billing config
    const isCreditCard = account[0].type === 'credit_card';
    const hasBillingConfig = isCreditCard && account[0].closingDay && account[0].paymentDueDay;

    // Track affected fatura months for credit card accounts
    const affectedFaturas = new Set<string>();

    // Use transaction for atomicity
    await db.transaction(async (tx) => {
      for (const row of rows) {
        // Calculate fatura month and due date based on account type
        let faturaMonth: string;
        let dueDate: string;

        if (hasBillingConfig) {
          // Credit card with billing config: compute fatura month and due date
          const purchaseDate = new Date(row.date + 'T00:00:00Z');
          faturaMonth = getFaturaMonth(purchaseDate, account[0].closingDay!);
          dueDate = getFaturaPaymentDueDate(faturaMonth, account[0].paymentDueDay!, account[0].closingDay!);
          affectedFaturas.add(faturaMonth);
        } else {
          // Non-credit card or card without config: fatura = purchase month
          faturaMonth = row.date.slice(0, 7);
          dueDate = row.date;
        }

        // 1. Create transaction (single installment)
        const [transaction] = await tx
          .insert(transactions)
          .values({
            description: row.description,
            totalAmount: row.amountCents,
            totalInstallments: 1,
            categoryId,
          })
          .returning();

        // 2. Create single entry with correct fatura month and due date
        await tx.insert(entries).values({
          transactionId: transaction.id,
          accountId,
          amount: row.amountCents,
          purchaseDate: row.date,
          faturaMonth,
          dueDate,
          installmentNumber: 1,
          paidAt: null,
        });
      }
    });

    // Ensure faturas exist and update totals for credit cards
    if (hasBillingConfig) {
      for (const month of affectedFaturas) {
        await ensureFaturaExists(accountId, month);
        await updateFaturaTotal(accountId, month);
      }
    }

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/faturas');

    return { success: true, imported: rows.length };
  } catch (error) {
    console.error('[import:expenses] Failed:', error);
    return { success: false, error: 'Failed to import expenses. Please try again.' };
  }
}
