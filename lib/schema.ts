import { boolean, date, integer, pgEnum, pgTable, serial, text, timestamp, unique } from 'drizzle-orm/pg-core';

// Enum for account types
export const accountTypeEnum = pgEnum('account_type', ['credit_card', 'checking', 'savings', 'cash']);

// Enum for category types
export const categoryTypeEnum = pgEnum('category_type', ['expense', 'income']);

// Accounts table
export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  type: accountTypeEnum('type').notNull(),
  currency: text('currency').default('BRL'),
  // Credit card billing cycle config (1-28, null for non-CC accounts)
  closingDay: integer('closing_day'),
  paymentDueDay: integer('payment_due_day'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Categories table
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6b7280'),
  icon: text('icon'),
  type: categoryTypeEnum('type').notNull().default('expense'),
  isImportDefault: boolean('is_import_default').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Budgets table
export const budgets = pgTable(
  'budgets',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    yearMonth: text('year_month').notNull(), // '2024-01'
    amount: integer('amount').notNull(), // cents
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqueCategoryMonth: unique().on(table.userId, table.categoryId, table.yearMonth),
  })
);

// Monthly Budgets table (total budget per month)
export const monthlyBudgets = pgTable(
  'monthly_budgets',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    yearMonth: text('year_month').notNull(),
    amount: integer('amount').notNull(), // cents
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqueUserMonth: unique().on(table.userId, table.yearMonth),
  })
);

// Transactions table (parent for installments)
export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  description: text('description').notNull(),
  totalAmount: integer('total_amount').notNull(), // cents
  totalInstallments: integer('total_installments').notNull().default(1),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  externalId: text('external_id'), // UUID from bank statement for idempotency
  createdAt: timestamp('created_at').defaultNow(),
});

// Entries table (actual monthly charges)
export const entries = pgTable('entries', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  transactionId: integer('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  accountId: integer('account_id')
    .notNull()
    .references(() => accounts.id),
  amount: integer('amount').notNull(), // cents
  purchaseDate: date('purchase_date').notNull(), // When expense occurred (budget impact)
  faturaMonth: text('fatura_month').notNull(), // "YYYY-MM" format - which statement it belongs to
  dueDate: date('due_date').notNull(), // When fatura payment is due (cash flow impact)
  paidAt: timestamp('paid_at'), // null = pending, timestamp = paid
  installmentNumber: integer('installment_number').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
});

// Faturas table (credit card statements/bills)
export const faturas = pgTable(
  'faturas',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    accountId: integer('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    yearMonth: text('year_month').notNull(), // "2025-01"
    totalAmount: integer('total_amount').notNull().default(0), // cached sum of entries
    dueDate: date('due_date').notNull(), // when payment is due
    paidAt: timestamp('paid_at'), // null = pending, timestamp = paid
    paidFromAccountId: integer('paid_from_account_id').references(() => accounts.id), // which checking account paid it
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => ({
    uniqueAccountMonth: unique().on(table.accountId, table.yearMonth),
  })
);

// Income table
export const income = pgTable('income', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  description: text('description').notNull(),
  amount: integer('amount').notNull(), // cents
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  accountId: integer('account_id')
    .notNull()
    .references(() => accounts.id),
  receivedDate: date('received_date').notNull(),
  receivedAt: timestamp('received_at'), // null = pending, timestamp = received
  externalId: text('external_id'), // UUID from bank statement for idempotency
  createdAt: timestamp('created_at').defaultNow(),
});

// Type exports for TypeScript
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;

export type MonthlyBudget = typeof monthlyBudgets.$inferSelect;
export type NewMonthlyBudget = typeof monthlyBudgets.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;

export type Income = typeof income.$inferSelect;
export type NewIncome = typeof income.$inferInsert;

export type Fatura = typeof faturas.$inferSelect;
export type NewFatura = typeof faturas.$inferInsert;

// Relations
import { relations } from 'drizzle-orm';

export const transactionsRelations = relations(transactions, ({ many, one }) => ({
  entries: many(entries),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));

export const entriesRelations = relations(entries, ({ one }) => ({
  transaction: one(transactions, {
    fields: [entries.transactionId],
    references: [transactions.id],
  }),
  account: one(accounts, {
    fields: [entries.accountId],
    references: [accounts.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
  income: many(income),
}));

export const accountsRelations = relations(accounts, ({ many }) => ({
  entries: many(entries),
  income: many(income),
}));

export const incomeRelations = relations(income, ({ one }) => ({
  category: one(categories, {
    fields: [income.categoryId],
    references: [categories.id],
  }),
  account: one(accounts, {
    fields: [income.accountId],
    references: [accounts.id],
  }),
}));

export const faturasRelations = relations(faturas, ({ one }) => ({
  account: one(accounts, {
    fields: [faturas.accountId],
    references: [accounts.id],
  }),
  paidFromAccount: one(accounts, {
    fields: [faturas.paidFromAccountId],
    references: [accounts.id],
  }),
}));
