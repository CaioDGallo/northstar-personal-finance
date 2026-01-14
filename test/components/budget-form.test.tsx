// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BudgetForm } from '@/components/budget-form';
import { upsertBudget, upsertMonthlyBudget } from '@/lib/actions/budgets';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string, values?: Record<string, string>) => {
    const translations: Record<string, Record<string, (values?: Record<string, string>) => string>> = {
      budgets: {
        totalMonthlyBudget: () => 'Total Monthly Budget',
        leftFromBudget: (vals) => `Left ${vals?.remaining} of ${vals?.total}`,
        overBudget: (vals) => `Over ${vals?.over} of ${vals?.total}`,
        percentAllocated: (vals) => `${vals?.percent}% allocated`,
      },
      errors: {
        failedToSave: () => 'Failed to save',
      },
    };

    return translations[namespace]?.[key]?.(values) ?? key;
  },
}));

vi.mock('@/lib/actions/budgets', () => ({
  upsertBudget: vi.fn(),
  upsertMonthlyBudget: vi.fn(),
}));

const baseBudgets = [
  {
    categoryId: 1,
    categoryName: 'Food',
    categoryColor: '#ef4444',
    categoryIcon: 'Restaurant01Icon',
    budgetAmount: null,
  },
  {
    categoryId: 2,
    categoryName: 'Bills',
    categoryColor: '#3b82f6',
    categoryIcon: 'Invoice01Icon',
    budgetAmount: null,
  },
];

describe('BudgetForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles monthly budget blur with error and success states', async () => {
    const user = userEvent.setup();
    vi.mocked(upsertMonthlyBudget)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);

    render(
      <BudgetForm
        yearMonth="2026-01"
        budgets={baseBudgets}
        monthlyBudget={null}
      />
    );

    const [totalInput] = screen.getAllByPlaceholderText('0.00');

    await user.type(totalInput, '100.00');
    fireEvent.blur(totalInput);

    expect(await screen.findByText('Failed to save')).toBeInTheDocument();

    await user.clear(totalInput);
    await user.type(totalInput, '200.00');
    fireEvent.blur(totalInput);

    await waitFor(() => {
      expect(upsertMonthlyBudget).toHaveBeenCalledWith('2026-01', 20000);
      expect(screen.queryByText('Failed to save')).not.toBeInTheDocument();
    });
  });

  it('handles category budget blur with error and success states', async () => {
    const user = userEvent.setup();
    vi.mocked(upsertBudget)
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce(undefined);

    render(
      <BudgetForm
        yearMonth="2026-01"
        budgets={baseBudgets}
        monthlyBudget={null}
      />
    );

    const foodRow = screen.getByText('Food').closest('[data-slot="card"]');
    expect(foodRow).not.toBeNull();

    const foodInput = within(foodRow!).getByPlaceholderText('0.00');

    await user.type(foodInput, '50.00');
    fireEvent.blur(foodInput);

    expect(await screen.findByText('Failed to save')).toBeInTheDocument();

    await user.clear(foodInput);
    await user.type(foodInput, '75.00');
    fireEvent.blur(foodInput);

    await waitFor(() => {
      expect(upsertBudget).toHaveBeenCalledWith(1, '2026-01', 7500);
      expect(screen.queryByText('Failed to save')).not.toBeInTheDocument();
    });
  });

  it('reflects remaining or over-budget allocations in text and progress bar', () => {
    const { container } = render(
      <BudgetForm
        yearMonth="2026-01"
        budgets={[
          { ...baseBudgets[0], budgetAmount: 6000 },
          { ...baseBudgets[1], budgetAmount: 5000 },
        ]}
        monthlyBudget={10000}
      />
    );

    expect(screen.getByText('Over 10.00 of 100.00')).toBeInTheDocument();
    expect(screen.getByText('110.0% allocated')).toBeInTheDocument();

    const progressBar = container.querySelector('.h-full.transition-all');
    expect(progressBar).toHaveStyle({ width: '100%' });
  });
});
