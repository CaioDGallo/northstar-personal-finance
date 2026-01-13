import 'dotenv/config';

import { db } from '../lib/db';
import { transactions } from '../lib/schema';
import { eq, isNull } from 'drizzle-orm';

// Production safety check
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Cannot run backfill in production without explicit confirmation!');
  process.exit(1);
}

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = !args.includes('--execute');

console.log('🔧 External ID Backfill Script');
console.log(`📍 Database: ${process.env.DATABASE_URL}`);
console.log(`🔄 Mode: ${isDryRun ? 'DRY RUN (use --execute to apply changes)' : 'EXECUTE'}\n`);

/**
 * Generate synthetic external ID using DJB2 hash
 * Copied from /lib/import/parsers/nubank.ts for consistency
 */
function generateSyntheticExternalId(date: string, description: string, amountCents: number): string {
  // Create deterministic string
  const input = `${date}|${description}|${amountCents}`;

  // Use DJB2 hash - fast, deterministic, good distribution
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }

  // Convert to hex format
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `cc-${date}-${hex}`;
}

async function backfillExternalIds() {
  try {
    // 1. Find all transactions without externalId
    console.log('🔍 Querying transactions without externalId...');
    const nullTransactions = await db.query.transactions.findMany({
      where: isNull(transactions.externalId),
      with: {
        entries: {
          orderBy: (entries, { asc }) => [asc(entries.purchaseDate)],
          limit: 1, // We only need the first entry for the date
        },
      },
    });

    console.log(`   Found ${nullTransactions.length} transactions to backfill\n`);

    if (nullTransactions.length === 0) {
      console.log('✅ No transactions need backfilling!');
      return;
    }

    // 2. Process each transaction
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    const conflicts: Array<{ id: number; description: string; externalId: string }> = [];

    for (let i = 0; i < nullTransactions.length; i++) {
      const tx = nullTransactions[i];

      // Progress logging every 10 transactions
      if ((i + 1) % 10 === 0) {
        console.log(`   Progress: ${i + 1}/${nullTransactions.length}`);
      }

      try {
        // Skip if transaction has no entries (orphaned data)
        if (!tx.entries || tx.entries.length === 0) {
          console.log(`   ⚠️  Skipping transaction ${tx.id}: no entries found`);
          skipCount++;
          continue;
        }

        const firstEntry = tx.entries[0];

        // Generate external ID
        const externalId = generateSyntheticExternalId(
          firstEntry.purchaseDate,
          tx.description,
          tx.totalAmount
        );

        // Check for conflicts (external ID already exists)
        const existing = await db.query.transactions.findFirst({
          where: eq(transactions.externalId, externalId),
        });

        if (existing) {
          console.log(`   ⚠️  Conflict: Transaction ${tx.id} would generate duplicate externalId: ${externalId}`);
          conflicts.push({ id: tx.id, description: tx.description, externalId });
          skipCount++;
          continue;
        }

        // Update transaction
        if (!isDryRun) {
          await db.update(transactions)
            .set({ externalId })
            .where(eq(transactions.id, tx.id));
        }

        successCount++;

        // Show sample of first 5 updates
        if (successCount <= 5) {
          console.log(`   ${isDryRun ? '[DRY RUN]' : '✓'} Transaction ${tx.id}: "${tx.description}" → ${externalId}`);
        }
      } catch (error) {
        console.error(`   ❌ Error processing transaction ${tx.id}:`, error);
        errorCount++;
      }
    }

    // 3. Report results
    console.log('\n📊 Backfill Summary:');
    console.log(`   Total transactions: ${nullTransactions.length}`);
    console.log(`   ${isDryRun ? 'Would update' : 'Updated'}: ${successCount}`);
    console.log(`   Skipped: ${skipCount}`);
    console.log(`   Errors: ${errorCount}`);

    if (conflicts.length > 0) {
      console.log(`\n⚠️  Conflicts detected (${conflicts.length}):`);
      conflicts.forEach(c => {
        console.log(`   - Transaction ${c.id}: ${c.description} → ${c.externalId}`);
      });
      console.log('\n   These transactions already have duplicates and cannot be backfilled.');
    }

    if (isDryRun) {
      console.log('\n💡 This was a dry run. Use --execute to apply changes.');
    } else {
      console.log('\n✅ Backfill complete!');
    }

    // Exit with error code if there were errors
    if (errorCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  }
}

// Run the backfill
backfillExternalIds();
