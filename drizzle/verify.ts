import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(__dirname, '../.env.local') });

import { db } from '../lib/db';
import { accounts, categories, budgets, transactions, entries } from '../lib/schema';

async function verify() {
  console.log('🔍 Verifying database contents...\n');
  console.log(`📍 Target: ${process.env.TURSO_DATABASE_URL || 'file:./local.db'}`);
  console.log(`🔑 Auth Token: ${process.env.TURSO_AUTH_TOKEN ? 'SET (' + process.env.TURSO_AUTH_TOKEN.substring(0,20) + '...)' : 'NOT SET'}\n`);

  const [accountsList, categoriesList, budgetsList, transactionsList, entriesList] = await Promise.all([
    db.select().from(accounts),
    db.select().from(categories),
    db.select().from(budgets),
    db.select().from(transactions),
    db.select().from(entries),
  ]);

  console.log(`Accounts: ${accountsList.length}`);
  accountsList.forEach(a => console.log(`  - ${a.name} (${a.type})`));

  console.log(`\nCategories: ${categoriesList.length}`);
  categoriesList.forEach(c => console.log(`  - ${c.name}`));

  console.log(`\nBudgets: ${budgetsList.length}`);
  const months = [...new Set(budgetsList.map(b => b.yearMonth))].sort();
  console.log(`Months with budgets:`, months);

  console.log(`\nTransactions: ${transactionsList.length}`);
  console.log(`Entries: ${entriesList.length}`);

  console.log(`\n📊 Budgets for 2025-12:`);
  const dec2025 = budgetsList.filter(b => b.yearMonth === '2025-12');
  console.log(`  Count: ${dec2025.length}`);
}

verify().catch(console.error);
