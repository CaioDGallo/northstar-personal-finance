import 'dotenv/config';

import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { reset, seed } from 'drizzle-seed';
import { db } from '../lib/db';
import { getFaturaMonth, getFaturaPaymentDueDate } from '../lib/fatura-utils';
import * as schema from '../lib/schema';
import { addMonths, getCurrentYearMonth } from '../lib/utils';

// Production safety check
if (process.env.NODE_ENV === 'production') {
  console.error('❌ Cannot run seed in production!');
  process.exit(1);
}

// Default users for seeding
const DEFAULT_USERS = [
  {
    id: 'f58dd388-190e-4d12-9d8f-126add711507',
    email: 'caiogallo88@gmail.com',
    password: 'Test123@',
    name: 'Caio Gallo',
  },
  {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'e2e@example.com',
    password: 'Password123',
    name: 'E2E Test User',
  },
];

// Primary test user ID for seeding data
const TEST_USER_ID = DEFAULT_USERS[0].id;

// Date helpers
const CURRENT_MONTH = getCurrentYearMonth();
const PREV_MONTH = addMonths(CURRENT_MONTH, -1);
const TWO_MONTHS_AGO = addMonths(CURRENT_MONTH, -2);

const seedSchema = {
  users: schema.users,
  accounts: schema.accounts,
  categories: schema.categories,
  budgets: schema.budgets,
  transactions: schema.transactions,
  entries: schema.entries,
  faturas: schema.faturas,
  income: schema.income,
};

type SeedTableKey = keyof typeof seedSchema;

type SeedRow = Record<string, unknown>;

const serialTables = new Set<SeedTableKey>([
  'accounts',
  'categories',
  'budgets',
  'transactions',
  'entries',
  'faturas',
  'income',
]);

const idCounters: Record<SeedTableKey, number> = {
  users: 0,
  accounts: 0,
  categories: 0,
  budgets: 0,
  transactions: 0,
  entries: 0,
  faturas: 0,
  income: 0,
};

const tableSchema = (tableKey: SeedTableKey) => ({ [tableKey]: seedSchema[tableKey] });

function assignIds<T extends SeedRow>(tableKey: SeedTableKey, rows: T[]) {
  if (!serialTables.has(tableKey)) {
    return rows;
  }

  return rows.map((row) => {
    idCounters[tableKey] += 1;
    return { id: idCounters[tableKey], ...row };
  });
}

async function seedRow(tableKey: SeedTableKey, row: SeedRow) {
  await seed(db, tableSchema(tableKey)).refine((funcs) => {
    const columns = Object.fromEntries(
      Object.entries(row)
        .filter(([, value]) => value !== undefined)
        .map(([column, value]) => [
          column,
          funcs.valuesFromArray({ values: [value as number | string | boolean | null] }),
        ])
    );

    return {
      [tableKey]: {
        count: 1,
        columns,
      },
    };
  });
}

async function seedRows(tableKey: SeedTableKey, rows: SeedRow[]) {
  const rowsWithIds = assignIds(tableKey, rows);

  if (rowsWithIds.length === 0) {
    return rowsWithIds;
  }

  for (const row of rowsWithIds) {
    await seedRow(tableKey, row);
  }

  return rowsWithIds;
}

async function resetSequences() {
  const sequenceTables = [
    { table: 'accounts', count: idCounters.accounts },
    { table: 'categories', count: idCounters.categories },
    { table: 'budgets', count: idCounters.budgets },
    { table: 'transactions', count: idCounters.transactions },
    { table: 'entries', count: idCounters.entries },
    { table: 'faturas', count: idCounters.faturas },
    { table: 'income', count: idCounters.income },
  ];

  for (const { table, count } of sequenceTables) {
    if (count > 0) {
      await db.execute(
        sql.raw(`select setval(pg_get_serial_sequence('${table}', 'id'), ${count})`)
      );
    }
  }
}

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
  { name: 'Nubank', type: 'credit_card' as const, closingDay: 1, paymentDueDay: 8 },
  { name: 'Itaú Corrente', type: 'checking' as const },
  { name: 'Nubank Rendimento', type: 'savings' as const },
  { name: 'Carteira', type: 'cash' as const },
];

const categoriesData = [
  // Expense categories
  { name: 'Alimentação', color: '#ef4444', icon: 'Restaurant01Icon', type: 'expense' as const },
  { name: 'Transporte', color: '#3b82f6', icon: 'Car01Icon', type: 'expense' as const },
  { name: 'Entretenimento', color: '#a855f7', icon: 'GameController01Icon', type: 'expense' as const },
  { name: 'Compras', color: '#f97316', icon: 'ShoppingBag01Icon', type: 'expense' as const },
  { name: 'Saúde', color: '#22c55e', icon: 'HealthIcon', type: 'expense' as const },
  { name: 'Contas', color: '#64748b', icon: 'Wallet01Icon', type: 'expense' as const },
  { name: 'Educação', color: '#0ea5e9', icon: 'Book01Icon', type: 'expense' as const },
  // Income categories
  { name: 'Salário', color: '#22c55e', icon: 'MoneyBag01Icon', type: 'income' as const },
  { name: 'Freelance', color: '#3b82f6', icon: 'BriefcaseIcon', type: 'income' as const },
  { name: 'Investimentos', color: '#a855f7', icon: 'ChartLineData01Icon', type: 'income' as const },
  { name: 'Outros', color: '#64748b', icon: 'CoinsIcon', type: 'income' as const },
];

function createBudgets(categoryIds: Record<string, number>, userId: string) {
  const months = [CURRENT_MONTH, PREV_MONTH, TWO_MONTHS_AGO];
  const budgetAmounts: Record<string, number> = {
    'Alimentação': 80000, // R$ 800
    'Transporte': 50000, // R$ 500
    'Entretenimento': 30000, // R$ 300
    'Compras': 60000, // R$ 600
    'Saúde': 40000, // R$ 400
    'Contas': 120000, // R$ 1200
    'Educação': 20000, // R$ 200
  };

  return months.flatMap((month) =>
    Object.entries(budgetAmounts).map(([name, amount]) => ({
      userId,
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
    description: 'iFood mensal',
    totalAmount: 35000,
    categoryName: 'Alimentação',
    accountName: 'Nubank',
    startMonth: 0,
    installments: 1,
    startDay: 5,
    paid: false,
  },
  {
    description: 'Mercado Extra',
    totalAmount: 28000,
    categoryName: 'Alimentação',
    accountName: 'Itaú Corrente',
    startMonth: 0,
    installments: 1,
    startDay: 8,
    paid: true,
  },
  {
    description: 'Padaria Zé',
    totalAmount: 4500,
    categoryName: 'Alimentação',
    accountName: 'Carteira',
    startMonth: 0,
    installments: 1,
    startDay: 12,
    paid: true,
  },
  {
    description: 'Restaurante Família',
    totalAmount: 18000,
    categoryName: 'Alimentação',
    accountName: 'Nubank',
    startMonth: 0,
    installments: 1,
    startDay: 15,
    paid: false,
  },
  {
    description: 'Supermercado Dia',
    totalAmount: 9500,
    categoryName: 'Alimentação',
    accountName: 'Carteira',
    startMonth: 0,
    installments: 1,
    startDay: 20,
    paid: true,
  },

  // TRANSPORTE - Warning zone (~R$ 425 vs R$ 500)
  {
    description: 'Uber mensal',
    totalAmount: 22000,
    categoryName: 'Transporte',
    accountName: 'Nubank',
    startMonth: 0,
    installments: 1,
    startDay: 3,
    paid: false,
  },
  {
    description: 'Gasolina Shell',
    totalAmount: 18000,
    categoryName: 'Transporte',
    accountName: 'Itaú Corrente',
    startMonth: 0,
    installments: 1,
    startDay: 10,
    paid: true,
  },
  {
    description: 'Estacionamento',
    totalAmount: 2500,
    categoryName: 'Transporte',
    accountName: 'Carteira',
    startMonth: 0,
    installments: 1,
    startDay: 14,
    paid: true,
  },

  // ENTRETENIMENTO - Under budget (~R$ 120 vs R$ 300)
  {
    description: 'Netflix',
    totalAmount: 4500,
    categoryName: 'Entretenimento',
    accountName: 'Nubank',
    startMonth: 0,
    installments: 1,
    startDay: 1,
    paid: true,
  },
  {
    description: 'Cinema Ingresso',
    totalAmount: 7500,
    categoryName: 'Entretenimento',
    accountName: 'Nubank',
    startMonth: 0,
    installments: 1,
    startDay: 18,
    paid: false,
  },

  // COMPRAS - Multi-installment examples
  {
    description: 'Cadeira Gamer',
    totalAmount: 120000,
    categoryName: 'Compras',
    accountName: 'Nubank',
    startMonth: -2,
    installments: 6,
    startDay: 15,
    paid: 'partial',
  },
  {
    description: 'Fone Bluetooth',
    totalAmount: 45000,
    categoryName: 'Compras',
    accountName: 'Nubank',
    startMonth: -1,
    installments: 3,
    startDay: 10,
    paid: 'partial',
  },

  // CONTAS - Fixed bills (~R$ 870 vs R$ 1200)
  {
    description: 'Aluguel',
    totalAmount: 65000,
    categoryName: 'Contas',
    accountName: 'Itaú Corrente',
    startMonth: 0,
    installments: 1,
    startDay: 5,
    paid: true,
  },
  {
    description: 'Conta de Luz',
    totalAmount: 12000,
    categoryName: 'Contas',
    accountName: 'Itaú Corrente',
    startMonth: 0,
    installments: 1,
    startDay: 10,
    paid: true,
  },
  {
    description: 'Internet',
    totalAmount: 10000,
    categoryName: 'Contas',
    accountName: 'Itaú Corrente',
    startMonth: 0,
    installments: 1,
    startDay: 15,
    paid: false,
  },

  // EDUCAÇÃO - Under budget (~R$ 60 vs R$ 200)
  {
    description: 'Curso Udemy',
    totalAmount: 6000,
    categoryName: 'Educação',
    accountName: 'Nubank',
    startMonth: 0,
    installments: 1,
    startDay: 2,
    paid: true,
  },

  // SAÚDE - Zero spending (has budget, no transactions in current month)

  // HISTORICAL DATA - Previous month (mostly paid)
  {
    description: 'iFood',
    totalAmount: 32000,
    categoryName: 'Alimentação',
    accountName: 'Nubank',
    startMonth: -1,
    installments: 1,
    startDay: 8,
    paid: true,
  },
  {
    description: 'Mercado',
    totalAmount: 25000,
    categoryName: 'Alimentação',
    accountName: 'Itaú Corrente',
    startMonth: -1,
    installments: 1,
    startDay: 12,
    paid: true,
  },
  {
    description: 'Consulta Médica',
    totalAmount: 35000,
    categoryName: 'Saúde',
    accountName: 'Nubank',
    startMonth: -1,
    installments: 1,
    startDay: 20,
    paid: true,
  },

  // 2 MONTHS AGO - Sparse data
  {
    description: 'Aluguel',
    totalAmount: 65000,
    categoryName: 'Contas',
    accountName: 'Itaú Corrente',
    startMonth: -2,
    installments: 1,
    startDay: 5,
    paid: true,
  },
  {
    description: 'Curso Online',
    totalAmount: 18000,
    categoryName: 'Educação',
    accountName: 'Nubank',
    startMonth: -2,
    installments: 3,
    startDay: 1,
    paid: true,
  },
];

type IncomeSeed = {
  description: string;
  amount: number;
  categoryName: string;
  accountName: string;
  monthOffset: number;
  day: number;
  received: boolean;
};

const incomeData: IncomeSeed[] = [
  // CURRENT MONTH
  {
    description: 'Salário mensal',
    amount: 500000, // R$ 5,000
    categoryName: 'Salário',
    accountName: 'Itaú Corrente',
    monthOffset: 0,
    day: 5,
    received: true,
  },
  {
    description: 'Projeto freelance - Site empresa',
    amount: 150000, // R$ 1,500
    categoryName: 'Freelance',
    accountName: 'Nubank Rendimento',
    monthOffset: 0,
    day: 12,
    received: false,
  },
  {
    description: 'Dividendos ações',
    amount: 8500, // R$ 85
    categoryName: 'Investimentos',
    accountName: 'Nubank Rendimento',
    monthOffset: 0,
    day: 20,
    received: true,
  },

  // PREVIOUS MONTH
  {
    description: 'Salário mensal',
    amount: 500000,
    categoryName: 'Salário',
    accountName: 'Itaú Corrente',
    monthOffset: -1,
    day: 5,
    received: true,
  },
  {
    description: 'Projeto freelance - Logo',
    amount: 80000, // R$ 800
    categoryName: 'Freelance',
    accountName: 'Nubank Rendimento',
    monthOffset: -1,
    day: 15,
    received: true,
  },

  // TWO MONTHS AGO
  {
    description: 'Salário mensal',
    amount: 500000,
    categoryName: 'Salário',
    accountName: 'Itaú Corrente',
    monthOffset: -2,
    day: 5,
    received: true,
  },
];

function generateEntries(
  transactionId: number,
  txData: TransactionSeed,
  accountMap: Record<string, number>,
  accountsById: Record<number, typeof accountsData[0]>,
  userId: string
) {
  const amountPerInstallment = Math.round(txData.totalAmount / txData.installments);
  const result = [];
  const accountId = accountMap[txData.accountName];
  const account = accountsById[accountId];

  for (let i = 0; i < txData.installments; i++) {
    const monthOffset = txData.startMonth + i;
    const purchaseDate = getRelativeDate(monthOffset, txData.startDay);

    // For credit cards, compute fatura month and due date using billing cycle
    let faturaMonth: string;
    let dueDate: string;

    if (account.type === 'credit_card' && account.closingDay && account.paymentDueDay) {
      const purchaseDateObj = new Date(purchaseDate + 'T00:00:00Z');
      faturaMonth = getFaturaMonth(purchaseDateObj, account.closingDay);
      dueDate = getFaturaPaymentDueDate(faturaMonth, account.paymentDueDay, account.closingDay);
    } else {
      // For non-credit-card accounts, fatura month = purchase month, due date = purchase date
      faturaMonth = purchaseDate.slice(0, 7);
      dueDate = purchaseDate;
    }

    // Determine paid status - PostgreSQL timestamp needs Date object
    let paidAt: Date | null = null;
    if (txData.paid === true) {
      paidAt = new Date(purchaseDate); // Paid on purchase date
    } else if (txData.paid === 'partial') {
      // Past installments are paid, current/future are pending
      const isPastMonth = monthOffset < 0;
      if (isPastMonth) paidAt = new Date(purchaseDate);
    }
    // txData.paid === false means all pending

    // Last installment absorbs rounding difference
    const amount =
      i === txData.installments - 1
        ? txData.totalAmount - amountPerInstallment * (txData.installments - 1)
        : amountPerInstallment;

    result.push({
      userId,
      transactionId,
      accountId,
      amount,
      purchaseDate,
      faturaMonth,
      dueDate,
      paidAt,
      installmentNumber: i + 1,
    });
  }

  return result;
}

async function seedDatabase() {
  const dbUrl = process.env.DATABASE_URL!;
  console.log('🌱 Seeding database...');
  console.log(`📍 Target: ${dbUrl}\n`);

  try {
    // 1. Clear all tables
    console.log('  🗑️  Clearing existing data...');
    await reset(db, schema);
    for (const key of Object.keys(idCounters) as SeedTableKey[]) {
      idCounters[key] = 0;
    }
    console.log('  ✓ Data cleared\n');

    // 2. Create default users
    console.log('  👤 Creating users...');
    const userRecords = await Promise.all(
      DEFAULT_USERS.map(async (user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        passwordHash: await bcrypt.hash(user.password, 10),
        emailVerified: new Date(),
        createdAt: new Date(),
        image: null,
      }))
    );
    await seedRows('users', userRecords);
    console.log(`  ✓ ${userRecords.length} users created\n`);

    // 3. Insert accounts
    console.log('  💳 Inserting accounts...');
    const accountRecords = accountsData.map((account) => ({
      ...account,
      userId: TEST_USER_ID,
      closingDay: account.closingDay ?? null,
      paymentDueDay: account.paymentDueDay ?? null,
      creditLimit: null,
    }));
    const seededAccounts = await seedRows('accounts', accountRecords);
    const accountMap = Object.fromEntries(seededAccounts.map((account) => [account.name, account.id]));
    const accountSeedByName = Object.fromEntries(accountsData.map((account) => [account.name, account]));
    const accountsById = Object.fromEntries(
      seededAccounts.map((account) => [account.id, accountSeedByName[account.name]])
    );
    console.log(`  ✓ ${seededAccounts.length} accounts created\n`);

    // 4. Insert categories
    console.log('  🏷️  Inserting categories...');
    const categoryRecords = categoriesData.map((category) => ({
      ...category,
      userId: TEST_USER_ID,
    }));
    const seededCategories = await seedRows('categories', categoryRecords);
    const categoryMap = Object.fromEntries(seededCategories.map((category) => [category.name, category.id]));
    console.log(`  ✓ ${seededCategories.length} categories created\n`);

    // 5. Insert budgets
    console.log('  💰 Inserting budgets...');
    const budgetRecords = createBudgets(categoryMap, TEST_USER_ID);
    await seedRows('budgets', budgetRecords);
    console.log(`  ✓ ${budgetRecords.length} budgets created\n`);

    // 6. Insert transactions and entries
    console.log('  📝 Inserting transactions and entries...');
    const transactionRecords = transactionsData.map((transaction) => ({
      userId: TEST_USER_ID,
      description: transaction.description,
      totalAmount: transaction.totalAmount,
      totalInstallments: transaction.installments,
      categoryId: categoryMap[transaction.categoryName],
      externalId: null,
    }));
    const seededTransactions = await seedRows('transactions', transactionRecords);

    const entryRecords = transactionsData.flatMap((transaction, index) => {
      const transactionId = seededTransactions[index].id as number;
      return generateEntries(transactionId, transaction, accountMap, accountsById, TEST_USER_ID);
    });

    await seedRows('entries', entryRecords);

    console.log(`  ✓ ${seededTransactions.length} transactions created`);
    console.log(`  ✓ ${entryRecords.length} entries created\n`);

    // 7. Insert faturas (credit card statements)
    console.log('  💳 Creating faturas...');
    const faturaGroups = new Map<string, { accountId: number; faturaMonth: string; total: number }>();

    for (const entry of entryRecords) {
      const key = `${entry.accountId}-${entry.faturaMonth}`;
      const existing = faturaGroups.get(key);

      if (existing) {
        existing.total += entry.amount;
      } else {
        faturaGroups.set(key, {
          accountId: entry.accountId,
          faturaMonth: entry.faturaMonth,
          total: entry.amount,
        });
      }
    }

    const faturaRecords: Array<{
      userId: string;
      accountId: number;
      yearMonth: string;
      totalAmount: number;
      dueDate: string;
      paidAt: null;
    }> = [];

    for (const group of faturaGroups.values()) {
      const account = accountsById[group.accountId];

      if (account.type === 'credit_card' && account.closingDay && account.paymentDueDay) {
        const dueDate = getFaturaPaymentDueDate(
          group.faturaMonth,
          account.paymentDueDay,
          account.closingDay
        );

        faturaRecords.push({
          userId: TEST_USER_ID,
          accountId: group.accountId,
          yearMonth: group.faturaMonth,
          totalAmount: group.total,
          dueDate,
          paidAt: null,
          paidFromAccountId: null,
        });
      }
    }

    if (faturaRecords.length > 0) {
      await seedRows('faturas', faturaRecords);
    }
    console.log(`  ✓ ${faturaRecords.length} faturas created\n`);

    // 8. Insert income
    console.log('  💵 Inserting income...');
    const incomeRecords = incomeData.map((inc) => ({
      userId: TEST_USER_ID,
      description: inc.description,
      amount: inc.amount,
      categoryId: categoryMap[inc.categoryName],
      accountId: accountMap[inc.accountName],
      receivedDate: getRelativeDate(inc.monthOffset, inc.day),
      receivedAt: inc.received ? new Date(getRelativeDate(inc.monthOffset, inc.day)) : null,
      externalId: null,
    }));
    await seedRows('income', incomeRecords);
    console.log(`  ✓ ${incomeRecords.length} income entries created\n`);

    await resetSequences();

    console.log('✅ Seeding complete!\n');
    console.log('📊 Summary:');
    console.log(`   Users: ${userRecords.length}`);
    console.log(`   Accounts: ${seededAccounts.length}`);
    console.log(`   Categories: ${seededCategories.length}`);
    console.log(`   Budgets: ${budgetRecords.length}`);
    console.log(`   Transactions: ${seededTransactions.length}`);
    console.log(`   Entries: ${entryRecords.length}`);
    console.log(`   Faturas: ${faturaRecords.length}`);
    console.log(`   Income: ${incomeRecords.length}`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
