import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Account } from '@/lib/schema';
import { TransferForm } from '@/components/transfer-form';
import { freezeTime, resetTime } from '@/test/time-utils';
import { createTransfer, updateTransfer } from '@/lib/actions/transfers';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/lib/actions/transfers', () => ({
  createTransfer: vi.fn(),
  updateTransfer: vi.fn(),
}));

const accounts: Account[] = [
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

describe('TransferForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    freezeTime('2026-01-12T12:00:00Z');
  });

  afterEach(() => {
    resetTime();
  });

  it('toggles from/to account fields based on transfer type', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <TransferForm
        accounts={accounts}
        open
        onOpenChange={() => {}}
      />
    );

    expect(screen.getByLabelText('fromAccount')).toBeInTheDocument();
    expect(screen.getByLabelText('toAccount')).toBeInTheDocument();

    await user.click(screen.getByLabelText('type'));
    await user.click(screen.getByText('types.deposit'));

    expect(screen.queryByLabelText('fromAccount')).not.toBeInTheDocument();
    expect(screen.getByLabelText('toAccount')).toBeInTheDocument();

    await user.click(screen.getByLabelText('type'));
    await user.click(screen.getByText('types.withdrawal'));

    expect(screen.getByLabelText('fromAccount')).toBeInTheDocument();
    expect(screen.queryByLabelText('toAccount')).not.toBeInTheDocument();
  });

  it('shows error and prevents submission when using the same account', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { container } = render(
      <TransferForm
        accounts={accounts}
        open
        onOpenChange={() => {}}
      />
    );

    await user.type(screen.getByLabelText('amount'), '50.00');

    await user.click(screen.getByLabelText('toAccount'));
    await user.click(screen.getByText('Checking'));

    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByText('invalidAccountId')).toBeInTheDocument();
    expect(createTransfer).not.toHaveBeenCalled();
  });

  it('keeps submit disabled when amount is zero or less', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <TransferForm
        accounts={accounts}
        open
        onOpenChange={() => {}}
      />
    );

    await user.type(screen.getByLabelText('amount'), '0');

    expect(screen.getByRole('button', { name: 'create' })).toBeDisabled();
  });

  it('calls createTransfer and resets form on success', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(createTransfer).mockResolvedValueOnce(undefined);

    render(
      <TransferForm
        accounts={accounts}
        open
        onOpenChange={() => {}}
      />
    );

    await user.type(screen.getByLabelText('amount'), '75.00');
    await user.type(screen.getByLabelText('description'), 'Top up');
    fireEvent.change(screen.getByLabelText('date'), {
      target: { value: '2026-01-05' },
    });

    await user.click(screen.getByRole('button', { name: 'create' }));

    await waitFor(() => {
      expect(createTransfer).toHaveBeenCalledWith({
        type: 'internal_transfer',
        amount: 7500,
        date: '2026-01-05',
        description: 'Top up',
        fromAccountId: 1,
        toAccountId: 2,
      });
    });

    expect(screen.getByLabelText('amount')).toHaveValue('');
    expect(screen.getByLabelText('description')).toHaveValue('');
    expect(screen.getByLabelText('date')).toHaveValue('2026-01-12');
  });

  it('calls updateTransfer for edit mode', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(updateTransfer).mockResolvedValueOnce(undefined);

    render(
      <TransferForm
        accounts={accounts}
        transfer={{
          id: 44,
          amount: 12345,
          date: '2026-01-03',
          type: 'deposit',
          description: 'Initial',
          fromAccountId: null,
          toAccountId: 1,
        }}
        open
        onOpenChange={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText('amount'), { target: { value: '100.00' } });

    await user.click(screen.getByRole('button', { name: 'update' }));

    await waitFor(() => {
      expect(updateTransfer).toHaveBeenCalledWith(44, {
        type: 'deposit',
        amount: 10000,
        date: '2026-01-03',
        description: 'Initial',
        fromAccountId: null,
        toAccountId: 1,
      });
    });
  });
});
