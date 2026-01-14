// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Account, Category, Transaction, Entry, Income } from '@/lib/schema';
import { TransactionForm } from '@/components/transaction-form';
import { createExpense, updateExpense } from '@/lib/actions/expenses';
import { createIncome, updateIncome } from '@/lib/actions/income';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/actions/expenses', () => ({
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
}));

vi.mock('@/lib/actions/income', () => ({
  createIncome: vi.fn(),
  updateIncome: vi.fn(),
}));

vi.mock('@/lib/contexts/expense-context', () => ({
  useExpenseContextOptional: () => null,
}));

vi.mock('@/lib/contexts/income-context', () => ({
  useIncomeContextOptional: () => null,
}));

const baseAccounts: Account[] = [
  {
    id: 1,
    userId: 'user',
    name: 'Checking',
    type: 'checking',
    currency: 'BRL',
    currentBalance: 0,
    lastBalanceUpdate: new Date('2026-01-01T00:00:00Z'),
    closingDay: null,
    paymentDueDay: null,
    creditLimit: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 2,
    userId: 'user',
    name: 'Savings',
    type: 'savings',
    currency: 'BRL',
    currentBalance: 0,
    lastBalanceUpdate: new Date('2026-01-01T00:00:00Z'),
    closingDay: null,
    paymentDueDay: null,
    creditLimit: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  },
];

const baseCategories: Category[] = [
  {
    id: 10,
    userId: 'user',
    name: 'Groceries',
    color: '#ef4444',
    icon: 'Restaurant01Icon',
    type: 'expense',
    isImportDefault: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  },
  {
    id: 20,
    userId: 'user',
    name: 'Salary',
    color: '#22c55e',
    icon: 'MoneyBag01Icon',
    type: 'income',
    isImportDefault: false,
    createdAt: new Date('2026-01-01T00:00:00Z'),
  },
];

const baseEntry: Entry = {
  id: 1,
  userId: 'user',
  transactionId: 99,
  accountId: 1,
  amount: 5000,
  purchaseDate: '2026-01-10',
  faturaMonth: '2026-01',
  dueDate: '2026-01-20',
  paidAt: null,
  installmentNumber: 1,
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const baseTransaction: Transaction & { entries: Entry[] } = {
  id: 99,
  userId: 'user',
  description: 'Groceries',
  totalAmount: 10000,
  totalInstallments: 2,
  categoryId: 10,
  externalId: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  entries: [baseEntry],
};

const baseIncome: Pick<Income, 'id' | 'description' | 'amount' | 'categoryId' | 'accountId' | 'receivedDate'> = {
  id: 55,
  description: 'Salary',
  amount: 75000,
  categoryId: 20,
  accountId: 1,
  receivedDate: '2026-01-05',
};

describe('TransactionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders expense installments slider and per-installment text', () => {
    render(
      <TransactionForm
        mode="expense"
        accounts={baseAccounts}
        categories={baseCategories}
        transaction={baseTransaction}
        open
        onOpenChange={() => { }}
      />
    );

    expect(screen.getByText('installments')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="slider"]')).toBeInTheDocument();
    expect(screen.getByText(/2x de R\$\s*50,00/)).toBeInTheDocument();
  });

  it('disables submit when accounts or categories are missing', () => {
    const { rerender } = render(
      <TransactionForm
        mode="expense"
        accounts={[]}
        categories={baseCategories}
        open
        onOpenChange={() => { }}
      />
    );

    expect(screen.getByRole('button', { name: 'create' })).toBeDisabled();

    rerender(
      <TransactionForm
        mode="expense"
        accounts={baseAccounts}
        categories={[]}
        open
        onOpenChange={() => { }}
      />
    );

    expect(screen.getByRole('button', { name: 'create' })).toBeDisabled();
  });

  it('calls createExpense with cents and selected ids', async () => {
    vi.mocked(createExpense).mockResolvedValueOnce(undefined);

    render(
      <TransactionForm
        mode="expense"
        accounts={baseAccounts}
        categories={baseCategories}
        open
        onOpenChange={() => { }} />
    );

    fireEvent.change(screen.getByLabelText('amount'), { target: { value: '123.45' } });
    fireEvent.change(screen.getByLabelText('description'), { target: { value: 'Coffee' } });
    fireEvent.change(screen.getByLabelText('purchaseDate'), {
      target: { value: '2026-01-10' },
    });

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(createExpense).toHaveBeenCalledWith({
        description: 'Coffee',
        totalAmount: 12345,
        categoryId: 10,
        accountId: 1,
        purchaseDate: '2026-01-10',
        installments: 1,
      });
    });
  });

  it('calls updateExpense with transaction id', async () => {
    vi.mocked(updateExpense).mockResolvedValueOnce(undefined);

    render(
      <TransactionForm
        mode="expense"
        accounts={baseAccounts}
        categories={baseCategories}
        transaction={baseTransaction}
        open
        onOpenChange={() => { }}
      />
    );

    fireEvent.change(screen.getByLabelText('amount'), {
      target: { value: '200.00' },
    });
    fireEvent.change(screen.getByLabelText('purchaseDate'), {
      target: { value: '2026-01-12' },
    });

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(updateExpense).toHaveBeenCalledWith(99, {
        description: 'Groceries',
        totalAmount: 20000,
        categoryId: 10,
        accountId: 1,
        purchaseDate: '2026-01-12',
        installments: 2,
      });
    });
  });

  it('uses income mode without installments and calls income actions', async () => {
    vi.mocked(createIncome).mockResolvedValueOnce(undefined);

    const { unmount } = render(
      <TransactionForm
        mode="income"
        accounts={baseAccounts}
        categories={baseCategories}
        open
        onOpenChange={() => { }}
      />
    );

    expect(screen.queryByText('installments')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('amount'), { target: { value: '500.00' } });
    fireEvent.change(screen.getByLabelText('description'), { target: { value: 'Bonus' } });
    fireEvent.change(screen.getByLabelText('receivedDate'), {
      target: { value: '2026-01-11' },
    });

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(createIncome).toHaveBeenCalledWith({
        description: 'Bonus',
        amount: 50000,
        categoryId: 10,
        accountId: 1,
        receivedDate: '2026-01-11',
      });
    });

    vi.mocked(updateIncome).mockResolvedValueOnce(undefined);

    unmount();

    render(
      <TransactionForm
        mode="income"
        accounts={baseAccounts}
        categories={baseCategories}
        income={baseIncome}
        open
        onOpenChange={() => { }}
      />
    );

    const updateForm = document.querySelector('form');
    expect(updateForm).not.toBeNull();
    fireEvent.submit(updateForm!);

    await waitFor(() => {
      expect(updateIncome).toHaveBeenCalledWith(55, {
        description: 'Salary',
        amount: 75000,
        categoryId: 20,
        accountId: 1,
        receivedDate: '2026-01-05',
      });
    });
  });
});
