/**
 * One-time migration script to fix fatura_month on entries.
 *
 * Problem: Entries were assigned to fatura based on purchase month instead of
 * using the closing day logic. For closing_day=1, a purchase on Dec 15 should
 * go to January's fatura, not December's.
 *
 * Run with: npx tsx drizzle/fix-fatura-months.ts
 */

import 'dotenv/config';
import { db } from '@/lib/db';
import { faturas, entries, accounts } from '@/lib/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getFaturaMonth, getFaturaPaymentDueDate } from '@/lib/fatura-utils';

interface MigrationStats {
  entriesUpdated: number;
  faturasCreated: number;
  totalsRecalculated: number;
}

async function fixFaturaMonths(): Promise<MigrationStats> {
  const stats: MigrationStats = {
    entriesUpdated: 0,
    faturasCreated: 0,
    totalsRecalculated: 0,
  };

  console.log('🔍 Starting fatura month migration...\n');

  // Step 1: Fix entries.fatura_month and due_date
  console.log('💳 Step 1: Recalculating fatura_month for all credit card entries...');

  const creditCardAccounts = await db
    .select()
    .from(accounts)
    .where(eq(accounts.type, 'credit_card'));

  for (const account of creditCardAccounts) {
    console.log(`\n  Processing ${account.name}...`);

    const accountEntries = await db
      .select()
      .from(entries)
      .where(eq(entries.accountId, account.id));

    for (const entry of accountEntries) {
      const purchaseDate = new Date(entry.purchaseDate);
      const correctFaturaMonth = getFaturaMonth(purchaseDate, account.closingDay || 1);
      const correctDueDate = getFaturaPaymentDueDate(
        correctFaturaMonth,
        account.paymentDueDay || 7,
        account.closingDay || 1
      );

      if (entry.faturaMonth !== correctFaturaMonth || entry.dueDate !== correctDueDate) {
        await db
          .update(entries)
          .set({
            faturaMonth: correctFaturaMonth,
            dueDate: correctDueDate,
          })
          .where(eq(entries.id, entry.id));

        console.log(
          `    ✓ Entry ${entry.id}: ${entry.purchaseDate} → fatura ${entry.faturaMonth} → ${correctFaturaMonth}, due ${correctDueDate}`
        );
        stats.entriesUpdated++;
      }
    }

    console.log(`  Updated ${stats.entriesUpdated} entries for ${account.name}`);
  }
  console.log(`\n  Total entries updated: ${stats.entriesUpdated}\n`);

  // Step 2: Create missing faturas for new fatura months
  console.log('🆕 Step 2: Creating missing fatura records...');

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

  // Step 3: Recalculate all fatura totals (including setting some to 0)
  console.log('💰 Step 3: Recalculating all fatura totals...');

  const allFaturas = await db.select().from(faturas);

  for (const fatura of allFaturas) {
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
        `  ✓ Fatura ${fatura.yearMonth}: R$ ${(fatura.totalAmount / 100).toFixed(
          2
        )} → R$ ${(totalAmount / 100).toFixed(2)}`
      );
      stats.totalsRecalculated++;
    }
  }
  console.log(`  Recalculated ${stats.totalsRecalculated} fatura totals\n`);

  return stats;
}

async function main() {
  try {
    console.log('🚀 Starting fatura month migration...\n');

    const stats = await fixFaturaMonths();

    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`  - Entries updated: ${stats.entriesUpdated}`);
    console.log(`  - Faturas created: ${stats.faturasCreated}`);
    console.log(`  - Totals recalculated: ${stats.totalsRecalculated}`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

main();
