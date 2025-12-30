import 'dotenv/config';

import { db } from '../lib/db';
import { accounts, categories, budgets, transactions, entries } from '../lib/schema';
import { getCurrentYearMonth, addMonths } from '../lib/utils';

// Production safety check
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Cannot run seed in production!');
  process.exit(1);
}

// Date helpers
const CURRENT_MONTH = getCurrentYearMonth();
const PREV_MONTH = addMonths(CURRENT_MONTH, -1);
const TWO_MONTHS_AGO = addMonths(CURRENT_MONTH, -2);

function getRelativeDate(monthOffset: number, day: number): string {
  const now = new Date();
  now.setMonth(now.getMonth() + monthOffset);
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  return `${year}-${month}-${dayStr}`;
}

// Seed data constants
const accountsData = [
  { name: 'Nubank', type: 'credit_card' as const },
  { name: 'Itaú Corrente', type: 'checking' as const },
  { name: 'Nubank Rendimento', type: 'savings' as const },
  { name: 'Carteira', type: 'cash' as const },
];

const categoriesData = [
  { name: 'Alimentação', color: '#ef4444', icon: 'Restaurant01Icon' },
  { name: 'Transporte', color: '#3b82f6', icon: 'Car01Icon' },
  { name: 'Entretenimento', color: '#a855f7', icon: 'GameController01Icon' },
  { name: 'Compras', color: '#f97316', icon: 'ShoppingBag01Icon' },
  { name: 'Saúde', color: '#22c55e', icon: 'HealthIcon' },
  { name: 'Contas', color: '#64748b', icon: 'Wallet01Icon' },
  { name: 'Educação', color: '#0ea5e9', icon: 'Book01Icon' },
];

function createBudgets(categoryIds: Record<string, number>) {
  const months = [CURRENT_MONTH, PREV_MONTH, TWO_MONTHS_AGO];
  const budgetAmounts: Record<string, number> = {
    'Alimentação': 80000,    // R$ 800
    'Transporte': 50000,     // R$ 500
    'Entretenimento': 30000, // R$ 300
    'Compras': 60000,        // R$ 600
    'Saúde': 40000,          // R$ 400
    'Contas': 120000,        // R$ 1200
    'Educação': 20000,       // R$ 200
  };

  return months.flatMap(month =>
    Object.entries(budgetAmounts).map(([name, amount]) => ({
      categoryId: categoryIds[name],
      yearMonth: month,
      amount,
    }))
  );
}

type TransactionSeed = {
  description: string;
  totalAmount: number;
  categoryName: string;
  accountName: string;
  startMonth: number;
  installments: number;
  startDay: number;
  paid: boolean | 'partial';
};

const transactionsData: TransactionSeed[] = [
  // ALIMENTAÇÃO - Over budget (~R$ 950 vs R$ 800)
  {
    description: 'iFood mensal', totalAmount: 35000, categoryName: 'Alimentação',
    accountName: 'Nubank', startMonth: 0, installments: 1, startDay: 5, paid: false
  },
  {
    description: 'Mercado Extra', totalAmount: 28000, categoryName: 'Alimentação',
    accountName: 'Itaú Corrente', startMonth: 0, installments: 1, startDay: 8, paid: true
  },
  {
    description: 'Padaria Zé', totalAmount: 4500, categoryName: 'Alimentação',
    accountName: 'Carteira', startMonth: 0, installments: 1, startDay: 12, paid: true
  },
  {
    description: 'Restaurante Família', totalAmount: 18000, categoryName: 'Alimentação',
    accountName: 'Nubank', startMonth: 0, installments: 1, startDay: 15, paid: false
  },
  {
    description: 'Supermercado Dia', totalAmount: 9500, categoryName: 'Alimentação',
    accountName: 'Carteira', startMonth: 0, installments: 1, startDay: 20, paid: true
  },

  // TRANSPORTE - Warning zone (~R$ 425 vs R$ 500)
  {
    description: 'Uber mensal', totalAmount: 22000, categoryName: 'Transporte',
    accountName: 'Nubank', startMonth: 0, installments: 1, startDay: 3, paid: false
  },
  {
    description: 'Gasolina Shell', totalAmount: 18000, categoryName: 'Transporte',
    accountName: 'Itaú Corrente', startMonth: 0, installments: 1, startDay: 10, paid: true
  },
  {
    description: 'Estacionamento', totalAmount: 2500, categoryName: 'Transporte',
    accountName: 'Carteira', startMonth: 0, installments: 1, startDay: 14, paid: true
  },

  // ENTRETENIMENTO - Under budget (~R$ 120 vs R$ 300)
  {
    description: 'Netflix', totalAmount: 4500, categoryName: 'Entretenimento',
    accountName: 'Nubank', startMonth: 0, installments: 1, startDay: 1, paid: true
  },
  {
    description: 'Cinema Ingresso', totalAmount: 7500, categoryName: 'Entretenimento',
    accountName: 'Nubank', startMonth: 0, installments: 1, startDay: 18, paid: false
  },

  // COMPRAS - Multi-installment examples
  {
    description: 'Cadeira Gamer', totalAmount: 120000, categoryName: 'Compras',
    accountName: 'Nubank', startMonth: -2, installments: 6, startDay: 15, paid: 'partial'
  },
  {
    description: 'Fone Bluetooth', totalAmount: 45000, categoryName: 'Compras',
    accountName: 'Nubank', startMonth: -1, installments: 3, startDay: 10, paid: 'partial'
  },

  // CONTAS - Fixed bills (~R$ 870 vs R$ 1200)
  {
    description: 'Aluguel', totalAmount: 65000, categoryName: 'Contas',
    accountName: 'Itaú Corrente', startMonth: 0, installments: 1, startDay: 5, paid: true
  },
  {
    description: 'Conta de Luz', totalAmount: 12000, categoryName: 'Contas',
    accountName: 'Itaú Corrente', startMonth: 0, installments: 1, startDay: 10, paid: true
  },
  {
    description: 'Internet', totalAmount: 10000, categoryName: 'Contas',
    accountName: 'Itaú Corrente', startMonth: 0, installments: 1, startDay: 15, paid: false
  },

  // EDUCAÇÃO - Under budget (~R$ 60 vs R$ 200)
  {
    description: 'Curso Udemy', totalAmount: 6000, categoryName: 'Educação',
    accountName: 'Nubank', startMonth: 0, installments: 1, startDay: 2, paid: true
  },

  // SAÚDE - Zero spending (has budget, no transactions in current month)

  // HISTORICAL DATA - Previous month (mostly paid)
  {
    description: 'iFood', totalAmount: 32000, categoryName: 'Alimentação',
    accountName: 'Nubank', startMonth: -1, installments: 1, startDay: 8, paid: true
  },
  {
    description: 'Mercado', totalAmount: 25000, categoryName: 'Alimentação',
    accountName: 'Itaú Corrente', startMonth: -1, installments: 1, startDay: 12, paid: true
  },
  {
    description: 'Consulta Médica', totalAmount: 35000, categoryName: 'Saúde',
    accountName: 'Nubank', startMonth: -1, installments: 1, startDay: 20, paid: true
  },

  // 2 MONTHS AGO - Sparse data
  {
    description: 'Aluguel', totalAmount: 65000, categoryName: 'Contas',
    accountName: 'Itaú Corrente', startMonth: -2, installments: 1, startDay: 5, paid: true
  },
  {
    description: 'Curso Online', totalAmount: 18000, categoryName: 'Educação',
    accountName: 'Nubank', startMonth: -2, installments: 3, startDay: 1, paid: true
  },
];

function generateEntries(
  transactionId: number,
  txData: TransactionSeed,
  accountMap: Record<string, number>
) {
  const amountPerInstallment = Math.round(txData.totalAmount / txData.installments);
  const result = [];

  for (let i = 0; i < txData.installments; i++) {
    const monthOffset = txData.startMonth + i;
    const dueDate = getRelativeDate(monthOffset, txData.startDay);

    // Determine paid status - PostgreSQL timestamp needs Date object
    let paidAt: Date | null = null;
    if (txData.paid === true) {
      paidAt = new Date(dueDate); // Paid on due date
    } else if (txData.paid === 'partial') {
      // Past installments are paid, current/future are pending
      const isPastMonth = monthOffset < 0;
      if (isPastMonth) paidAt = new Date(dueDate);
    }
    // txData.paid === false means all pending

    // Last installment absorbs rounding difference
    const amount = i === txData.installments - 1
      ? txData.totalAmount - amountPerInstallment * (txData.installments - 1)
      : amountPerInstallment;

    result.push({
      transactionId,
      accountId: accountMap[txData.accountName],
      amount,
      dueDate, // date type accepts string 'YYYY-MM-DD'
      paidAt,  // timestamp type needs Date object
      installmentNumber: i + 1,
    });
  }

  return result;
}

async function seed() {
  const dbUrl = process.env.DATABASE_URL!;
  console.log('🌱 Seeding database...');
  console.log(`📍 Target: ${dbUrl}\n`);

  try {
    // 1. Clear all tables (reverse FK order)
    console.log('  🗑️  Clearing existing data...');
    const deletedEntries = await db.delete(entries);
    const deletedTransactions = await db.delete(transactions);
    const deletedBudgets = await db.delete(budgets);
    const deletedCategories = await db.delete(categories);
    const deletedAccounts = await db.delete(accounts);
    console.log(`  ✓ Data cleared (accounts: ${deletedAccounts.rowsAffected}, entries: ${deletedEntries.rowsAffected})\n`);

    // 2. Insert accounts
    console.log('  💳 Inserting accounts...');
    const insertedAccounts = await db.insert(accounts).values(accountsData).returning();
    const accountMap = Object.fromEntries(insertedAccounts.map(a => [a.name, a.id]));
    console.log(`  ✓ ${insertedAccounts.length} accounts created\n`);

    // 3. Insert categories
    console.log('  🏷️  Inserting categories...');
    const insertedCategories = await db.insert(categories).values(categoriesData).returning();
    const categoryMap = Object.fromEntries(insertedCategories.map(c => [c.name, c.id]));
    console.log(`  ✓ ${insertedCategories.length} categories created\n`);

    // 4. Insert budgets
    console.log('  💰 Inserting budgets...');
    const budgetRecords = createBudgets(categoryMap);
    await db.insert(budgets).values(budgetRecords);
    console.log(`  ✓ ${budgetRecords.length} budgets created\n`);

    // 5. Insert transactions and entries
    console.log('  📝 Inserting transactions and entries...');
    let totalEntries = 0;

    for (const txData of transactionsData) {
      const [tx] = await db.insert(transactions).values({
        description: txData.description,
        totalAmount: txData.totalAmount,
        totalInstallments: txData.installments,
        categoryId: categoryMap[txData.categoryName],
      }).returning();

      const entryRecords = generateEntries(tx.id, txData, accountMap);
      await db.insert(entries).values(entryRecords);
      totalEntries += entryRecords.length;
    }

    console.log(`  ✓ ${transactionsData.length} transactions created`);
    console.log(`  ✓ ${totalEntries} entries created\n`);

    console.log('✅ Seeding complete!\n');
    console.log('📊 Summary:');
    console.log(`   Accounts: ${insertedAccounts.length}`);
    console.log(`   Categories: ${insertedCategories.length}`);
    console.log(`   Budgets: ${budgetRecords.length}`);
    console.log(`   Transactions: ${transactionsData.length}`);
    console.log(`   Entries: ${totalEntries}`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
