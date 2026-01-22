/**
 * Import missing transactions from OFX files
 */

import { db } from '@/lib/db';
import { accounts, transactions, entries, faturas, income } from '@/lib/schema';
import { eq, sql } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { nubankOfxParser } from '@/lib/import/parsers/nubank-ofx';
import { getFaturaMonth, getFaturaPaymentDueDate } from '@/lib/fatura-utils';

async function importMissing() {
  console.log('═══════════════════════════════════════════════════');
  console.log('IMPORTING MISSING TRANSACTIONS');
  console.log('═══════════════════════════════════════════════════\n');

  // Get credit card account
  const account = await db
    .select({
      id: accounts.id,
      userId: accounts.userId,
      closingDay: accounts.closingDay,
      paymentDueDay: accounts.paymentDueDay,
    })
    .from(accounts)
    .where(eq(accounts.type, 'credit_card'))
    .limit(1);

  if (!account[0]) {
    console.error('✗ No credit card account found');
    return;
  }

  const { id: accountId, userId, closingDay, paymentDueDay } = account[0];

  if (!closingDay || !paymentDueDay) {
    console.error('✗ Account missing billing config');
    return;
  }

  // Get existing external IDs
  const existingTxns = await db
    .select({ externalId: transactions.externalId })
    .from(transactions)
    .where(sql`${transactions.externalId} IS NOT NULL`);

  const existingIds = new Set(existingTxns.map(t => t.externalId));

  console.log(`Database has ${existingIds.size} transactions\n`);

  // Import December OFX
  console.log('📄 Importing December OFX...');
  const decOfx = readFileSync('Nubank_2025-12-08.ofx', 'utf-8');
  const decParsed = nubankOfxParser.parse(decOfx);

  let decImported = 0;
  const decAffectedFaturas = new Set<string>();

  for (const row of decParsed.rows) {
    // Skip if already exists
    if (row.externalId && existingIds.has(row.externalId)) {
      continue;
    }

    // Skip fatura payments
    // TODO: Add proper fatura payment detection (isFaturaPayment property removed)
    // if (row.isFaturaPayment) {
    //   console.log(`  Skipping fatura payment: ${row.description}`);
    //   continue;
    // }

    // Skip income/refunds for now (need special handling)
    if (row.type === 'income') {
      console.log(`  Skipping income: ${row.description}`);
      continue;
    }

    // Calculate fatura month
    const purchaseDate = new Date(row.date + 'T00:00:00Z');
    const faturaMonth = getFaturaMonth(purchaseDate, closingDay);
    const dueDate = getFaturaPaymentDueDate(faturaMonth, paymentDueDay, closingDay);

    // Handle installments
    const totalInstallments = row.installmentInfo?.total || 1;
    const installmentNumber = row.installmentInfo?.current || 1;
    const baseDescription = row.installmentInfo?.baseDescription || row.description;

    // Check if transaction exists (for multi-installment)
    const existingTransaction = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        sql`${transactions.userId} = ${userId}
        AND ${transactions.description} = ${baseDescription}
        AND ${transactions.totalInstallments} = ${totalInstallments}`
      )
      .limit(1);

    let transactionId: number;

    if (existingTransaction[0]) {
      // Use existing transaction
      transactionId = existingTransaction[0].id;
      console.log(`  Using existing transaction: ${baseDescription} (${installmentNumber}/${totalInstallments})`);
    } else {
      // Create new transaction
      const [newTxn] = await db
        .insert(transactions)
        .values({
          userId,
          description: baseDescription,
          totalAmount: row.amountCents,
          totalInstallments,
          categoryId: 1, // Default category - user can change later
          externalId: row.externalId,
        })
        .returning();

      transactionId = newTxn.id;
      console.log(`  Created transaction: ${baseDescription} (1/${totalInstallments})`);
    }

    // Create entry
    await db.insert(entries).values({
      userId,
      transactionId,
      accountId,
      amount: row.amountCents,
      purchaseDate: row.date,
      faturaMonth,
      dueDate,
      installmentNumber,
      paidAt: null,
    });

    decAffectedFaturas.add(faturaMonth);
    decImported++;
    console.log(`  ✓ Imported: ${row.description} (${faturaMonth})`);
  }

  console.log(`\n✓ December: Imported ${decImported} transactions\n`);

  // Import January OFX
  console.log('📄 Importing January OFX...');
  const janOfx = readFileSync('Nubank_2026-01-08.ofx', 'utf-8');
  const janParsed = nubankOfxParser.parse(janOfx);

  let janImported = 0;
  const janAffectedFaturas = new Set<string>();

  for (const row of janParsed.rows) {
    // Skip if already exists
    if (row.externalId && existingIds.has(row.externalId)) {
      continue;
    }

    // Skip fatura payments
    // TODO: Add proper fatura payment detection (isFaturaPayment property removed)
    // if (row.isFaturaPayment) {
    //   console.log(`  Skipping fatura payment: ${row.description}`);
    //   continue;
    // }

    // Skip income/refunds
    if (row.type === 'income') {
      console.log(`  Skipping income: ${row.description}`);
      continue;
    }

    // Calculate fatura month
    const purchaseDate = new Date(row.date + 'T00:00:00Z');
    const faturaMonth = getFaturaMonth(purchaseDate, closingDay);
    const dueDate = getFaturaPaymentDueDate(faturaMonth, paymentDueDay, closingDay);

    // Handle installments
    const totalInstallments = row.installmentInfo?.total || 1;
    const installmentNumber = row.installmentInfo?.current || 1;
    const baseDescription = row.installmentInfo?.baseDescription || row.description;

    // Check if transaction exists
    const existingTransaction = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(
        sql`${transactions.userId} = ${userId}
        AND ${transactions.description} = ${baseDescription}
        AND ${transactions.totalInstallments} = ${totalInstallments}`
      )
      .limit(1);

    let transactionId: number;

    if (existingTransaction[0]) {
      transactionId = existingTransaction[0].id;
      console.log(`  Using existing transaction: ${baseDescription} (${installmentNumber}/${totalInstallments})`);
    } else {
      const [newTxn] = await db
        .insert(transactions)
        .values({
          userId,
          description: baseDescription,
          totalAmount: row.amountCents,
          totalInstallments,
          categoryId: 1,
          externalId: row.externalId,
        })
        .returning();

      transactionId = newTxn.id;
      console.log(`  Created transaction: ${baseDescription} (1/${totalInstallments})`);
    }

    // Create entry
    await db.insert(entries).values({
      userId,
      transactionId,
      accountId,
      amount: row.amountCents,
      purchaseDate: row.date,
      faturaMonth,
      dueDate,
      installmentNumber,
      paidAt: null,
    });

    janAffectedFaturas.add(faturaMonth);
    janImported++;
    console.log(`  ✓ Imported: ${row.description} (${faturaMonth})`);
  }

  console.log(`\n✓ January: Imported ${janImported} transactions\n`);

  // Recalculate affected faturas
  const allAffectedFaturas = [...new Set([...decAffectedFaturas, ...janAffectedFaturas])];

  if (allAffectedFaturas.length > 0) {
    console.log('📊 Recalculating fatura totals...');

    await db.execute(sql`
      UPDATE faturas
      SET total_amount = COALESCE(entries_total, 0) - COALESCE(refunds_total, 0)
      FROM (
        SELECT
          e.user_id,
          e.account_id,
          e.fatura_month AS year_month,
          SUM(e.amount) AS entries_total
        FROM entries e
        WHERE e.user_id = ${userId}
          AND e.account_id = ${accountId}
          AND e.fatura_month IN (${sql.join(allAffectedFaturas.map(f => sql`${f}`), sql`, `)})
        GROUP BY e.user_id, e.account_id, e.fatura_month
      ) AS entries_agg
      FULL OUTER JOIN (
        SELECT
          i.user_id,
          i.account_id,
          i.fatura_month AS year_month,
          SUM(i.amount) AS refunds_total
        FROM income i
        WHERE i.user_id = ${userId}
          AND i.account_id = ${accountId}
          AND i.fatura_month IN (${sql.join(allAffectedFaturas.map(f => sql`${f}`), sql`, `)})
        GROUP BY i.user_id, i.account_id, i.fatura_month
      ) AS refunds_agg
      ON entries_agg.user_id = refunds_agg.user_id
        AND entries_agg.account_id = refunds_agg.account_id
        AND entries_agg.year_month = refunds_agg.year_month
      WHERE faturas.user_id = ${userId}
        AND faturas.account_id = ${accountId}
        AND faturas.year_month = COALESCE(entries_agg.year_month, refunds_agg.year_month)
    `);

    console.log('✓ Fatura totals recalculated\n');
  }

  // Verify final totals
  console.log('📊 Final Verification:');
  console.log('─────────────────────────────────────────────────\n');

  const finalTotals = await db
    .select({
      yearMonth: faturas.yearMonth,
      totalAmount: sql<number>`${faturas.totalAmount} / 100.0`,
    })
    .from(faturas)
    .where(
      sql`${faturas.accountId} = ${accountId}
      AND ${faturas.yearMonth} IN ('2025-12', '2026-01')`
    );

  console.table(finalTotals);

  const decTotal = parseFloat(finalTotals.find(f => f.yearMonth === '2025-12')?.totalAmount as any) || 0;
  const janTotal = parseFloat(finalTotals.find(f => f.yearMonth === '2026-01')?.totalAmount as any) || 0;

  console.log('\nComparison with OFX:');
  console.log(`December: R$ ${decTotal.toFixed(2)} vs R$ 7691.23 (diff: ${(7691.23 - decTotal).toFixed(2)})`);
  console.log(`January:  R$ ${janTotal.toFixed(2)} vs R$ 4977.14 (diff: ${(4977.14 - janTotal).toFixed(2)})`);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('IMPORT COMPLETE');
  console.log('═══════════════════════════════════════════════════\n');
}

importMissing()
  .then(() => {
    console.log('✓ Import completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Import failed:', error);
    process.exit(1);
  });
