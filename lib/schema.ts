import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

// Accounts table
export const accounts = sqliteTable('accounts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: ['credit_card', 'checking', 'savings', 'cash'] }).notNull(),
  currency: text('currency').default('BRL'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// Categories table
export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  color: text('color').notNull().default('#6b7280'),
  icon: text('icon'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// Budgets table
export const budgets = sqliteTable(
  'budgets',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    yearMonth: text('year_month').notNull(), // '2024-01'
    amount: integer('amount').notNull(), // cents
    createdAt: text('created_at').default(sql`(datetime('now'))`),
  },
  (table) => ({
    uniqueCategoryMonth: unique().on(table.categoryId, table.yearMonth),
  })
);

// Transactions table (parent for installments)
export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  description: text('description').notNull(),
  totalAmount: integer('total_amount').notNull(), // cents
  totalInstallments: integer('total_installments').notNull().default(1),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// Entries table (actual monthly charges)
export const entries = sqliteTable('entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  transactionId: integer('transaction_id')
    .notNull()
    .references(() => transactions.id, { onDelete: 'cascade' }),
  accountId: integer('account_id')
    .notNull()
    .references(() => accounts.id),
  amount: integer('amount').notNull(), // cents
  dueDate: text('due_date').notNull(), // 'YYYY-MM-DD'
  paidAt: text('paid_at'), // null = pending, date = paid
  installmentNumber: integer('installment_number').notNull().default(1),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// Type exports for TypeScript
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;

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
}));

export const accountsRelations = relations(accounts, ({ many }) => ({
  entries: many(entries),
}));
