import type {
  NewAccount,
  NewCategory,
  NewTransaction,
  NewEntry,
  NewIncome,
  NewEvent,
  NewTask,
  NewCalendarSource,
  NewTransfer,
  NewFatura,
  NewMonthlyBudget,
} from '@/lib/schema';

export const TEST_USER_ID = 'test-user-fixtures-id';

export const testAccounts = {
  creditCard: {
    userId: TEST_USER_ID,
    name: 'Test Credit Card',
    type: 'credit_card' as const,
  },
  creditCardWithBilling: {
    userId: TEST_USER_ID,
    name: 'Test CC with Billing',
    type: 'credit_card' as const,
    closingDay: 15,
    paymentDueDay: 5,
  },
  checking: {
    userId: TEST_USER_ID,
    name: 'Test Checking',
    type: 'checking' as const,
  },
} satisfies Record<string, NewAccount>;

export const testCategories = {
  expense: {
    userId: TEST_USER_ID,
    name: 'Test Expense Category',
    color: '#ef4444',
    icon: 'Restaurant01Icon',
    type: 'expense' as const,
  },
  income: {
    userId: TEST_USER_ID,
    name: 'Test Salary',
    color: '#22c55e',
    icon: 'MoneyBag01Icon',
    type: 'income' as const,
  },
} satisfies Record<string, NewCategory>;

export function createTestTransaction(overrides: Partial<NewTransaction> = {}): NewTransaction {
  return {
    userId: TEST_USER_ID,
    description: 'Test Transaction',
    totalAmount: 10000, // R$ 100
    totalInstallments: 1,
    categoryId: 1,
    ...overrides,
  };
}

export function createTestEntry(overrides: Partial<NewEntry> = {}): NewEntry {
  const date = new Date().toISOString().split('T')[0];
  return {
    userId: TEST_USER_ID,
    transactionId: 1,
    accountId: 1,
    amount: 10000,
    purchaseDate: date,
    faturaMonth: date.slice(0, 7),
    dueDate: date,
    installmentNumber: 1,
    paidAt: null,
    ...overrides,
  };
}

export function createTestIncome(overrides: Partial<NewIncome> = {}): NewIncome {
  return {
    userId: TEST_USER_ID,
    description: 'Test Income',
    amount: 50000, // R$ 500
    categoryId: 2,
    accountId: 1,
    receivedDate: new Date().toISOString().split('T')[0],
    receivedAt: null,
    ...overrides,
  };
}

type TransferVariant = 'internal' | 'deposit' | 'withdrawal';

export function createTestTransfer(
  variant: TransferVariant = 'internal',
  overrides: Partial<NewTransfer> = {}
): NewTransfer {
  const date = new Date().toISOString().split('T')[0];
  const base: NewTransfer = {
    userId: TEST_USER_ID,
    amount: 15000, // R$ 150
    date,
    type: 'internal_transfer',
    fromAccountId: 1,
    toAccountId: 2,
    description: 'Test Transfer',
  };

  if (variant === 'deposit') {
    return {
      ...base,
      type: 'deposit',
      fromAccountId: null,
      toAccountId: 1,
      ...overrides,
    };
  }

  if (variant === 'withdrawal') {
    return {
      ...base,
      type: 'withdrawal',
      fromAccountId: 1,
      toAccountId: null,
      ...overrides,
    };
  }

  return {
    ...base,
    ...overrides,
  };
}

export function createTestFatura(overrides: Partial<NewFatura> = {}): NewFatura {
  const dueDate = new Date().toISOString().split('T')[0];
  return {
    userId: TEST_USER_ID,
    accountId: 1,
    yearMonth: dueDate.slice(0, 7),
    totalAmount: 20000, // R$ 200
    dueDate,
    ...overrides,
  };
}

export function createTestMonthlyBudget(overrides: Partial<NewMonthlyBudget> = {}): NewMonthlyBudget {
  const yearMonth = new Date().toISOString().slice(0, 7);
  return {
    userId: TEST_USER_ID,
    yearMonth,
    amount: 50000, // R$ 500
    ...overrides,
  };
}

export const testEvents = {
  basic: {
    userId: TEST_USER_ID,
    title: 'Test Event',
    startAt: new Date('2026-02-01T10:00:00Z'),
    endAt: new Date('2026-02-01T11:00:00Z'),
  },
  withDetails: {
    userId: TEST_USER_ID,
    title: 'Test Event with Details',
    description: 'Test description',
    location: 'Test Location',
    startAt: new Date('2026-02-01T14:00:00Z'),
    endAt: new Date('2026-02-01T15:30:00Z'),
    priority: 'high' as const,
  },
  allDay: {
    userId: TEST_USER_ID,
    title: 'Test All Day Event',
    startAt: new Date('2026-02-01T00:00:00Z'),
    endAt: new Date('2026-02-01T23:59:59Z'),
    isAllDay: true,
  },
} satisfies Record<string, NewEvent>;

export function createTestEvent(overrides: Partial<NewEvent> = {}): NewEvent {
  const startAt = new Date('2026-02-01T10:00:00Z');
  const endAt = new Date('2026-02-01T11:00:00Z');
  return {
    userId: TEST_USER_ID,
    title: 'Test Event',
    startAt,
    endAt,
    ...overrides,
  };
}

export function createTestTask(overrides: Partial<NewTask> = {}): NewTask {
  const dueAt = new Date('2026-02-01T12:00:00Z');
  return {
    userId: TEST_USER_ID,
    title: 'Test Task',
    dueAt,
    ...overrides,
  };
}

export const testCalendarSources = {
  google: {
    userId: TEST_USER_ID,
    name: 'Google Calendar',
    url: 'https://calendar.google.com/calendar/ical/example/basic.ics',
    color: '#3b82f6',
    status: 'active' as const,
  },
  outlook: {
    userId: TEST_USER_ID,
    name: 'Outlook Calendar',
    url: 'https://outlook.office365.com/owa/calendar/example/calendar.ics',
    color: '#10b981',
    status: 'active' as const,
  },
} satisfies Record<string, NewCalendarSource>;

export function createTestCalendarSource(overrides: Partial<NewCalendarSource> = {}): NewCalendarSource {
  return {
    userId: TEST_USER_ID,
    name: 'Test Calendar',
    url: 'https://example.com/calendar.ics',
    color: '#3b82f6',
    status: 'active' as const,
    ...overrides,
  };
}
