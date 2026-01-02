/**
 * One-time migration script to fix fatura due dates in production database.
 *
 * Issues fixed:
 * 1. Faturas have due_date one month too late
 * 2. Entries have incorrect due_date (either = purchase_date or one month late)
 * 3. Missing fatura records for some months
 *
 * Run with: npx tsx drizzle/fix-fatura-due-dates.ts
 */

import 'dotenv/config';
import { db } from '@/lib/db';
import { faturas, entries, accounts } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getFaturaPaymentDueDate } from '@/lib/fatura-utils';

interface UpdateStats {
  faturasFixed: number;
  entriesFixed: number;
  faturasCreated: number;
  totalsUpdated: number;
}

async function fixFaturaDueDates(): Promise<UpdateStats> {
  const stats: UpdateStats = {
    faturasFixed: 0,
    entriesFixed: 0,
    faturasCreated: 0,
    totalsUpdated: 0,
  };

  console.log('🔍 Starting fatura due date migration...\n');

  // Step 1: Fix faturas.due_date
  console.log('📋 Step 1: Fixing faturas.due_date...');
  const allFaturas = await db
    .select({
      id: faturas.id,
      accountId: faturas.accountId,
      yearMonth: faturas.yearMonth,
      currentDueDate: faturas.dueDate,
      paymentDueDay: accounts.paymentDueDay,
      closingDay: accounts.closingDay,
    })
    .from(faturas)
    .innerJoin(accounts, eq(faturas.accountId, accounts.id));

  for (const fatura of allFaturas) {
    const correctDueDate = getFaturaPaymentDueDate(
      fatura.yearMonth,
      fatura.paymentDueDay || 7,
      fatura.closingDay || 1
    );

    if (fatura.currentDueDate !== correctDueDate) {
      await db
        .update(faturas)
        .set({ dueDate: correctDueDate })
        .where(eq(faturas.id, fatura.id));

      console.log(
        `  ✓ Fatura ${fatura.yearMonth}: ${fatura.currentDueDate} → ${correctDueDate}`
      );
      stats.faturasFixed++;
    }
  }
  console.log(`  Fixed ${stats.faturasFixed} fatura records\n`);

  // Step 2: Fix entries.due_date for credit card accounts
  console.log('💳 Step 2: Fixing credit card entries.due_date...');
  const creditCardAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.type, 'credit_card'));

  for (const account of creditCardAccounts) {
    const accountEntries = await db
      .select({
        id: entries.id,
        faturaMonth: entries.faturaMonth,
        currentDueDate: entries.dueDate,
      })
      .from(entries)
      .where(eq(entries.accountId, account.id));

    for (const entry of accountEntries) {
      const correctDueDate = getFaturaPaymentDueDate(
        entry.faturaMonth,
        account.paymentDueDay || 7,
        account.closingDay || 1
      );

      if (entry.currentDueDate !== correctDueDate) {
        await db
          .update(entries)
          .set({ dueDate: correctDueDate })
          .where(eq(entries.id, entry.id));

        stats.entriesFixed++;
      }
    }

    console.log(`  ✓ Fixed ${stats.entriesFixed} entries for ${account.name}`);
  }
  console.log(`  Fixed ${stats.entriesFixed} entry records total\n`);

  // Step 3: Create missing faturas
  console.log('🆕 Step 3: Creating missing fatura records...');
  const distinctCombinations = await db
    .selectDistinct({
      accountId: entries.accountId,
      faturaMonth: entries.faturaMonth,
    })
    .from(entries)
    .innerJoin(accounts, eq(entries.accountId, accounts.id))
    .where(eq(accounts.type, 'credit_card'));

  for (const combo of distinctCombinations) {
    const existing = await db
      .select()
      .from(faturas)
      .where(
        and(
          eq(faturas.accountId, combo.accountId),
          eq(faturas.yearMonth, combo.faturaMonth)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      const account = await db
        .select()
        .from(accounts)
        .where(eq(accounts.id, combo.accountId))
        .limit(1);

      const paymentDueDay = account[0].paymentDueDay || 7;
      const closingDay = account[0].closingDay || 1;
      const dueDate = getFaturaPaymentDueDate(combo.faturaMonth, paymentDueDay, closingDay);

      await db.insert(faturas).values({
        accountId: combo.accountId,
        yearMonth: combo.faturaMonth,
        totalAmount: 0,
        dueDate,
      });

      console.log(
        `  ✓ Created fatura for ${account[0].name} - ${combo.faturaMonth} (due: ${dueDate})`
      );
      stats.faturasCreated++;
    }
  }
  console.log(`  Created ${stats.faturasCreated} new fatura records\n`);

  // Step 4: Update all fatura totals
  console.log('💰 Step 4: Updating fatura totals...');
  const allFaturasForUpdate = await db.select().from(faturas);

  for (const fatura of allFaturasForUpdate) {
    const result = await db
      .select({ total: sql<number>`COALESCE(SUM(${entries.amount}), 0)` })
      .from(entries)
      .where(
        and(
          eq(entries.accountId, fatura.accountId),
          eq(entries.faturaMonth, fatura.yearMonth)
        )
      );

    const totalAmount = result[0]?.total || 0;

    if (fatura.totalAmount !== totalAmount) {
      await db
        .update(faturas)
        .set({ totalAmount })
        .where(eq(faturas.id, fatura.id));

      console.log(
        `  ✓ Updated ${fatura.yearMonth}: R$ ${(fatura.totalAmount / 100).toFixed(
          2
        )} → R$ ${(totalAmount / 100).toFixed(2)}`
      );
      stats.totalsUpdated++;
    }
  }
  console.log(`  Updated ${stats.totalsUpdated} fatura totals\n`);

  return stats;
}

async function main() {
  try {
    console.log('🚀 Starting database migration...\n');

    const stats = await fixFaturaDueDates();

    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Faturas fixed: ${stats.faturasFixed}`);
    console.log(`  - Entries fixed: ${stats.entriesFixed}`);
    console.log(`  - Faturas created: ${stats.faturasCreated}`);
    console.log(`  - Totals updated: ${stats.totalsUpdated}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
