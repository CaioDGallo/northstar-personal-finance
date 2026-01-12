'use server';

import { db } from '@/lib/db';
import { transactions, entries, accounts, categories, income, transfers } from '@/lib/schema';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ValidatedImportRow, CategorySuggestion } from '@/lib/import/types';
import { getFaturaMonth, getFaturaPaymentDueDate } from '@/lib/fatura-utils';
import { ensureFaturaExists, updateFaturaTotal } from '@/lib/actions/faturas';
import { syncAccountBalance } from '@/lib/actions/accounts';
import { getDefaultImportCategories } from '@/lib/actions/categories';
import { getCurrentUserId } from '@/lib/auth';
import { checkBulkRateLimit } from '@/lib/rate-limit';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';

type SuggestionsInput = {
  expenseDescriptions: string[];
  incomeDescriptions: string[];
};

type SuggestionsResult = {
  expense: Record<string, CategorySuggestion>;
  income: Record<string, CategorySuggestion>;
};

export async function getCategorySuggestions(
  input: SuggestionsInput
): Promise<SuggestionsResult> {
  const { expenseDescriptions, incomeDescriptions } = input;
  const userId = await getCurrentUserId();

  const expenseMap: Record<string, CategorySuggestion> = {};
  const incomeMap: Record<string, CategorySuggestion> = {};

  if (expenseDescriptions.length > 0) {
    const expenseHistory = await db
      .select({
        description: transactions.description,
        categoryId: transactions.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          inArray(transactions.description, expenseDescriptions)
        )
      )
      .orderBy(desc(transactions.createdAt));

    for (const record of expenseHistory) {
      if (!expenseMap[record.description]) {
        expenseMap[record.description] = {
          id: record.categoryId,
          name: record.categoryName,
          color: record.categoryColor,
        };
      }
    }
  }

  if (incomeDescriptions.length > 0) {
    const incomeHistory = await db
      .select({
        description: income.description,
        categoryId: income.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        createdAt: income.createdAt,
      })
      .from(income)
      .innerJoin(categories, eq(income.categoryId, categories.id))
      .where(
        and(
          eq(income.userId, userId),
          inArray(income.description, incomeDescriptions)
        )
      )
      .orderBy(desc(income.createdAt));

    for (const record of incomeHistory) {
      if (!incomeMap[record.description]) {
        incomeMap[record.description] = {
          id: record.categoryId,
          name: record.categoryName,
          color: record.categoryColor,
        };
      }
    }
  }

  return { expense: expenseMap, income: incomeMap };
}

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
    return { success: false, error: await t('errors.noValidRows') };
  }

  // Validate accountId and categoryId exist
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return { success: false, error: await t('errors.invalidAccountId') };
  }
  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return { success: false, error: await t('errors.invalidCategoryId') };
  }

  try {
    const userId = await getCurrentUserId();

    const rateLimit = await checkBulkRateLimit(userId);
    if (!rateLimit.allowed) {
      return { success: false, error: await t('errors.tooManyAttempts', { retryAfter: rateLimit.retryAfter }) };
    }

    // Verify account exists and fetch billing config
    const account = await db.select().from(accounts).where(and(eq(accounts.userId, userId), eq(accounts.id, accountId))).limit(1);
    if (account.length === 0) {
      return { success: false, error: await t('errors.accountNotFound') };
    }

    // Verify category exists
    const category = await db.select().from(categories).where(and(eq(categories.userId, userId), eq(categories.id, categoryId))).limit(1);
    if (category.length === 0) {
      return { success: false, error: await t('errors.categoryNotFound') };
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
            userId,
            description: row.description,
            totalAmount: row.amountCents,
            totalInstallments: 1,
            categoryId,
          })
          .returning();

        // 2. Create single entry with correct fatura month and due date
        await tx.insert(entries).values({
          userId,
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

    await syncAccountBalance(accountId);

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/faturas');
    revalidatePath('/settings/accounts');

    return { success: true, imported: rows.length };
  } catch (error) {
    console.error('[import:expenses] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToImport') };
  }
}

type ImportMixedData = {
  rows: ValidatedImportRow[];
  accountId: number;
  categoryOverrides?: Record<number, number>;
};

type ImportMixedResult =
  | {
      success: true;
      importedExpenses: number;
      importedIncome: number;
      skippedDuplicates: number;
    }
  | {
      success: false;
      error: string;
    };

// Helper: Find existing installment transaction by description and total installments
async function findExistingInstallmentTransaction(
  userId: string,
  baseDescription: string,
  totalInstallments: number
): Promise<{ id: number; existingEntryNumbers: number[] } | null> {
  // Find transaction by description pattern (case-insensitive) and installment count
  const results = await db
    .select({
      id: transactions.id,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.totalInstallments, totalInstallments),
        sql`LOWER(${transactions.description}) LIKE LOWER(${'%' + baseDescription + '%'})`
      )
    )
    .limit(1);

  if (results.length === 0) return null;

  const tx = results[0];

  // Get existing entry numbers for this transaction
  const existingEntries = await db
    .select({ installmentNumber: entries.installmentNumber })
    .from(entries)
    .where(eq(entries.transactionId, tx.id));

  return {
    id: tx.id,
    existingEntryNumbers: existingEntries.map((e) => e.installmentNumber),
  };
}

// Helper: Compute entry dates for installment
type EntryDateInfo = {
  purchaseDate: string; // YYYY-MM-DD
  faturaMonth: string; // YYYY-MM
  dueDate: string; // YYYY-MM-DD
};

type AccountInfo = {
  type: string;
  closingDay: number | null;
  paymentDueDay: number | null;
};

function computeEntryDates(
  basePurchaseDate: string,
  installmentNumber: number,
  account: AccountInfo
): EntryDateInfo {
  // Calculate purchase date for this installment
  const baseDate = new Date(basePurchaseDate + 'T00:00:00Z');
  const installmentDate = new Date(baseDate);
  installmentDate.setUTCMonth(installmentDate.getUTCMonth() + (installmentNumber - 1));

  const purchaseDate = installmentDate.toISOString().split('T')[0];

  const hasBillingConfig =
    account.type === 'credit_card' && account.closingDay && account.paymentDueDay;

  if (hasBillingConfig) {
    const faturaMonth = getFaturaMonth(installmentDate, account.closingDay!);
    const dueDate = getFaturaPaymentDueDate(faturaMonth, account.paymentDueDay!, account.closingDay!);
    return { purchaseDate, faturaMonth, dueDate };
  }

  // Fallback for non-CC accounts
  return {
    purchaseDate,
    faturaMonth: purchaseDate.slice(0, 7),
    dueDate: purchaseDate,
  };
}

// Helper: Calculate base purchase date from imported rows
function calculateBasePurchaseDate(rows: ValidatedImportRow[]): string {
  // Find earliest installment in import
  const earliest = rows.reduce((min, r) =>
    r.installmentInfo!.current < min.installmentInfo!.current ? r : min,
    rows[0]
  );

  const info = earliest.installmentInfo!;
  const importedDate = new Date(earliest.date + 'T00:00:00Z');

  // Work backwards: Parcela 3 date - 2 months = Parcela 1 date
  const baseDate = new Date(importedDate);
  baseDate.setUTCMonth(baseDate.getUTCMonth() - (info.current - 1));

  return baseDate.toISOString().split('T')[0];
}

// Helper: Process a group of installment rows
async function processInstallmentGroup(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  rows: ValidatedImportRow[],
  account: AccountInfo & { id: number },
  categoryOverrides: Record<number, number>,
  expenseCategoryId: number,
  affectedFaturas: Set<string>
) {
  // All rows in group have same baseDescription and total
  const firstRow = rows[0];
  const { baseDescription, total } = firstRow.installmentInfo!;

  // Sort by installment number
  rows.sort((a, b) => a.installmentInfo!.current - b.installmentInfo!.current);

  // Check if transaction already exists
  const existing = await findExistingInstallmentTransaction(userId, baseDescription, total);

  // Calculate total amount from per-installment amount
  const installmentAmount = firstRow.amountCents;
  const totalAmount = installmentAmount * total;

  let transactionId: number;
  let entriesToCreate: number[];

  if (existing) {
    // Transaction exists - only create missing entries
    transactionId = existing.id;
    const existingSet = new Set(existing.existingEntryNumbers);
    entriesToCreate = rows
      .map((r) => r.installmentInfo!.current)
      .filter((n) => !existingSet.has(n));
  } else {
    // Determine which entries to create based on imported parcelas
    const minInstallment = rows[0].installmentInfo!.current;

    if (minInstallment === 1) {
      // Parcela 1 present: create all N entries
      entriesToCreate = Array.from({ length: total }, (_, i) => i + 1);
    } else {
      // Parcela M>1 only: create entries from M to N
      entriesToCreate = Array.from(
        { length: total - minInstallment + 1 },
        (_, i) => minInstallment + i
      );
    }

    // Get category from first row
    const categoryId = categoryOverrides[firstRow.rowIndex] ?? expenseCategoryId;

    // Create transaction
    const [transaction] = await tx
      .insert(transactions)
      .values({
        userId,
        description: firstRow.description, // Keep full description with "Parcela X/Y"
        totalAmount,
        totalInstallments: total,
        categoryId,
        externalId: firstRow.externalId,
      })
      .returning();

    transactionId = transaction.id;
  }

  // Create entries for each installment
  const baseDate = calculateBasePurchaseDate(rows);

  for (const installmentNumber of entriesToCreate) {
    const dates = computeEntryDates(baseDate, installmentNumber, account);
    affectedFaturas.add(dates.faturaMonth);

    await tx.insert(entries).values({
      userId,
      transactionId,
      accountId: account.id,
      amount: installmentAmount,
      purchaseDate: dates.purchaseDate,
      faturaMonth: dates.faturaMonth,
      dueDate: dates.dueDate,
      installmentNumber,
      paidAt: null,
    });
  }
}

export async function importMixed(data: ImportMixedData): Promise<ImportMixedResult> {
  const { rows, accountId, categoryOverrides = {} } = data;

  if (rows.length === 0) {
    return { success: false, error: await t('errors.noValidRows') };
  }

  // Validate accountId
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return { success: false, error: await t('errors.invalidAccountId') };
  }

  try {
    const userId = await getCurrentUserId();

    const rateLimit = await checkBulkRateLimit(userId);
    if (!rateLimit.allowed) {
      return { success: false, error: await t('errors.tooManyAttempts', { retryAfter: rateLimit.retryAfter }) };
    }

    // Get default import categories
    const defaultCategories = await getDefaultImportCategories();
    if (!defaultCategories.expense) {
      return { success: false, error: await t('errors.noDefaultExpenseCategory') };
    }
    if (!defaultCategories.income) {
      return { success: false, error: await t('errors.noDefaultIncomeCategory') };
    }

    const expenseCategoryId = defaultCategories.expense.id;
    const incomeCategoryId = defaultCategories.income.id;

    // Verify account exists and fetch billing config
    const account = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.id, accountId)))
      .limit(1);

    if (account.length === 0) {
      return { success: false, error: await t('errors.accountNotFound') };
    }

    // Separate rows by type
    const expenseRows = rows.filter((r) => r.type === 'expense');
    const incomeRows = rows.filter((r) => r.type === 'income');

    // Collect external IDs for duplicate detection
    const externalIds = rows.map((r) => r.externalId).filter((id): id is string => !!id);

    // Query existing records with these external IDs
    // Also check transfers table - expenses converted to fatura payments preserve their externalId there
    let existingIds = new Set<string>();

    if (externalIds.length > 0) {
      const existingTransactions = await db
        .select({ externalId: transactions.externalId })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), inArray(transactions.externalId, externalIds)));

      const existingIncome = await db
        .select({ externalId: income.externalId })
        .from(income)
        .where(and(eq(income.userId, userId), inArray(income.externalId, externalIds)));

      // Check transfers for externalIds from expenses that were converted to fatura payments
      const existingTransfers = await db
        .select({ externalId: transfers.externalId })
        .from(transfers)
        .where(and(eq(transfers.userId, userId), inArray(transfers.externalId, externalIds)));

      existingIds = new Set([
        ...existingTransactions.map((t) => t.externalId).filter((id): id is string => !!id),
        ...existingIncome.map((i) => i.externalId).filter((id): id is string => !!id),
        ...existingTransfers.map((t) => t.externalId).filter((id): id is string => !!id),
      ]);
    }

    // Filter out duplicates
    const newExpenses = expenseRows.filter((r) => !r.externalId || !existingIds.has(r.externalId));
    const newIncome = incomeRows.filter((r) => !r.externalId || !existingIds.has(r.externalId));
    const skippedDuplicates = rows.length - newExpenses.length - newIncome.length;

    // Check if this is a credit card with billing config
    const isCreditCard = account[0].type === 'credit_card';
    const hasBillingConfig = isCreditCard && account[0].closingDay && account[0].paymentDueDay;

    // Track affected fatura months for credit card accounts
    const affectedFaturas = new Set<string>();

    // Separate installment and regular expenses
    const installmentExpenses = newExpenses.filter((r) => r.installmentInfo);
    const regularExpenses = newExpenses.filter((r) => !r.installmentInfo);

    // Group installment expenses by base description + total
    const installmentGroups = new Map<string, ValidatedImportRow[]>();
    for (const row of installmentExpenses) {
      const info = row.installmentInfo!;
      const key = `${info.baseDescription.toLowerCase()}|${info.total}`;
      if (!installmentGroups.has(key)) {
        installmentGroups.set(key, []);
      }
      installmentGroups.get(key)!.push(row);
    }

    // Import all new records in a transaction
    await db.transaction(async (tx) => {
      // Process installment groups
      for (const [, rows] of installmentGroups) {
        await processInstallmentGroup(
          tx,
          userId,
          rows,
          account[0],
          categoryOverrides,
          expenseCategoryId,
          affectedFaturas
        );
      }

      // Insert regular expenses
      for (const row of regularExpenses) {
        const categoryId = categoryOverrides[row.rowIndex] ?? expenseCategoryId;

        let faturaMonth: string;
        let dueDate: string;

        if (hasBillingConfig) {
          const purchaseDate = new Date(row.date + 'T00:00:00Z');
          faturaMonth = getFaturaMonth(purchaseDate, account[0].closingDay!);
          dueDate = getFaturaPaymentDueDate(faturaMonth, account[0].paymentDueDay!, account[0].closingDay!);
          affectedFaturas.add(faturaMonth);
        } else {
          faturaMonth = row.date.slice(0, 7);
          dueDate = row.date;
        }

        const [transaction] = await tx
          .insert(transactions)
          .values({
            userId,
            description: row.description,
            totalAmount: row.amountCents,
            totalInstallments: 1,
            categoryId,
            externalId: row.externalId,
          })
          .returning();

        await tx.insert(entries).values({
          userId,
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

      // Insert income (marked as received)
      for (const row of newIncome) {
        const categoryId = categoryOverrides[row.rowIndex] ?? incomeCategoryId;

        await tx.insert(income).values({
          userId,
          description: row.description,
          amount: row.amountCents,
          categoryId,
          accountId,
          receivedDate: row.date,
          receivedAt: new Date(), // Mark as received
          externalId: row.externalId,
        });
      }
    });

    // Ensure faturas exist and update totals for credit cards
    if (hasBillingConfig && affectedFaturas.size > 0) {
      for (const month of affectedFaturas) {
        await ensureFaturaExists(accountId, month);
        await updateFaturaTotal(accountId, month);
      }
    }

    await syncAccountBalance(accountId);

    revalidatePath('/expenses');
    revalidatePath('/dashboard');
    revalidatePath('/faturas');
    revalidatePath('/income');
    revalidatePath('/settings/accounts');

    return {
      success: true,
      importedExpenses: newExpenses.length,
      importedIncome: newIncome.length,
      skippedDuplicates,
    };
  } catch (error) {
    console.error('[import:mixed] Failed:', error);
    return { success: false, error: await handleDbError(error, 'errors.failedToImport') };
  }
}
