'use server';

import { db } from '@/lib/db';
import { transactions, entries, accounts, categories, income, transfers, categoryFrequency } from '@/lib/schema';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import type { ValidatedImportRow, CategorySuggestion } from '@/lib/import/types';
import { computeFaturaWindowStart, getFaturaMonth, getFaturaPaymentDueDate } from '@/lib/fatura-utils';
import { addMonths } from '@/lib/utils';
import { ensureFaturaExists, updateFaturaTotal } from '@/lib/actions/faturas';
import { syncAccountBalance } from '@/lib/actions/accounts';
import { getDefaultImportCategories } from '@/lib/actions/categories';
import { getCurrentUserId } from '@/lib/auth';
import { checkBulkRateLimit } from '@/lib/rate-limit';
import { t } from '@/lib/i18n/server-errors';
import { handleDbError } from '@/lib/db-errors';
import { bulkIncrementCategoryFrequency } from '@/lib/actions/category-frequency';

type SuggestionsInput = {
  expenseDescriptions: string[];
  incomeDescriptions: string[];
};

type SuggestionsResult = {
  expense: Record<string, CategorySuggestion>;
  income: Record<string, CategorySuggestion>;
};

async function fetchExistingExternalIds(
  userId: string,
  externalIds: string[]
): Promise<Set<string>> {
  const uniqueIds = Array.from(new Set(externalIds.filter((id): id is string => !!id)));

  if (uniqueIds.length === 0) {
    return new Set<string>();
  }

  const [existingTransactions, existingIncome, existingTransfers] = await Promise.all([
    db
      .select({ externalId: transactions.externalId })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), inArray(transactions.externalId, uniqueIds))),
    db
      .select({ externalId: income.externalId })
      .from(income)
      .where(and(eq(income.userId, userId), inArray(income.externalId, uniqueIds))),
    db
      .select({ externalId: transfers.externalId })
      .from(transfers)
      .where(and(eq(transfers.userId, userId), inArray(transfers.externalId, uniqueIds))),
  ]);

  return new Set([
    ...existingTransactions.map((t) => t.externalId).filter((id): id is string => !!id),
    ...existingIncome.map((i) => i.externalId).filter((id): id is string => !!id),
    ...existingTransfers.map((t) => t.externalId).filter((id): id is string => !!id),
  ]);
}

export async function getCategorySuggestions(
  input: SuggestionsInput
): Promise<SuggestionsResult> {
  const { expenseDescriptions, incomeDescriptions } = input;
  const userId = await getCurrentUserId();

  const expenseMap: Record<string, CategorySuggestion> = {};
  const incomeMap: Record<string, CategorySuggestion> = {};

  // Helper to normalize descriptions
  const normalizeDescription = (desc: string) => desc.trim().toLowerCase();

  if (expenseDescriptions.length > 0) {
    // Create map from normalized to original descriptions
    const normalizedToOriginal = expenseDescriptions.reduce(
      (acc, desc) => {
        const normalized = normalizeDescription(desc);
        if (!acc[normalized]) {
          acc[normalized] = desc; // Keep first occurrence as canonical
        }
        return acc;
      },
      {} as Record<string, string>
    );

    const normalizedDescriptions = Object.keys(normalizedToOriginal);

    const expenseFrequency = await db
      .select({
        descriptionNormalized: categoryFrequency.descriptionNormalized,
        categoryId: categoryFrequency.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        count: categoryFrequency.count,
        lastUsedAt: categoryFrequency.lastUsedAt,
      })
      .from(categoryFrequency)
      .innerJoin(categories, eq(categoryFrequency.categoryId, categories.id))
      .where(
        and(
          eq(categoryFrequency.userId, userId),
          eq(categoryFrequency.type, 'expense'),
          inArray(categoryFrequency.descriptionNormalized, normalizedDescriptions)
        )
      )
      .orderBy(desc(categoryFrequency.count), desc(categoryFrequency.lastUsedAt));

    for (const record of expenseFrequency) {
      const originalDescription = normalizedToOriginal[record.descriptionNormalized];
      if (originalDescription && !expenseMap[originalDescription]) {
        expenseMap[originalDescription] = {
          id: record.categoryId,
          name: record.categoryName,
          color: record.categoryColor,
        };
      }
    }
  }

  if (incomeDescriptions.length > 0) {
    // Create map from normalized to original descriptions
    const normalizedToOriginal = incomeDescriptions.reduce(
      (acc, desc) => {
        const normalized = normalizeDescription(desc);
        if (!acc[normalized]) {
          acc[normalized] = desc; // Keep first occurrence as canonical
        }
        return acc;
      },
      {} as Record<string, string>
    );

    const normalizedDescriptions = Object.keys(normalizedToOriginal);

    const incomeFrequency = await db
      .select({
        descriptionNormalized: categoryFrequency.descriptionNormalized,
        categoryId: categoryFrequency.categoryId,
        categoryName: categories.name,
        categoryColor: categories.color,
        count: categoryFrequency.count,
        lastUsedAt: categoryFrequency.lastUsedAt,
      })
      .from(categoryFrequency)
      .innerJoin(categories, eq(categoryFrequency.categoryId, categories.id))
      .where(
        and(
          eq(categoryFrequency.userId, userId),
          eq(categoryFrequency.type, 'income'),
          inArray(categoryFrequency.descriptionNormalized, normalizedDescriptions)
        )
      )
      .orderBy(desc(categoryFrequency.count), desc(categoryFrequency.lastUsedAt));

    for (const record of incomeFrequency) {
      const originalDescription = normalizedToOriginal[record.descriptionNormalized];
      if (originalDescription && !incomeMap[originalDescription]) {
        incomeMap[originalDescription] = {
          id: record.categoryId,
          name: record.categoryName,
          color: record.categoryColor,
        };
      }
    }
  }

  return { expense: expenseMap, income: incomeMap };
}

export async function checkDuplicates(externalIds: string[]): Promise<string[]> {
  const userId = await getCurrentUserId();
  const existingIds = await fetchExistingExternalIds(userId, externalIds);
  return Array.from(existingIds);
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
  faturaOverrides?: { startDate?: string; closingDate?: string; dueDate?: string };
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
type DbClient = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

async function findExistingInstallmentTransaction(
  dbClient: DbClient,
  userId: string,
  baseDescription: string,
  totalInstallments: number
): Promise<{ id: number; existingEntryNumbers: number[] } | null> {
  // Find transaction by description pattern (case-insensitive) and installment count
  const results = await dbClient
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
  const existingEntries = await dbClient
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

/**
 * Computes the entry dates for an installment.
 *
 * For credit cards with billing config:
 * - First installment (installmentNumber=1): uses actual purchase date
 * - Subsequent installments: uses fatura window start date
 *
 * @param basePurchaseDate - The original purchase date (for first installment)
 * @param installmentNumber - Which installment (1, 2, 3, ...)
 * @param account - Account info with closingDay and paymentDueDay
 * @returns Entry dates (purchaseDate, faturaMonth, dueDate)
 */
function computeEntryDates(
  basePurchaseDate: string,
  installmentNumber: number,
  account: AccountInfo
): EntryDateInfo {
  const baseDate = new Date(basePurchaseDate + 'T00:00:00Z');

  const hasBillingConfig =
    account.type === 'credit_card' && account.closingDay && account.paymentDueDay;

  if (hasBillingConfig) {
    // Calculate base fatura month from the original purchase date
    const baseFaturaMonth = getFaturaMonth(baseDate, account.closingDay!);

    // Calculate the fatura month for this installment
    const faturaMonth = addMonths(baseFaturaMonth, installmentNumber - 1);
    const dueDate = getFaturaPaymentDueDate(faturaMonth, account.paymentDueDay!, account.closingDay!);

    let purchaseDate: string;
    if (installmentNumber === 1) {
      // First installment: use actual purchase date
      purchaseDate = basePurchaseDate;
    } else {
      // Subsequent installments: use fatura window start date
      // This places them at the first day of their respective billing period
      purchaseDate = computeFaturaWindowStart(faturaMonth, account.closingDay!);
    }

    return { purchaseDate, faturaMonth, dueDate };
  }

  // Fallback for non-CC accounts: increment months on purchase date
  const installmentDate = new Date(baseDate);
  installmentDate.setUTCMonth(installmentDate.getUTCMonth() + (installmentNumber - 1));
  const purchaseDate = installmentDate.toISOString().split('T')[0];

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

  const rowAmounts = new Map<number, number>();
  for (const row of rows) {
    rowAmounts.set(row.installmentInfo!.current, row.amountCents);
  }

  // Check if transaction already exists
  const existing = await findExistingInstallmentTransaction(tx, userId, baseDescription, total);

  const fallbackAmount = firstRow.amountCents;
  const getInstallmentAmount = (
    installmentNumber: number,
    existingAmounts: Map<number, number>
  ) => rowAmounts.get(installmentNumber) ?? existingAmounts.get(installmentNumber) ?? fallbackAmount;

  let transactionId: number;
  let entriesToCreate: number[];
  let existingAmounts = new Map<number, number>();
  let existingEntryIds = new Map<number, number>();

  if (existing) {
    // Transaction exists - only create missing entries
    transactionId = existing.id;
    const existingEntries = await tx
      .select({
        id: entries.id,
        installmentNumber: entries.installmentNumber,
        amount: entries.amount,
      })
      .from(entries)
      .where(eq(entries.transactionId, transactionId));

    existingAmounts = new Map(
      existingEntries.map((entry) => [entry.installmentNumber, entry.amount])
    );
    existingEntryIds = new Map(existingEntries.map((entry) => [entry.installmentNumber, entry.id]));

    const existingSet = new Set(existingEntries.map((entry) => entry.installmentNumber));
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

    const totalAmount = Array.from({ length: total }, (_, i) =>
      getInstallmentAmount(i + 1, existingAmounts)
    ).reduce((sum, amount) => sum + amount, 0);

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

  if (existing) {
    for (const row of rows) {
      const installmentNumber = row.installmentInfo!.current;
      const entryId = existingEntryIds.get(installmentNumber);
      if (!entryId) continue;

      const existingAmount = existingAmounts.get(installmentNumber);
      if (existingAmount === row.amountCents) continue;

      await tx
        .update(entries)
        .set({ amount: row.amountCents })
        .where(eq(entries.id, entryId));

      existingAmounts.set(installmentNumber, row.amountCents);

      const dates = computeEntryDates(baseDate, installmentNumber, account);
      affectedFaturas.add(dates.faturaMonth);
    }
  }

  for (const installmentNumber of entriesToCreate) {
    const dates = computeEntryDates(baseDate, installmentNumber, account);
    affectedFaturas.add(dates.faturaMonth);

    await tx.insert(entries).values({
      userId,
      transactionId,
      accountId: account.id,
      amount: getInstallmentAmount(installmentNumber, existingAmounts),
      purchaseDate: dates.purchaseDate,
      faturaMonth: dates.faturaMonth,
      dueDate: dates.dueDate,
      installmentNumber,
      paidAt: null,
    });

    existingAmounts.set(installmentNumber, getInstallmentAmount(installmentNumber, existingAmounts));
  }

  if (existing) {
    const totalAmount = Array.from({ length: total }, (_, i) =>
      getInstallmentAmount(i + 1, existingAmounts)
    ).reduce((sum, amount) => sum + amount, 0);

    await tx.update(transactions).set({ totalAmount }).where(eq(transactions.id, transactionId));
  }
}

export async function importMixed(data: ImportMixedData): Promise<ImportMixedResult> {
  const { rows, accountId, categoryOverrides = {}, faturaOverrides } = data;

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
    const existingIds = await fetchExistingExternalIds(userId, externalIds);

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
        await ensureFaturaExists(accountId, month, faturaOverrides);
        await updateFaturaTotal(accountId, month);
      }
    }

    await syncAccountBalance(accountId);

    // Track category frequencies for imported records
    const frequencyItems: Array<{ description: string; categoryId: number; type: 'expense' | 'income' }> = [];

    // Add all imported expenses
    for (const row of newExpenses) {
      const categoryId = categoryOverrides[row.rowIndex] ?? expenseCategoryId;
      frequencyItems.push({
        description: row.installmentInfo?.baseDescription ?? row.description,
        categoryId,
        type: 'expense',
      });
    }

    // Add all imported income
    for (const row of newIncome) {
      const categoryId = categoryOverrides[row.rowIndex] ?? incomeCategoryId;
      frequencyItems.push({
        description: row.description,
        categoryId,
        type: 'income',
      });
    }

    if (frequencyItems.length > 0) {
      await bulkIncrementCategoryFrequency(userId, frequencyItems);
    }

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
