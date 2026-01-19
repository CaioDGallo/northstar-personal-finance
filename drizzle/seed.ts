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
  monthlyBudgets: schema.monthlyBudgets,
  transactions: schema.transactions,
  entries: schema.entries,
  faturas: schema.faturas,
  transfers: schema.transfers,
  income: schema.income,
  categoryFrequency: schema.categoryFrequency,
  userSettings: schema.userSettings,
  calendarSources: schema.calendarSources,
  events: schema.events,
  tasks: schema.tasks,
  recurrenceRules: schema.recurrenceRules,
  notifications: schema.notifications,
  notificationJobs: schema.notificationJobs,
  billReminders: schema.billReminders,
};

type SeedTableKey = keyof typeof seedSchema;

type SeedRow = Record<string, unknown>;

const serialTables = new Set<SeedTableKey>([
  'accounts',
  'categories',
  'budgets',
  'monthlyBudgets',
  'transactions',
  'entries',
  'faturas',
  'transfers',
  'income',
  'categoryFrequency',
  'userSettings',
  'calendarSources',
  'events',
  'tasks',
  'recurrenceRules',
  'notifications',
  'notificationJobs',
  'billReminders',
]);

const idCounters: Record<SeedTableKey, number> = {
  users: 0,
  accounts: 0,
  categories: 0,
  budgets: 0,
  monthlyBudgets: 0,
  transactions: 0,
  entries: 0,
  faturas: 0,
  transfers: 0,
  income: 0,
  categoryFrequency: 0,
  userSettings: 0,
  calendarSources: 0,
  events: 0,
  tasks: 0,
  recurrenceRules: 0,
  notifications: 0,
  notificationJobs: 0,
  billReminders: 0,
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
    { table: 'monthly_budgets', count: idCounters.monthlyBudgets },
    { table: 'transactions', count: idCounters.transactions },
    { table: 'entries', count: idCounters.entries },
    { table: 'faturas', count: idCounters.faturas },
    { table: 'transfers', count: idCounters.transfers },
    { table: 'income', count: idCounters.income },
    { table: 'category_frequency', count: idCounters.categoryFrequency },
    { table: 'user_settings', count: idCounters.userSettings },
    { table: 'calendar_sources', count: idCounters.calendarSources },
    { table: 'events', count: idCounters.events },
    { table: 'tasks', count: idCounters.tasks },
    { table: 'recurrence_rules', count: idCounters.recurrenceRules },
    { table: 'notifications', count: idCounters.notifications },
    { table: 'notification_jobs', count: idCounters.notificationJobs },
    { table: 'bill_reminders', count: idCounters.billReminders },
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

// Helper to get relative date-time for events/tasks (timezone-aware)
function getRelativeDateTime(dayOffset: number, hours: number, minutes: number): Date {
  const now = new Date();
  now.setDate(now.getDate() + dayOffset);
  now.setHours(hours, minutes, 0, 0);
  return now;
}

// Helper to get yearMonth string with offset
function getYearMonth(monthOffset: number): string {
  return addMonths(getCurrentYearMonth(), monthOffset);
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
  { name: 'Alimentação', color: '#ef4444', icon: 'Restaurant01Icon', type: 'expense' as const, isImportDefault: true },
  { name: 'Transporte', color: '#3b82f6', icon: 'Car01Icon', type: 'expense' as const, isImportDefault: true },
  { name: 'Entretenimento', color: '#a855f7', icon: 'GameController01Icon', type: 'expense' as const, isImportDefault: false },
  { name: 'Compras', color: '#f97316', icon: 'ShoppingBag01Icon', type: 'expense' as const, isImportDefault: true },
  { name: 'Saúde', color: '#22c55e', icon: 'HealthIcon', type: 'expense' as const, isImportDefault: false },
  { name: 'Contas', color: '#64748b', icon: 'Wallet01Icon', type: 'expense' as const, isImportDefault: true },
  { name: 'Educação', color: '#0ea5e9', icon: 'Book01Icon', type: 'expense' as const, isImportDefault: false },
  // Income categories
  { name: 'Salário', color: '#22c55e', icon: 'MoneyBag01Icon', type: 'income' as const, isImportDefault: true },
  { name: 'Freelance', color: '#3b82f6', icon: 'BriefcaseIcon', type: 'income' as const, isImportDefault: false },
  { name: 'Investimentos', color: '#a855f7', icon: 'ChartLineData01Icon', type: 'income' as const, isImportDefault: false },
  { name: 'Outros', color: '#64748b', icon: 'CoinsIcon', type: 'income' as const, isImportDefault: false },
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
  ignored?: boolean;
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

  // IGNORED TRANSACTIONS - Should not affect budgets
  {
    description: 'Compra empresa (reembolsável)',
    totalAmount: 45000,
    categoryName: 'Compras',
    accountName: 'Nubank',
    startMonth: 0,
    installments: 1,
    startDay: 7,
    paid: false,
    ignored: true,
  },
  {
    description: 'Teste pagamento - cancelado',
    totalAmount: 15000,
    categoryName: 'Alimentação',
    accountName: 'Nubank',
    startMonth: 0,
    installments: 1,
    startDay: 11,
    paid: false,
    ignored: true,
  },
  {
    description: 'Transferência entre contas',
    totalAmount: 20000,
    categoryName: 'Compras',
    accountName: 'Itaú Corrente',
    startMonth: -1,
    installments: 1,
    startDay: 25,
    paid: true,
    ignored: true,
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
  ignored?: boolean;
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

  // IGNORED INCOME - Should not affect calculations
  {
    description: 'Reembolso empresa - não conta como renda',
    amount: 25000, // R$ 250
    categoryName: 'Outros',
    accountName: 'Itaú Corrente',
    monthOffset: 0,
    day: 18,
    received: true,
    ignored: true,
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
      ignored: transaction.ignored ?? false,
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
      paidAt: Date | null;
      paidFromAccountId: number | null;
    }> = [];

    // Get checking account ID for fatura payments
    const checkingAccountId = accountMap['Itaú Corrente'];

    for (const group of faturaGroups.values()) {
      const account = accountsById[group.accountId];

      if (account.type === 'credit_card' && account.closingDay && account.paymentDueDay) {
        const dueDate = getFaturaPaymentDueDate(
          group.faturaMonth,
          account.paymentDueDay,
          account.closingDay
        );

        // Mark past faturas as paid
        const isPastMonth = group.faturaMonth < CURRENT_MONTH;
        const paidAt = isPastMonth ? new Date(dueDate) : null;
        const paidFromAccountId = isPastMonth ? checkingAccountId : null;

        faturaRecords.push({
          userId: TEST_USER_ID,
          accountId: group.accountId,
          yearMonth: group.faturaMonth,
          totalAmount: group.total,
          dueDate,
          paidAt,
          paidFromAccountId,
        });
      }
    }

    const seededFaturas = await seedRows('faturas', faturaRecords);
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
      ignored: inc.ignored ?? false,
    }));
    await seedRows('income', incomeRecords);
    console.log(`  ✓ ${incomeRecords.length} income entries created\n`);

    // 9. Insert monthly budgets
    console.log('  💰 Inserting monthly budgets...');
    const monthlyBudgetRecords = [
      { userId: TEST_USER_ID, yearMonth: CURRENT_MONTH, amount: 400000 }, // R$ 4,000
      { userId: TEST_USER_ID, yearMonth: PREV_MONTH, amount: 380000 }, // R$ 3,800
      { userId: TEST_USER_ID, yearMonth: TWO_MONTHS_AGO, amount: 350000 }, // R$ 3,500
    ];
    await seedRows('monthlyBudgets', monthlyBudgetRecords);
    console.log(`  ✓ ${monthlyBudgetRecords.length} monthly budgets created\n`);

    // 10. Insert transfers (fatura payments, internal transfers, deposits, withdrawals)
    console.log('  💸 Inserting transfers...');
    const transferRecords: Array<{
      userId: string;
      fromAccountId: number | null;
      toAccountId: number | null;
      amount: number;
      date: string;
      type: 'fatura_payment' | 'internal_transfer' | 'deposit' | 'withdrawal';
      faturaId?: number;
      description: string | null;
      ignored: boolean;
    }> = [];

    // Create fatura payment transfers for paid faturas
    for (const fatura of seededFaturas) {
      if (fatura.paidAt && fatura.paidFromAccountId) {
        transferRecords.push({
          userId: TEST_USER_ID,
          fromAccountId: fatura.paidFromAccountId as number,
          toAccountId: fatura.accountId as number,
          amount: fatura.totalAmount as number,
          date: fatura.dueDate as string,
          type: 'fatura_payment',
          faturaId: fatura.id as number,
          description: `Pagamento fatura ${fatura.yearMonth}`,
          ignored: false,
        });
      }
    }

    // Add internal transfers
    transferRecords.push(
      {
        userId: TEST_USER_ID,
        fromAccountId: accountMap['Itaú Corrente'],
        toAccountId: accountMap['Nubank Rendimento'],
        amount: 100000, // R$ 1,000
        date: getRelativeDate(0, 15),
        type: 'internal_transfer',
        description: 'Investimento mensal',
        ignored: false,
      },
      {
        userId: TEST_USER_ID,
        fromAccountId: accountMap['Nubank Rendimento'],
        toAccountId: accountMap['Itaú Corrente'],
        amount: 50000, // R$ 500
        date: getRelativeDate(-1, 20),
        type: 'internal_transfer',
        description: 'Resgate poupança',
        ignored: false,
      }
    );

    // Add deposits and withdrawals
    transferRecords.push(
      {
        userId: TEST_USER_ID,
        fromAccountId: null,
        toAccountId: accountMap['Itaú Corrente'],
        amount: 200000, // R$ 2,000
        date: getRelativeDate(0, 3),
        type: 'deposit',
        description: 'Depósito em dinheiro',
        ignored: false,
      },
      {
        userId: TEST_USER_ID,
        fromAccountId: accountMap['Itaú Corrente'],
        toAccountId: null,
        amount: 30000, // R$ 300
        date: getRelativeDate(0, 10),
        type: 'withdrawal',
        description: 'Saque caixa eletrônico',
        ignored: false,
      },
      {
        userId: TEST_USER_ID,
        fromAccountId: accountMap['Carteira'],
        toAccountId: null,
        amount: 5000, // R$ 50
        date: getRelativeDate(-1, 18),
        type: 'withdrawal',
        description: 'Saque emergência',
        ignored: false,
      }
    );

    // Add ignored transfers
    transferRecords.push(
      {
        userId: TEST_USER_ID,
        fromAccountId: accountMap['Itaú Corrente'],
        toAccountId: accountMap['Nubank Rendimento'],
        amount: 75000, // R$ 750
        date: getRelativeDate(0, 22),
        type: 'internal_transfer',
        description: 'Teste transferência - cancelado',
        ignored: true,
      },
      {
        userId: TEST_USER_ID,
        fromAccountId: null,
        toAccountId: accountMap['Carteira'],
        amount: 10000, // R$ 100
        date: getRelativeDate(-1, 5),
        type: 'deposit',
        description: 'Depósito teste',
        ignored: true,
      }
    );

    await seedRows('transfers', transferRecords);
    console.log(`  ✓ ${transferRecords.length} transfers created\n`);

    // 11. Insert category frequency (for smart categorization)
    console.log('  🔍 Inserting category frequency data...');
    const categoryFrequencyRecords = [
      // Expense patterns
      { userId: TEST_USER_ID, descriptionNormalized: 'ifood', categoryId: categoryMap['Alimentação'], type: 'expense' as const, count: 5, lastUsedAt: new Date() },
      { userId: TEST_USER_ID, descriptionNormalized: 'mercado', categoryId: categoryMap['Alimentação'], type: 'expense' as const, count: 8, lastUsedAt: new Date() },
      { userId: TEST_USER_ID, descriptionNormalized: 'uber', categoryId: categoryMap['Transporte'], type: 'expense' as const, count: 12, lastUsedAt: new Date() },
      { userId: TEST_USER_ID, descriptionNormalized: 'gasolina', categoryId: categoryMap['Transporte'], type: 'expense' as const, count: 6, lastUsedAt: new Date() },
      { userId: TEST_USER_ID, descriptionNormalized: 'netflix', categoryId: categoryMap['Entretenimento'], type: 'expense' as const, count: 10, lastUsedAt: new Date() },
      { userId: TEST_USER_ID, descriptionNormalized: 'spotify', categoryId: categoryMap['Entretenimento'], type: 'expense' as const, count: 8, lastUsedAt: new Date() },
      { userId: TEST_USER_ID, descriptionNormalized: 'farmacia', categoryId: categoryMap['Saúde'], type: 'expense' as const, count: 4, lastUsedAt: new Date() },
      { userId: TEST_USER_ID, descriptionNormalized: 'aluguel', categoryId: categoryMap['Contas'], type: 'expense' as const, count: 15, lastUsedAt: new Date() },
      { userId: TEST_USER_ID, descriptionNormalized: 'luz', categoryId: categoryMap['Contas'], type: 'expense' as const, count: 12, lastUsedAt: new Date() },
      { userId: TEST_USER_ID, descriptionNormalized: 'internet', categoryId: categoryMap['Contas'], type: 'expense' as const, count: 11, lastUsedAt: new Date() },
      { userId: TEST_USER_ID, descriptionNormalized: 'curso', categoryId: categoryMap['Educação'], type: 'expense' as const, count: 3, lastUsedAt: new Date() },
      { userId: TEST_USER_ID, descriptionNormalized: 'livro', categoryId: categoryMap['Educação'], type: 'expense' as const, count: 2, lastUsedAt: new Date() },
      // Income patterns
      { userId: TEST_USER_ID, descriptionNormalized: 'salario', categoryId: categoryMap['Salário'], type: 'income' as const, count: 20, lastUsedAt: new Date() },
      { userId: TEST_USER_ID, descriptionNormalized: 'freelance', categoryId: categoryMap['Freelance'], type: 'income' as const, count: 7, lastUsedAt: new Date() },
      { userId: TEST_USER_ID, descriptionNormalized: 'dividendos', categoryId: categoryMap['Investimentos'], type: 'income' as const, count: 4, lastUsedAt: new Date() },
    ];
    await seedRows('categoryFrequency', categoryFrequencyRecords);
    console.log(`  ✓ ${categoryFrequencyRecords.length} category frequency records created\n`);

    // 12. Insert user settings
    console.log('  ⚙️  Inserting user settings...');
    const userSettingsRecords = DEFAULT_USERS.map((user) => ({
      userId: user.id,
      timezone: 'America/Sao_Paulo',
      locale: 'pt-BR',
      notificationEmail: user.email,
      notificationsEnabled: true,
      defaultEventOffsetMinutes: 60, // 1 hour before
      defaultTaskOffsetMinutes: 60, // 1 hour before
    }));
    await seedRows('userSettings', userSettingsRecords);
    console.log(`  ✓ ${userSettingsRecords.length} user settings created\n`);

    // 13. Insert calendar sources
    console.log('  📅 Inserting calendar sources...');
    const calendarSourceRecords = [
      {
        userId: TEST_USER_ID,
        name: 'Feriados Brasileiros',
        url: 'https://calendar.google.com/calendar/ical/pt-br.brazilian%23holiday%40group.v.calendar.google.com/public/basic.ics',
        status: 'active' as const,
        color: '#22c55e',
        lastSyncedAt: new Date(Date.now() - 3600000), // 1 hour ago
        lastError: null,
        syncToken: 'sync-token-123',
      },
      {
        userId: TEST_USER_ID,
        name: 'Calendário Trabalho (Falha)',
        url: 'https://example.com/invalid-calendar.ics',
        status: 'error' as const,
        color: '#ef4444',
        lastSyncedAt: new Date(Date.now() - 86400000), // 1 day ago
        lastError: 'Failed to fetch: 404 Not Found',
        syncToken: null,
      },
    ];
    const seededCalendarSources = await seedRows('calendarSources', calendarSourceRecords);
    console.log(`  ✓ ${calendarSourceRecords.length} calendar sources created\n`);

    // 14. Insert events
    console.log('  🎯 Inserting events...');
    const activeCalendarSourceId = seededCalendarSources[0].id as number;
    const eventRecords = [
      // Upcoming events (next 7 days)
      {
        userId: TEST_USER_ID,
        title: 'Reunião de planejamento',
        description: 'Planejamento semanal da equipe',
        location: 'Sala de reuniões',
        startAt: getRelativeDateTime(1, 10, 0),
        endAt: getRelativeDateTime(1, 11, 30),
        isAllDay: false,
        priority: 'high' as const,
        status: 'scheduled' as const,
        externalId: null,
        calendarSourceId: null,
        externalUpdatedAt: null,
      },
      {
        userId: TEST_USER_ID,
        title: 'Dentista',
        description: 'Consulta de rotina',
        location: 'Clínica Odonto',
        startAt: getRelativeDateTime(2, 14, 30),
        endAt: getRelativeDateTime(2, 15, 30),
        isAllDay: false,
        priority: 'medium' as const,
        status: 'scheduled' as const,
        externalId: null,
        calendarSourceId: null,
        externalUpdatedAt: null,
      },
      {
        userId: TEST_USER_ID,
        title: 'Aniversário João',
        description: null,
        location: null,
        startAt: getRelativeDateTime(3, 0, 0),
        endAt: getRelativeDateTime(4, 0, 0),
        isAllDay: true,
        priority: 'low' as const,
        status: 'scheduled' as const,
        externalId: null,
        calendarSourceId: null,
        externalUpdatedAt: null,
      },
      {
        userId: TEST_USER_ID,
        title: 'Almoço com cliente',
        description: 'Discussão sobre novo projeto',
        location: 'Restaurante Bella Vista',
        startAt: getRelativeDateTime(4, 12, 0),
        endAt: getRelativeDateTime(4, 14, 0),
        isAllDay: false,
        priority: 'high' as const,
        status: 'scheduled' as const,
        externalId: null,
        calendarSourceId: null,
        externalUpdatedAt: null,
      },
      {
        userId: TEST_USER_ID,
        title: 'Workshop técnico',
        description: 'TypeScript avançado',
        location: 'Online - Zoom',
        startAt: getRelativeDateTime(5, 15, 0),
        endAt: getRelativeDateTime(5, 18, 0),
        isAllDay: false,
        priority: 'medium' as const,
        status: 'scheduled' as const,
        externalId: null,
        calendarSourceId: null,
        externalUpdatedAt: null,
      },
      // Past events
      {
        userId: TEST_USER_ID,
        title: 'Reunião semanal equipe',
        description: 'Status do sprint',
        location: 'Sala 3',
        startAt: getRelativeDateTime(-1, 9, 0),
        endAt: getRelativeDateTime(-1, 10, 0),
        isAllDay: false,
        priority: 'medium' as const,
        status: 'completed' as const,
        externalId: null,
        calendarSourceId: null,
        externalUpdatedAt: null,
      },
      {
        userId: TEST_USER_ID,
        title: 'Academia',
        description: 'Treino de força',
        location: 'Smart Fit',
        startAt: getRelativeDateTime(-2, 18, 30),
        endAt: getRelativeDateTime(-2, 19, 30),
        isAllDay: false,
        priority: 'low' as const,
        status: 'completed' as const,
        externalId: null,
        calendarSourceId: null,
        externalUpdatedAt: null,
      },
      {
        userId: TEST_USER_ID,
        title: 'Médico - cancelado',
        description: 'Consulta geral',
        location: 'Hospital Santa Casa',
        startAt: getRelativeDateTime(-3, 11, 0),
        endAt: getRelativeDateTime(-3, 12, 0),
        isAllDay: false,
        priority: 'medium' as const,
        status: 'cancelled' as const,
        externalId: null,
        calendarSourceId: null,
        externalUpdatedAt: null,
      },
      // External events from calendar source
      {
        userId: TEST_USER_ID,
        title: 'Dia da Independência',
        description: 'Feriado Nacional',
        location: null,
        startAt: getRelativeDateTime(20, 0, 0),
        endAt: getRelativeDateTime(21, 0, 0),
        isAllDay: true,
        priority: 'low' as const,
        status: 'scheduled' as const,
        externalId: 'holiday-independence-2026',
        calendarSourceId: activeCalendarSourceId,
        externalUpdatedAt: new Date(),
      },
      {
        userId: TEST_USER_ID,
        title: 'Nossa Senhora Aparecida',
        description: 'Feriado Nacional',
        location: null,
        startAt: getRelativeDateTime(30, 0, 0),
        endAt: getRelativeDateTime(31, 0, 0),
        isAllDay: true,
        priority: 'low' as const,
        status: 'scheduled' as const,
        externalId: 'holiday-aparecida-2026',
        calendarSourceId: activeCalendarSourceId,
        externalUpdatedAt: new Date(),
      },
      // Critical priority event
      {
        userId: TEST_USER_ID,
        title: 'Apresentação executiva',
        description: 'Resultados Q1 para diretoria',
        location: 'Sala de reuniões principal',
        startAt: getRelativeDateTime(7, 16, 0),
        endAt: getRelativeDateTime(7, 17, 30),
        isAllDay: false,
        priority: 'critical' as const,
        status: 'scheduled' as const,
        externalId: null,
        calendarSourceId: null,
        externalUpdatedAt: null,
      },
    ];
    const seededEvents = await seedRows('events', eventRecords);
    console.log(`  ✓ ${eventRecords.length} events created\n`);

    // 15. Insert tasks
    console.log('  ✅ Inserting tasks...');
    const taskRecords = [
      // Overdue tasks
      {
        userId: TEST_USER_ID,
        title: 'Revisar proposta comercial',
        description: 'Proposta para cliente ABC',
        location: null,
        dueAt: getRelativeDateTime(-2, 17, 0),
        startAt: null,
        durationMinutes: 60,
        priority: 'high' as const,
        status: 'overdue' as const,
        completedAt: null,
      },
      {
        userId: TEST_USER_ID,
        title: 'Pagar conta de luz',
        description: null,
        location: null,
        dueAt: getRelativeDateTime(-1, 23, 59),
        startAt: null,
        durationMinutes: 15,
        priority: 'medium' as const,
        status: 'overdue' as const,
        completedAt: null,
      },
      // Today's tasks
      {
        userId: TEST_USER_ID,
        title: 'Responder emails importantes',
        description: 'Cliente XYZ e fornecedor',
        location: null,
        dueAt: getRelativeDateTime(0, 18, 0),
        startAt: getRelativeDateTime(0, 16, 0),
        durationMinutes: 30,
        priority: 'high' as const,
        status: 'in_progress' as const,
        completedAt: null,
      },
      {
        userId: TEST_USER_ID,
        title: 'Backup semanal',
        description: 'Backup dos projetos',
        location: null,
        dueAt: getRelativeDateTime(0, 20, 0),
        startAt: null,
        durationMinutes: 20,
        priority: 'low' as const,
        status: 'pending' as const,
        completedAt: null,
      },
      // Upcoming tasks
      {
        userId: TEST_USER_ID,
        title: 'Estudar TypeScript generics',
        description: 'Capítulos 5-7 do curso',
        location: null,
        dueAt: getRelativeDateTime(1, 22, 0),
        startAt: null,
        durationMinutes: 90,
        priority: 'medium' as const,
        status: 'pending' as const,
        completedAt: null,
      },
      {
        userId: TEST_USER_ID,
        title: 'Comprar presente aniversário João',
        description: 'Lembrar de levar no dia 3',
        location: 'Shopping Center',
        dueAt: getRelativeDateTime(2, 19, 0),
        startAt: null,
        durationMinutes: 60,
        priority: 'medium' as const,
        status: 'pending' as const,
        completedAt: null,
      },
      {
        userId: TEST_USER_ID,
        title: 'Preparar apresentação Q1',
        description: 'Slides e relatórios',
        location: null,
        dueAt: getRelativeDateTime(6, 12, 0),
        startAt: getRelativeDateTime(5, 14, 0),
        durationMinutes: 180,
        priority: 'critical' as const,
        status: 'pending' as const,
        completedAt: null,
      },
      {
        userId: TEST_USER_ID,
        title: 'Renovar seguro carro',
        description: 'Vencimento próximo',
        location: null,
        dueAt: getRelativeDateTime(10, 23, 59),
        startAt: null,
        durationMinutes: 30,
        priority: 'high' as const,
        status: 'pending' as const,
        completedAt: null,
      },
      // Completed tasks
      {
        userId: TEST_USER_ID,
        title: 'Enviar relatório mensal',
        description: 'Relatório de dezembro',
        location: null,
        dueAt: getRelativeDateTime(-3, 17, 0),
        startAt: null,
        durationMinutes: 45,
        priority: 'high' as const,
        status: 'completed' as const,
        completedAt: getRelativeDateTime(-3, 16, 30),
      },
      {
        userId: TEST_USER_ID,
        title: 'Marcar consulta dentista',
        description: null,
        location: null,
        dueAt: getRelativeDateTime(-5, 18, 0),
        startAt: null,
        durationMinutes: 10,
        priority: 'low' as const,
        status: 'completed' as const,
        completedAt: getRelativeDateTime(-5, 15, 20),
      },
      // Cancelled task
      {
        userId: TEST_USER_ID,
        title: 'Reunião projeto X - cancelado',
        description: 'Projeto foi pausado',
        location: null,
        dueAt: getRelativeDateTime(8, 14, 0),
        startAt: null,
        durationMinutes: 60,
        priority: 'medium' as const,
        status: 'cancelled' as const,
        completedAt: null,
      },
      // Future task with no duration estimate
      {
        userId: TEST_USER_ID,
        title: 'Organizar arquivos do ano',
        description: 'Limpeza geral de documentos',
        location: null,
        dueAt: getRelativeDateTime(30, 23, 59),
        startAt: null,
        durationMinutes: null,
        priority: 'low' as const,
        status: 'pending' as const,
        completedAt: null,
      },
    ];
    const seededTasks = await seedRows('tasks', taskRecords);
    console.log(`  ✓ ${taskRecords.length} tasks created\n`);

    // 16. Insert recurrence rules
    console.log('  🔄 Inserting recurrence rules...');
    const recurrenceRuleRecords = [
      // Daily standup (weekdays only) - for a recurring event we'll create separately if needed
      {
        itemType: 'event' as const,
        itemId: seededEvents[0].id as number, // Reusing first event as example
        rrule: 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR;UNTIL=20261231T235959Z',
      },
      // Weekly swimming (Tu/Th) - for a recurring event
      {
        itemType: 'event' as const,
        itemId: seededEvents[1].id as number, // Reusing second event as example
        rrule: 'FREQ=WEEKLY;BYDAY=TU,TH;COUNT=20',
      },
      // Monthly backup reminder - for a recurring task
      {
        itemType: 'task' as const,
        itemId: seededTasks[3].id as number, // Backup semanal task
        rrule: 'FREQ=MONTHLY;BYMONTHDAY=1',
      },
      // Bi-weekly meeting
      {
        itemType: 'event' as const,
        itemId: seededEvents[3].id as number, // Reusing another event
        rrule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO',
      },
      // Quarterly review
      {
        itemType: 'task' as const,
        itemId: seededTasks[6].id as number, // Preparar apresentação Q1
        rrule: 'FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=15',
      },
      // Annual renewal
      {
        itemType: 'task' as const,
        itemId: seededTasks[7].id as number, // Renovar seguro carro
        rrule: 'FREQ=YEARLY;BYMONTH=6;BYMONTHDAY=15',
      },
    ];
    await seedRows('recurrenceRules', recurrenceRuleRecords);
    console.log(`  ✓ ${recurrenceRuleRecords.length} recurrence rules created\n`);

    // 17. Insert notifications (configuration for when to send notifications)
    console.log('  🔔 Inserting notification configurations...');
    const notificationRecords = [
      // Event notifications
      { itemType: 'event' as const, itemId: seededEvents[0].id as number, channel: 'email' as const, offsetMinutes: -60, enabled: true }, // 1 hour before
      { itemType: 'event' as const, itemId: seededEvents[1].id as number, channel: 'email' as const, offsetMinutes: -1440, enabled: true }, // 1 day before
      { itemType: 'event' as const, itemId: seededEvents[3].id as number, channel: 'email' as const, offsetMinutes: -120, enabled: true }, // 2 hours before
      { itemType: 'event' as const, itemId: seededEvents[4].id as number, channel: 'email' as const, offsetMinutes: -2880, enabled: true }, // 2 days before
      { itemType: 'event' as const, itemId: seededEvents[10].id as number, channel: 'email' as const, offsetMinutes: -60, enabled: true }, // Critical event
      // Task notifications
      { itemType: 'task' as const, itemId: seededTasks[2].id as number, channel: 'email' as const, offsetMinutes: -120, enabled: true }, // In progress task
      { itemType: 'task' as const, itemId: seededTasks[4].id as number, channel: 'email' as const, offsetMinutes: -60, enabled: true }, // Estudar TypeScript
      { itemType: 'task' as const, itemId: seededTasks[6].id as number, channel: 'email' as const, offsetMinutes: -1440, enabled: true }, // Preparar apresentação (1 day before)
      { itemType: 'task' as const, itemId: seededTasks[7].id as number, channel: 'email' as const, offsetMinutes: -10080, enabled: true }, // Renovar seguro (7 days before)
      // Disabled notification (for testing)
      { itemType: 'event' as const, itemId: seededEvents[2].id as number, channel: 'email' as const, offsetMinutes: -60, enabled: false },
    ];
    const seededNotifications = await seedRows('notifications', notificationRecords);
    console.log(`  ✓ ${notificationRecords.length} notification configurations created\n`);

    // 18. Insert notification jobs (actual scheduled notifications in queue)
    console.log('  📬 Inserting notification jobs...');
    const notificationJobRecords = [
      // Pending jobs (not yet sent)
      {
        itemType: 'event' as const,
        itemId: seededEvents[0].id as number,
        notificationId: seededNotifications[0].id as number,
        channel: 'email' as const,
        scheduledAt: getRelativeDateTime(1, 9, 0), // 1 hour before event
        status: 'pending' as const,
        attempts: 0,
        lastError: null,
        sentAt: null,
      },
      {
        itemType: 'event' as const,
        itemId: seededEvents[3].id as number,
        notificationId: seededNotifications[2].id as number,
        channel: 'email' as const,
        scheduledAt: getRelativeDateTime(4, 10, 0), // 2 hours before event
        status: 'pending' as const,
        attempts: 0,
        lastError: null,
        sentAt: null,
      },
      {
        itemType: 'task' as const,
        itemId: seededTasks[4].id as number,
        notificationId: seededNotifications[6].id as number,
        channel: 'email' as const,
        scheduledAt: getRelativeDateTime(1, 21, 0), // 1 hour before task due
        status: 'pending' as const,
        attempts: 0,
        lastError: null,
        sentAt: null,
      },
      // Sent jobs (successfully delivered)
      {
        itemType: 'event' as const,
        itemId: seededEvents[5].id as number,
        notificationId: seededNotifications[0].id as number,
        channel: 'email' as const,
        scheduledAt: getRelativeDateTime(-1, 8, 0),
        status: 'sent' as const,
        attempts: 1,
        lastError: null,
        sentAt: getRelativeDateTime(-1, 8, 5),
      },
      {
        itemType: 'task' as const,
        itemId: seededTasks[8].id as number,
        notificationId: seededNotifications[7].id as number,
        channel: 'email' as const,
        scheduledAt: getRelativeDateTime(-4, 16, 0),
        status: 'sent' as const,
        attempts: 1,
        lastError: null,
        sentAt: getRelativeDateTime(-4, 16, 2),
      },
      // Failed job (delivery failed after retries)
      {
        itemType: 'event' as const,
        itemId: seededEvents[1].id as number,
        notificationId: seededNotifications[1].id as number,
        channel: 'email' as const,
        scheduledAt: getRelativeDateTime(1, 14, 30),
        status: 'failed' as const,
        attempts: 3,
        lastError: 'SMTP connection timeout after 3 retries',
        sentAt: null,
      },
      // Cancelled job (event was cancelled or notification disabled)
      {
        itemType: 'event' as const,
        itemId: seededEvents[7].id as number,
        notificationId: seededNotifications[0].id as number,
        channel: 'email' as const,
        scheduledAt: getRelativeDateTime(-3, 10, 0),
        status: 'cancelled' as const,
        attempts: 0,
        lastError: 'Event was cancelled',
        sentAt: null,
      },
      // Another pending notification for critical event
      {
        itemType: 'event' as const,
        itemId: seededEvents[10].id as number,
        notificationId: seededNotifications[4].id as number,
        channel: 'email' as const,
        scheduledAt: getRelativeDateTime(7, 15, 0),
        status: 'pending' as const,
        attempts: 0,
        lastError: null,
        sentAt: null,
      },
    ];
    await seedRows('notificationJobs', notificationJobRecords);
    console.log(`  ✓ ${notificationJobRecords.length} notification jobs created\n`);

    // 19. Insert bill reminders
    console.log('  📋 Inserting bill reminders...');
    const billReminderRecords = [
      // Monthly bills
      {
        userId: TEST_USER_ID,
        name: 'Aluguel',
        categoryId: categoryMap['Contas'],
        amount: 65000, // R$ 650
        dueDay: 5,
        dueTime: null,
        status: 'active' as const,
        recurrenceType: 'monthly',
        startMonth: getYearMonth(-3), // Started 3 months ago
        endMonth: null, // Ongoing
        notify2DaysBefore: true,
        notify1DayBefore: true,
        notifyOnDueDay: true,
        lastAcknowledgedMonth: getYearMonth(-1),
      },
      {
        userId: TEST_USER_ID,
        name: 'Conta de Luz',
        categoryId: categoryMap['Contas'],
        amount: 12000, // R$ 120
        dueDay: 10,
        dueTime: null,
        status: 'active' as const,
        recurrenceType: 'monthly',
        startMonth: getYearMonth(-6),
        endMonth: null,
        notify2DaysBefore: false,
        notify1DayBefore: true,
        notifyOnDueDay: true,
        lastAcknowledgedMonth: getYearMonth(-1),
      },
      {
        userId: TEST_USER_ID,
        name: 'Internet',
        categoryId: categoryMap['Contas'],
        amount: 10000, // R$ 100
        dueDay: 15,
        dueTime: null,
        status: 'active' as const,
        recurrenceType: 'monthly',
        startMonth: getYearMonth(-12),
        endMonth: null,
        notify2DaysBefore: true,
        notify1DayBefore: false,
        notifyOnDueDay: true,
        lastAcknowledgedMonth: null, // Not acknowledged yet
      },
      {
        userId: TEST_USER_ID,
        name: 'Netflix',
        categoryId: categoryMap['Entretenimento'],
        amount: 4500, // R$ 45
        dueDay: 1,
        dueTime: null,
        status: 'active' as const,
        recurrenceType: 'monthly',
        startMonth: getYearMonth(-24),
        endMonth: null,
        notify2DaysBefore: false,
        notify1DayBefore: false,
        notifyOnDueDay: true, // Only notify on due day
        lastAcknowledgedMonth: getYearMonth(0),
      },
      {
        userId: TEST_USER_ID,
        name: 'Spotify',
        categoryId: categoryMap['Entretenimento'],
        amount: 2990, // R$ 29.90
        dueDay: 12,
        dueTime: null,
        status: 'active' as const,
        recurrenceType: 'monthly',
        startMonth: getYearMonth(-18),
        endMonth: null,
        notify2DaysBefore: false,
        notify1DayBefore: true,
        notifyOnDueDay: false,
        lastAcknowledgedMonth: getYearMonth(-1),
      },
      {
        userId: TEST_USER_ID,
        name: 'Seguro do Carro',
        categoryId: categoryMap['Contas'],
        amount: 15000, // R$ 150
        dueDay: 20,
        dueTime: null,
        status: 'active' as const,
        recurrenceType: 'monthly',
        startMonth: getYearMonth(-8),
        endMonth: null,
        notify2DaysBefore: true,
        notify1DayBefore: true,
        notifyOnDueDay: true,
        lastAcknowledgedMonth: null,
      },
      // Quarterly bill (IPTU - property tax in Brazil)
      {
        userId: TEST_USER_ID,
        name: 'IPTU',
        categoryId: categoryMap['Contas'],
        amount: 45000, // R$ 450
        dueDay: 15,
        dueTime: null,
        status: 'active' as const,
        recurrenceType: 'quarterly',
        startMonth: '2026-01', // Started this year
        endMonth: null,
        notify2DaysBefore: true,
        notify1DayBefore: true,
        notifyOnDueDay: true,
        lastAcknowledgedMonth: null,
      },
      // Completed/cancelled bill (old gym subscription)
      {
        userId: TEST_USER_ID,
        name: 'Academia SmartFit',
        categoryId: categoryMap['Saúde'],
        amount: 8000, // R$ 80
        dueDay: 5,
        dueTime: null,
        status: 'completed' as const,
        recurrenceType: 'monthly',
        startMonth: getYearMonth(-15),
        endMonth: getYearMonth(-3), // Ended 3 months ago
        notify2DaysBefore: false,
        notify1DayBefore: true,
        notifyOnDueDay: true,
        lastAcknowledgedMonth: getYearMonth(-3),
      },
    ];
    await seedRows('billReminders', billReminderRecords);
    console.log(`  ✓ ${billReminderRecords.length} bill reminders created\n`);

    await resetSequences();

    console.log('✅ Seeding complete!\n');
    console.log('📊 Summary:');
    console.log(`   Users: ${userRecords.length}`);
    console.log(`   Accounts: ${seededAccounts.length}`);
    console.log(`   Categories: ${seededCategories.length}`);
    console.log(`   Budgets: ${budgetRecords.length}`);
    console.log(`   Monthly Budgets: ${monthlyBudgetRecords.length}`);
    console.log(`   Transactions: ${seededTransactions.length}`);
    console.log(`   Entries: ${entryRecords.length}`);
    console.log(`   Faturas: ${faturaRecords.length}`);
    console.log(`   Transfers: ${transferRecords.length}`);
    console.log(`   Income: ${incomeRecords.length}`);
    console.log(`   Category Frequency: ${categoryFrequencyRecords.length}`);
    console.log(`   User Settings: ${userSettingsRecords.length}`);
    console.log(`   Calendar Sources: ${calendarSourceRecords.length}`);
    console.log(`   Events: ${eventRecords.length}`);
    console.log(`   Tasks: ${taskRecords.length}`);
    console.log(`   Recurrence Rules: ${recurrenceRuleRecords.length}`);
    console.log(`   Notifications: ${notificationRecords.length}`);
    console.log(`   Notification Jobs: ${notificationJobRecords.length}`);
    console.log(`   Bill Reminders: ${billReminderRecords.length}`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
