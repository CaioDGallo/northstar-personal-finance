'use server';

import { db } from '@/lib/db';
import { transactions, entries, accounts, categories, type NewTransaction, type NewEntry } from '@/lib/schema';
import { eq, and, gte, lte, isNull, isNotNull, desc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

type CreateExpenseData = {
  description: string;
  totalAmount: number; // cents
  categoryId: number;
  accountId: number;
  dueDate: string; // 'YYYY-MM-DD' for first installment
  installments: number;
};

export async function createExpense(data: CreateExpenseData) {
  // 1. Create transaction
  const [transaction] = await db
    .insert(transactions)
    .values({
      description: data.description,
      totalAmount: data.totalAmount,
      totalInstallments: data.installments,
      categoryId: data.categoryId,
    })
    .returning();

  // 2. Generate entries for each installment
  const amountPerInstallment = Math.round(data.totalAmount / data.installments);
  const baseDate = new Date(data.dueDate);

  const entriesToInsert: NewEntry[] = [];

  for (let i = 0; i < data.installments; i++) {
    const installmentDate = new Date(baseDate);
    installmentDate.setMonth(installmentDate.getMonth() + i);

    // Adjust for last installment (rounding differences)
    const amount =
      i === data.installments - 1
        ? data.totalAmount - amountPerInstallment * (data.installments - 1)
        : amountPerInstallment;

    entriesToInsert.push({
      transactionId: transaction.id,
      accountId: data.accountId,
      amount,
      dueDate: installmentDate.toISOString().split('T')[0],
      installmentNumber: i + 1,
      paidAt: null,
    });
  }

  await db.insert(entries).values(entriesToInsert);

  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

export async function getTransactionWithEntries(transactionId: number) {
  const transaction = await db.query.transactions.findFirst({
    where: eq(transactions.id, transactionId),
    with: {
      entries: true,
    },
  });
  return transaction;
}

export async function updateExpense(transactionId: number, data: CreateExpenseData) {
  // 1. Update transaction
  await db
    .update(transactions)
    .set({
      description: data.description,
      totalAmount: data.totalAmount,
      totalInstallments: data.installments,
      categoryId: data.categoryId,
    })
    .where(eq(transactions.id, transactionId));

  // 2. Delete old entries
  await db.delete(entries).where(eq(entries.transactionId, transactionId));

  // 3. Regenerate entries (same logic as create)
  const amountPerInstallment = Math.round(data.totalAmount / data.installments);
  const baseDate = new Date(data.dueDate);

  const entriesToInsert: NewEntry[] = [];

  for (let i = 0; i < data.installments; i++) {
    const installmentDate = new Date(baseDate);
    installmentDate.setMonth(installmentDate.getMonth() + i);

    const amount =
      i === data.installments - 1
        ? data.totalAmount - amountPerInstallment * (data.installments - 1)
        : amountPerInstallment;

    entriesToInsert.push({
      transactionId,
      accountId: data.accountId,
      amount,
      dueDate: installmentDate.toISOString().split('T')[0],
      installmentNumber: i + 1,
      paidAt: null,
    });
  }

  await db.insert(entries).values(entriesToInsert);

  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

export async function deleteExpense(transactionId: number) {
  // CASCADE will delete entries automatically
  await db.delete(transactions).where(eq(transactions.id, transactionId));
  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

export type ExpenseFilters = {
  yearMonth?: string; // 'YYYY-MM'
  categoryId?: number;
  accountId?: number;
  status?: 'all' | 'paid' | 'pending';
};

export async function getExpenses(filters: ExpenseFilters = {}) {
  const { yearMonth, categoryId, accountId, status = 'all' } = filters;

  const conditions = [];

  // Filter by month using SQL to extract year-month from dueDate
  if (yearMonth) {
    conditions.push(sql`to_char(${entries.dueDate}, 'YYYY-MM') = ${yearMonth}`);
  }

  if (categoryId) {
    conditions.push(eq(transactions.categoryId, categoryId));
  }

  if (accountId) {
    conditions.push(eq(entries.accountId, accountId));
  }

  if (status === 'pending') {
    conditions.push(isNull(entries.paidAt));
  } else if (status === 'paid') {
    conditions.push(isNotNull(entries.paidAt));
  }

  const results = await db
    .select({
      id: entries.id,
      amount: entries.amount,
      dueDate: entries.dueDate,
      paidAt: entries.paidAt,
      installmentNumber: entries.installmentNumber,
      transactionId: transactions.id,
      description: transactions.description,
      totalInstallments: transactions.totalInstallments,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      accountId: accounts.id,
      accountName: accounts.name,
    })
    .from(entries)
    .innerJoin(transactions, eq(entries.transactionId, transactions.id))
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .innerJoin(accounts, eq(entries.accountId, accounts.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(entries.dueDate));

  return results;
}

export async function markEntryPaid(entryId: number) {
  await db
    .update(entries)
    .set({ paidAt: new Date().toISOString() })
    .where(eq(entries.id, entryId));

  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}

export async function markEntryPending(entryId: number) {
  await db
    .update(entries)
    .set({ paidAt: null })
    .where(eq(entries.id, entryId));

  revalidatePath('/expenses');
  revalidatePath('/dashboard');
}
