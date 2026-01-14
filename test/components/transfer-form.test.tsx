import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import type { Account } from '@/lib/schema';
import { TransferForm } from '@/components/transfer-form';
import { createTransfer, updateTransfer } from '@/lib/actions/transfers';

vi.mock('@/components/ui/select', async () => {
  const React = await import('react');

  const SelectTrigger = () => null;
  const SelectValue = () => null;
  const SelectContent = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
  const SelectGroup = ({ children }: { children?: React.ReactNode }) => <>{children}</>;

  const SelectItem = ({ value, children }: { value: string; children?: React.ReactNode }) => (
    <option value={value}>{children}</option>
  );

  const findTriggerId = (nodes: React.ReactNode): string | undefined => {
    let found: string | undefined;
    React.Children.forEach(nodes, (child) => {
      if (!React.isValidElement(child) || found) {
        return;
      }
      if (child.type === SelectTrigger && typeof child.props.id === 'string') {
        found = child.props.id;
        return;
      }
      if (child.props?.children) {
        found = findTriggerId(child.props.children);
      }
    });
    return found;
  };

  const Select = ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (value: string) => void;
    children?: React.ReactNode;
  }) => {
    const triggerId = findTriggerId(children);
    return (
      <select
        id={triggerId}
        value={value}
        onChange={(event) => onValueChange?.(event.target.value)}
      >
        {children}
      </select>
    );
  };

  return {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
  };
});

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
  });

  it('toggles from/to account fields based on transfer type', async () => {
    render(
      <TransferForm
        accounts={accounts}
        open
        onOpenChange={() => { }}
      />
    );

    expect(screen.getByLabelText('fromAccount')).toBeInTheDocument();
    expect(screen.getByLabelText('toAccount')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('type'), { target: { value: 'deposit' } });

    expect(screen.queryByLabelText('fromAccount')).not.toBeInTheDocument();
    expect(screen.getByLabelText('toAccount')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('type'), { target: { value: 'withdrawal' } });

    expect(screen.getByLabelText('fromAccount')).toBeInTheDocument();
    expect(screen.queryByLabelText('toAccount')).not.toBeInTheDocument();
  });

  it('shows error and prevents submission when using the same account', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    render(
      <TransferForm
        accounts={accounts}
        open
        onOpenChange={() => { }} />
    );

    await user.type(screen.getByLabelText('amount'), '50.00');

    fireEvent.change(screen.getByLabelText('toAccount'), { target: { value: '1' } });

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(await screen.findByText('invalidAccountId')).toBeInTheDocument();
    expect(createTransfer).not.toHaveBeenCalled();
  });

  it('keeps submit disabled when amount is zero or less', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });

    render(
      <TransferForm
        accounts={accounts}
        open
        onOpenChange={() => { }}
      />
    );

    await user.type(screen.getByLabelText('amount'), '0');

    expect(screen.getByRole('button', { name: 'create' })).toBeDisabled();
  });

  it('calls createTransfer and resets form on success', async () => {
    const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
    vi.mocked(createTransfer).mockResolvedValueOnce(undefined);
    const today = new Date().toISOString().split('T')[0];

    render(
      <TransferForm
        accounts={accounts}
        open
        onOpenChange={() => { }}
      />
    );

    await user.type(screen.getByLabelText('amount'), '75.00');
    await user.type(screen.getByLabelText('description'), 'Top up');
    fireEvent.change(screen.getByLabelText('date'), {
      target: { value: '2026-01-05' },
    });

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

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

    expect(screen.getByLabelText('amount')).toHaveValue(null);
    expect(screen.getByLabelText('description')).toHaveValue('');
    expect(screen.getByLabelText('date')).toHaveValue(today);
  });

  it('calls updateTransfer for edit mode', async () => {
    userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
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
        onOpenChange={() => { }}
      />
    );

    fireEvent.change(screen.getByLabelText('amount'), { target: { value: '100.00' } });

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

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
