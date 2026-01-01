/**
 * One-time script to backfill fatura records for existing credit card entries.
 *
 * Run with: npx tsx drizzle/backfill-faturas.ts
 */

import { backfillFaturas } from '@/lib/actions/faturas';

async function main() {
  console.log('Starting fatura backfill...');

  try {
    const result = await backfillFaturas();
    console.log(`✓ Successfully created ${result.created} fatura records`);
  } catch (error) {
    console.error('✗ Backfill failed:', error);
    process.exit(1);
  }
}

main();
