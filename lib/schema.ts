import { boolean, date, integer, pgEnum, pgTable, serial, text, timestamp, unique, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Export Auth.js schema tables
export * from './auth-schema';

// Enum for account types
export const accountTypeEnum = pgEnum('account_type', ['credit_card', 'checking', 'savings', 'cash']);

// Enum for category types
export const categoryTypeEnum = pgEnum('category_type', ['expense', 'income']);

// Enum for transfer types
export const transferTypeEnum = pgEnum('transfer_type', ['fatura_payment', 'internal_transfer', 'deposit', 'withdrawal']);

// Enums for events and tasks
export const priorityEnum = pgEnum('priority', ['low', 'medium', 'high', 'critical']);
export const eventStatusEnum = pgEnum('event_status', ['scheduled', 'cancelled', 'completed']);
export const taskStatusEnum = pgEnum('task_status', ['pending', 'in_progress', 'completed', 'cancelled', 'overdue']);
export const itemTypeEnum = pgEnum('item_type', ['event', 'task', 'bill_reminder']);
export const notificationChannelEnum = pgEnum('notification_channel', ['email']);
export const notificationStatusEnum = pgEnum('notification_status', ['pending', 'sent', 'failed', 'cancelled']);
export const calendarSourceStatusEnum = pgEnum('calendar_source_status', ['active', 'error', 'disabled']);
export const billReminderStatusEnum = pgEnum('bill_reminder_status', ['active', 'paused', 'completed']);

// Accounts table
export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  type: accountTypeEnum('type').notNull(),
  currency: text('currency').default('BRL'),
  currentBalance: integer('current_balance').notNull().default(0), // cents
  lastBalanceUpdate: timestamp('last_balance_update').defaultNow(),
  // Credit card billing cycle config (1-28, null for non-CC accounts)
  closingDay: integer('closing_day'),
  paymentDueDay: integer('payment_due_day'),
  creditLimit: integer('credit_limit'), // nullable, cents - only for credit cards
  bankLogo: text('bank_logo'), // nullable, bank logo key (e.g., "nubank", "inter")
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
  description: text('description'),
  totalAmount: integer('total_amount').notNull(), // cents
  totalInstallments: integer('total_installments').notNull().default(1),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id, { onDelete: 'restrict' }),
  externalId: text('external_id'), // UUID from bank statement for idempotency
  ignored: boolean('ignored').notNull().default(false),
  refundedAmount: integer('refunded_amount').default(0), // cached sum of refunds (cents)
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
    closingDate: date('closing_date').notNull(), // actual closing date for this billing cycle
    startDate: date('start_date'), // null = calculated from previous fatura's closing date + 1
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

// Transfers table (account-to-account movements, including fatura payments)
export const transfers = pgTable('transfers', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  fromAccountId: integer('from_account_id').references(() => accounts.id),
  toAccountId: integer('to_account_id').references(() => accounts.id),
  amount: integer('amount').notNull(), // cents
  date: date('date').notNull(),
  type: transferTypeEnum('type').notNull(),
  faturaId: integer('fatura_id').references(() => faturas.id),
  description: text('description'),
  externalId: text('external_id'), // UUID from bank statement - preserves idempotency when expenses are converted to fatura payments
  ignored: boolean('ignored').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Income table
export const income = pgTable('income', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  description: text('description'),
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
  ignored: boolean('ignored').notNull().default(false),
  // Optional link to expense category for budget replenishment
  replenishCategoryId: integer('replenish_category_id')
    .references(() => categories.id, { onDelete: 'set null' }),
  // Optional link to transaction for credit card refunds
  refundOfTransactionId: integer('refund_of_transaction_id')
    .references(() => transactions.id, { onDelete: 'set null' }),
  faturaMonth: text('fatura_month'), // "YYYY-MM" format - which fatura to credit (nullable for non-CC income)
  createdAt: timestamp('created_at').defaultNow(),
});

// Category Frequency table (for smart categorization suggestions)
export const categoryFrequency = pgTable(
  'category_frequency',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    descriptionNormalized: text('description_normalized').notNull(), // LOWER(TRIM(description))
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    type: categoryTypeEnum('type').notNull(), // 'expense' | 'income'
    count: integer('count').notNull().default(1),
    lastUsedAt: timestamp('last_used_at').defaultNow(),
  },
  (table) => ({
    uniqueUserDescCatType: unique().on(
      table.userId,
      table.descriptionNormalized,
      table.categoryId,
      table.type
    ),
    lookupIdx: sql`CREATE INDEX IF NOT EXISTS category_frequency_lookup_idx ON category_frequency (user_id, description_normalized, type)`,
  })
);

// Calendar sources table (external iCal subscriptions)
export const calendarSources = pgTable('calendar_sources', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  status: calendarSourceStatusEnum('status').notNull().default('active'),
  color: text('color').default('#3b82f6'),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  lastError: text('last_error'),
  syncToken: text('sync_token'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueUserUrl: unique().on(table.userId, table.url),
}));

// Events table
export const events = pgTable('events', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  location: text('location'),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  endAt: timestamp('end_at', { withTimezone: true }).notNull(),
  isAllDay: boolean('is_all_day').notNull().default(false),
  priority: priorityEnum('priority').notNull().default('medium'),
  status: eventStatusEnum('status').notNull().default('scheduled'),
  externalId: text('external_id'),
  calendarSourceId: integer('calendar_source_id').references(() => calendarSources.id, { onDelete: 'cascade' }),
  externalUpdatedAt: timestamp('external_updated_at', { withTimezone: true }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  startBeforeEnd: check('start_before_end', sql`${table.startAt} < ${table.endAt}`),
}));

// Tasks table
export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  location: text('location'),
  dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
  startAt: timestamp('start_at', { withTimezone: true }),
  durationMinutes: integer('duration_minutes'),
  priority: priorityEnum('priority').notNull().default('medium'),
  status: taskStatusEnum('status').notNull().default('pending'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  startBeforeDue: check('start_before_due', sql`${table.startAt} IS NULL OR ${table.startAt} <= ${table.dueAt}`),
  durationPositive: check('duration_positive', sql`${table.durationMinutes} IS NULL OR ${table.durationMinutes} > 0`),
  completedAtStatusInvariant: check('completed_at_status_invariant', sql`
    (${table.status} = 'completed' AND ${table.completedAt} IS NOT NULL) OR
    (${table.status} != 'completed' AND ${table.completedAt} IS NULL)
  `),
}));

// Recurrence rules table
export const recurrenceRules = pgTable('recurrence_rules', {
  id: serial('id').primaryKey(),
  itemType: itemTypeEnum('item_type').notNull(),
  itemId: integer('item_id').notNull(),
  rrule: text('rrule').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Notifications table
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  itemType: itemTypeEnum('item_type').notNull(),
  itemId: integer('item_id').notNull(),
  channel: notificationChannelEnum('channel').notNull(),
  offsetMinutes: integer('offset_minutes').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Notification jobs table
export const notificationJobs = pgTable('notification_jobs', {
  id: serial('id').primaryKey(),
  itemType: itemTypeEnum('item_type').notNull(),
  itemId: integer('item_id').notNull(),
  notificationId: integer('notification_id').references(() => notifications.id, { onDelete: 'cascade' }),
  channel: notificationChannelEnum('channel').notNull(),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  status: notificationStatusEnum('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// User settings table
export const userSettings = pgTable(
  'user_settings',
  {
    id: serial('id').primaryKey(),
    userId: text('user_id').notNull(),
    timezone: text('timezone').default('UTC'),
    locale: text('locale').default('pt-BR'),
    notificationEmail: text('notification_email'),
    notificationsEnabled: boolean('notifications_enabled').default(true),
    defaultEventOffsetMinutes: integer('default_event_offset_minutes').default(60),
    defaultTaskOffsetMinutes: integer('default_task_offset_minutes').default(60),
    onboardingCompletedAt: timestamp('onboarding_completed_at'),
    onboardingSkippedAt: timestamp('onboarding_skipped_at'),
    hintsViewed: text('hints_viewed'), // JSON array: ["dashboard", "expenses", ...]
    // Analytics milestones
    firstExpenseCreatedAt: timestamp('first_expense_created_at'),
    firstImportCompletedAt: timestamp('first_import_completed_at'),
    firstBudgetCreatedAt: timestamp('first_budget_created_at'),
    firstCustomCategoryCreatedAt: timestamp('first_custom_category_created_at'),
    firstExportCompletedAt: timestamp('first_export_completed_at'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => ({
    uniqueUser: unique().on(table.userId),
  })
);

// Bill reminders table
export const billReminders = pgTable('bill_reminders', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'set null' }),
  amount: integer('amount'), // cents, optional
  dueDay: integer('due_day').notNull(), // 1-31 for monthly, 0-6 for weekly
  dueTime: text('due_time'), // "HH:mm" or null
  status: billReminderStatusEnum('status').notNull().default('active'),
  recurrenceType: text('recurrence_type').notNull().default('monthly'), // 'once' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
  startMonth: text('start_month').notNull(), // 'YYYY-MM'
  endMonth: text('end_month'), // 'YYYY-MM' or null (forever)
  notify2DaysBefore: boolean('notify_2_days_before').notNull().default(true),
  notify1DayBefore: boolean('notify_1_day_before').notNull().default(true),
  notifyOnDueDay: boolean('notify_on_due_day').notNull().default(true),
  lastAcknowledgedMonth: text('last_acknowledged_month'), // for in-app banner dismissal
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
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

export type CategoryFrequency = typeof categoryFrequency.$inferSelect;
export type NewCategoryFrequency = typeof categoryFrequency.$inferInsert;

export type CalendarSource = typeof calendarSources.$inferSelect;
export type NewCalendarSource = typeof calendarSources.$inferInsert;

export type Fatura = typeof faturas.$inferSelect;
export type NewFatura = typeof faturas.$inferInsert;

export type Transfer = typeof transfers.$inferSelect;
export type NewTransfer = typeof transfers.$inferInsert;

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type RecurrenceRule = typeof recurrenceRules.$inferSelect;
export type NewRecurrenceRule = typeof recurrenceRules.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;

export type NotificationJob = typeof notificationJobs.$inferSelect;
export type NewNotificationJob = typeof notificationJobs.$inferInsert;

export type UserSettings = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;

export type BillReminder = typeof billReminders.$inferSelect;
export type NewBillReminder = typeof billReminders.$inferInsert;

// Relations
import { relations } from 'drizzle-orm';

export const transactionsRelations = relations(transactions, ({ many, one }) => ({
  entries: many(entries),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  refunds: many(income),
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
  transfersFrom: many(transfers, { relationName: 'transfersFrom' }),
  transfersTo: many(transfers, { relationName: 'transfersTo' }),
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
  replenishCategory: one(categories, {
    fields: [income.replenishCategoryId],
    references: [categories.id],
  }),
  refundOfTransaction: one(transactions, {
    fields: [income.refundOfTransactionId],
    references: [transactions.id],
  }),
}));

export const categoryFrequencyRelations = relations(categoryFrequency, ({ one }) => ({
  category: one(categories, {
    fields: [categoryFrequency.categoryId],
    references: [categories.id],
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

export const transfersRelations = relations(transfers, ({ one }) => ({
  fromAccount: one(accounts, {
    fields: [transfers.fromAccountId],
    references: [accounts.id],
    relationName: 'transfersFrom',
  }),
  toAccount: one(accounts, {
    fields: [transfers.toAccountId],
    references: [accounts.id],
    relationName: 'transfersTo',
  }),
  fatura: one(faturas, {
    fields: [transfers.faturaId],
    references: [faturas.id],
  }),
}));

export const calendarSourcesRelations = relations(calendarSources, ({ many }) => ({
  events: many(events),
}));

export const eventsRelations = relations(events, ({ many, one }) => ({
  recurrenceRules: many(recurrenceRules),
  notifications: many(notifications),
  notificationJobs: many(notificationJobs),
  calendarSource: one(calendarSources, {
    fields: [events.calendarSourceId],
    references: [calendarSources.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ many }) => ({
  recurrenceRules: many(recurrenceRules),
  notifications: many(notifications),
  notificationJobs: many(notificationJobs),
}));

export const recurrenceRulesRelations = relations(recurrenceRules, ({ many }) => ({
  notificationJobs: many(notificationJobs),
}));

export const notificationsRelations = relations(notifications, ({ many }) => ({
  notificationJobs: many(notificationJobs),
}));

export const userSettingsRelations = relations(userSettings, () => ({}));

export const billRemindersRelations = relations(billReminders, ({ one }) => ({
  category: one(categories, {
    fields: [billReminders.categoryId],
    references: [categories.id],
  }),
}));
