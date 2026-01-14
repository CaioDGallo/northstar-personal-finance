// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { BalanceSummary } from '@/components/balance-summary';
import { SummaryCard } from '@/components/summary-card';
import { BudgetProgress } from '@/components/budget-progress';
import { RecentExpenses } from '@/components/recent-expenses';
import { MonthPicker } from '@/components/month-picker';
import { CashFlowReport } from '@/components/cash-flow-report';

// Mock next-intl
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => {
    const translations: Record<string, Record<string, string>> = {
      summary: {
        balanceSummary: 'Balance Summary',
        totalIncome: 'Total Income',
        totalExpenses: 'Total Expenses',
        netBalance: 'Net Balance',
        incomeSpent: 'of income spent',
        noIncome: 'No income recorded',
        monthlySummary: 'Monthly Summary',
        totalSpent: 'Total Spent',
        totalBudget: 'Total Budget',
        overBudget: 'Over Budget',
        remaining: 'Remaining',
        unbudgeted: 'Unbudgeted',
        budgetUsed: 'of budget used',
      },
      cashFlow: {
        title: 'Cash Flow',
        income: 'Income',
        expenses: 'Expenses',
        transfersIn: 'Transfers In',
        transfersOut: 'Transfers Out',
        net: 'Net Cash Flow',
      },
      recentExpenses: {
        title: 'Recent Expenses',
        noExpenses: 'No expenses this month yet',
        viewAll: 'View all',
      },
    };
    return translations[namespace]?.[key] || key;
  },
}));

// Mock next/navigation
const mockPush = vi.fn();
const mockPrefetch = vi.fn();
const mockPathname = '/dashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: mockPrefetch,
  }),
  usePathname: () => mockPathname,
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe('Dashboard Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BalanceSummary Component', () => {
    describe('Display Tests', () => {
      it('shows total income, expenses, and net balance', () => {
        render(
          <BalanceSummary income={100000} expenses={60000} netBalance={40000} />
        );

        expect(screen.getByText('Balance Summary')).toBeInTheDocument();
        expect(screen.getByText('Total Income')).toBeInTheDocument();
        expect(screen.getByText('Total Expenses')).toBeInTheDocument();
        expect(screen.getByText('Net Balance')).toBeInTheDocument();

        // Check formatted amounts (R$ 1.000,00 format)
        expect(screen.getByText(/R\$\s*1\.000,00/)).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*600,00/)).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*400,00/)).toBeInTheDocument();
      });

      it('displays green color for positive balance', () => {
        render(
          <BalanceSummary income={100000} expenses={60000} netBalance={40000} />
        );

        // Look for the net balance value (with +)
        const netBalanceText = screen.getByText(/\+R\$\s*400,00/);
        expect(netBalanceText).toBeInTheDocument();
        expect(netBalanceText).toHaveClass('text-green-600');
      });

      it('displays red color for negative balance', () => {
        render(
          <BalanceSummary income={50000} expenses={80000} netBalance={-30000} />
        );

        // Look for the net balance value (negative with - prefix but no +)
        const netBalanceText = screen.getByText(/-R\$\s*300,00/);
        expect(netBalanceText).toBeInTheDocument();
        expect(netBalanceText).toHaveClass('text-red-600');
      });

      it('shows progress bar percentage correctly', () => {
        render(
          <BalanceSummary income={100000} expenses={60000} netBalance={40000} />
        );

        expect(screen.getByText('60.0% of income spent')).toBeInTheDocument();
      });
    });

    describe('Edge Cases', () => {
      it('handles zero income and zero expenses', () => {
        render(<BalanceSummary income={0} expenses={0} netBalance={0} />);

        // Check that all three amounts are displayed (income, expenses, net balance)
        const zeroAmounts = screen.getAllByText(/R\$\s*0,00/);
        expect(zeroAmounts.length).toBeGreaterThanOrEqual(3);
        expect(screen.getByText('No income recorded')).toBeInTheDocument();
      });

      it('handles zero income with positive expenses (division by zero)', () => {
        const { container } = render(
          <BalanceSummary income={0} expenses={50000} netBalance={-50000} />
        );

        // Should show "No income recorded" instead of percentage
        expect(screen.getByText('No income recorded')).toBeInTheDocument();

        // Progress bar should be 0%
        const progressBar = container.querySelector('.h-full.transition-all');
        expect(progressBar).toHaveStyle({ width: '0%' });
      });

      it('handles positive income with zero expenses', () => {
        const { container } = render(
          <BalanceSummary income={100000} expenses={0} netBalance={100000} />
        );

        expect(screen.getByText('0.0% of income spent')).toBeInTheDocument();

        const progressBar = container.querySelector('.h-full.transition-all');
        expect(progressBar).toHaveStyle({ width: '0%' });
      });

      it('handles income equals expenses (100% spent)', () => {
        render(
          <BalanceSummary income={100000} expenses={100000} netBalance={0} />
        );

        expect(screen.getByText('100.0% of income spent')).toBeInTheDocument();
        expect(screen.getByText(/\+R\$\s*0,00/)).toBeInTheDocument(); // Net balance is 0 (positive)
      });

      it('handles expenses greater than income (over 100%)', () => {
        const { container } = render(
          <BalanceSummary income={50000} expenses={80000} netBalance={-30000} />
        );

        expect(screen.getByText('160.0% of income spent')).toBeInTheDocument();

        // Progress bar should be capped at 100% width
        const progressBar = container.querySelector('.h-full.transition-all');
        expect(progressBar).toHaveStyle({ width: '100%' });

        // Should show red progress bar
        expect(progressBar).toHaveClass('bg-red-600');
      });

      it('handles very large amounts', () => {
        render(
          <BalanceSummary
            income={99999999}
            expenses={50000000}
            netBalance={49999999}
          />
        );

        // Check that large amounts are formatted correctly (R$ 999.999,99)
        expect(screen.getByText(/R\$\s*999\.999,99/)).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*500\.000,00/)).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*499\.999,99/)).toBeInTheDocument();
      });
    });
  });

  describe('SummaryCard Component', () => {
    describe('Display Tests', () => {
      it('shows total spent, total budget, and remaining', () => {
        render(<SummaryCard spent={60000} budget={100000} />);

        expect(screen.getByText('Monthly Summary')).toBeInTheDocument();
        expect(screen.getByText('Total Spent')).toBeInTheDocument();
        expect(screen.getByText('Total Budget')).toBeInTheDocument();
        expect(screen.getByText('Remaining')).toBeInTheDocument();

        expect(screen.getByText(/R\$\s*600,00/)).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*1\.000,00/)).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*400,00/)).toBeInTheDocument();
      });

      it('shows green progress bar when under 80%', () => {
        const { container } = render(<SummaryCard spent={70000} budget={100000} />);

        const progressBar = container.querySelector('.h-full.transition-all');
        expect(progressBar).toHaveClass('bg-green-500');
        expect(progressBar).toHaveStyle({ width: '70%' });
      });

      it('shows yellow progress bar when between 80-100%', () => {
        const { container } = render(<SummaryCard spent={85000} budget={100000} />);

        const progressBar = container.querySelector('.h-full.transition-all');
        expect(progressBar).toHaveClass('bg-yellow-500');
        expect(progressBar).toHaveStyle({ width: '85%' });
      });

      it('shows red progress bar when over 100%', () => {
        const { container } = render(<SummaryCard spent={120000} budget={100000} />);

        const progressBar = container.querySelector('.h-full.transition-all');
        expect(progressBar).toHaveClass('bg-red-500');
        expect(progressBar).toHaveStyle({ width: '100%' }); // Capped at 100%
      });

      it('shows "Over Budget" label when spending exceeds budget', () => {
        render(<SummaryCard spent={120000} budget={100000} />);

        expect(screen.getByText('Over Budget')).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*200,00/)).toBeInTheDocument(); // Absolute value
      });
    });

    describe('Edge Cases', () => {
      it('handles budget=0 with spent>0', () => {
        const { container } = render(<SummaryCard spent={50000} budget={0} />);

        expect(screen.getByText('Unbudgeted')).toBeInTheDocument();

        // With budget=0, percentage should be 0
        const progressBar = container.querySelector('.h-full.transition-all');
        expect(progressBar).toHaveStyle({ width: '0%' });
      });

      it('handles spent=0 with budget>0', () => {
        render(<SummaryCard spent={0} budget={100000} />);

        expect(screen.getByText('Remaining')).toBeInTheDocument();
        // Two instances of R$ 1.000,00 (budget and remaining)
        const amounts = screen.getAllByText(/R\$\s*1\.000,00/);
        expect(amounts.length).toBe(2);
        expect(screen.getByText('0.0% of budget used')).toBeInTheDocument();
      });

      it('handles spent=0 and budget=0', () => {
        render(<SummaryCard spent={0} budget={0} />);

        // Multiple instances of R$ 0,00 (spent, budget, remaining)
        const zeroAmounts = screen.getAllByText(/R\$\s*0,00/);
        expect(zeroAmounts.length).toBeGreaterThanOrEqual(3);
        expect(screen.getByText('0.0% of budget used')).toBeInTheDocument();
      });

      it('handles spent>budget (negative remaining)', () => {
        render(<SummaryCard spent={120000} budget={100000} />);

        expect(screen.getByText('Over Budget')).toBeInTheDocument();
        // Shows absolute value of negative remaining
        expect(screen.getByText(/R\$\s*200,00/)).toBeInTheDocument();
      });

      it('handles spent=budget (zero remaining)', () => {
        render(<SummaryCard spent={100000} budget={100000} />);

        expect(screen.getByText('Remaining')).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*0,00/)).toBeInTheDocument();
        expect(screen.getByText('100.0% of budget used')).toBeInTheDocument();
      });

      it('tests exact boundary at 80%', () => {
        const { container } = render(<SummaryCard spent={80000} budget={100000} />);

        const progressBar = container.querySelector('.h-full.transition-all');
        expect(progressBar).toHaveClass('bg-yellow-500'); // 80% is warning
      });

      it('tests exact boundary at 100%', () => {
        const { container } = render(<SummaryCard spent={100000} budget={100000} />);

        const progressBar = container.querySelector('.h-full.transition-all');
        expect(progressBar).toHaveClass('bg-yellow-500'); // 100% is still warning
      });

      it('handles very large amounts', () => {
        render(<SummaryCard spent={50000000} budget={99999999} />);

        expect(screen.getByText(/R\$\s*500\.000,00/)).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*999\.999,99/)).toBeInTheDocument();
      });
    });
  });

  describe('BudgetProgress Component', () => {
    describe('Display Tests', () => {
      it('shows category name, icon, spent, budget, and percentage', () => {
        render(
          <BudgetProgress
            categoryName="Food"
            categoryColor="#ef4444"
            categoryIcon="Restaurant01Icon"
            spent={30000}
            budget={50000}
          />
        );

        expect(screen.getByText('Food')).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*300,00\s*\/\s*R\$\s*500,00/)).toBeInTheDocument();
        expect(screen.getByText('60%')).toBeInTheDocument();
      });

      it('applies category color to icon background', () => {
        const { container } = render(
          <BudgetProgress
            categoryName="Food"
            categoryColor="#ef4444"
            categoryIcon="Restaurant01Icon"
            spent={30000}
            budget={50000}
          />
        );

        const iconContainer = container.querySelector('.rounded-full.text-white');
        expect(iconContainer).toHaveStyle({ backgroundColor: '#ef4444' });
      });

      it('shows green progress bar when under 80%', () => {
        const { container } = render(
          <BudgetProgress
            categoryName="Food"
            categoryColor="#ef4444"
            categoryIcon="Restaurant01Icon"
            spent={30000}
            budget={50000}
          />
        );

        const progressBar = container.querySelector('.h-full.transition-all');
        expect(progressBar).toHaveClass('bg-green-600');
      });

      it('shows yellow progress bar when between 80-100%', () => {
        const { container } = render(
          <BudgetProgress
            categoryName="Food"
            categoryColor="#ef4444"
            categoryIcon="Restaurant01Icon"
            spent={45000}
            budget={50000}
          />
        );

        const progressBar = container.querySelector('.h-full.transition-all');
        expect(progressBar).toHaveClass('bg-yellow-600');
      });

      it('shows red progress bar when over 100%', () => {
        const { container } = render(
          <BudgetProgress
            categoryName="Food"
            categoryColor="#ef4444"
            categoryIcon="Restaurant01Icon"
            spent={60000}
            budget={50000}
          />
        );

        const progressBar = container.querySelector('.h-full.transition-all');
        expect(progressBar).toHaveClass('bg-red-600');
      });
    });

    describe('Edge Cases', () => {
      it('handles budget=0 with spent>0 (infinite percentage)', () => {
        const { container } = render(
          <BudgetProgress
            categoryName="Food"
            categoryColor="#ef4444"
            categoryIcon="Restaurant01Icon"
            spent={50000}
            budget={0}
          />
        );

        // With budget=0, percentage should be 0
        expect(screen.getByText('0%')).toBeInTheDocument();

        const progressBar = container.querySelector('.h-full.transition-all');
        expect(progressBar).toHaveStyle({ width: '0%' });
      });

      it('handles spent=0 with budget>0', () => {
        render(
          <BudgetProgress
            categoryName="Food"
            categoryColor="#ef4444"
            categoryIcon="Restaurant01Icon"
            spent={0}
            budget={50000}
          />
        );

        expect(screen.getByText('0%')).toBeInTheDocument();
      });

      it('handles spent=budget (100%)', () => {
        render(
          <BudgetProgress
            categoryName="Food"
            categoryColor="#ef4444"
            categoryIcon="Restaurant01Icon"
            spent={50000}
            budget={50000}
          />
        );

        expect(screen.getByText('100%')).toBeInTheDocument();
      });

      it('handles spent>budget (over 100%)', () => {
        const { container } = render(
          <BudgetProgress
            categoryName="Food"
            categoryColor="#ef4444"
            categoryIcon="Restaurant01Icon"
            spent={75000}
            budget={50000}
          />
        );

        expect(screen.getByText('150%')).toBeInTheDocument();

        // Progress bar should be capped at 100%
        const progressBar = container.querySelector('.h-full.transition-all');
        expect(progressBar).toHaveStyle({ width: '100%' });
      });

      it('handles null icon gracefully', () => {
        render(
          <BudgetProgress
            categoryName="Food"
            categoryColor="#ef4444"
            categoryIcon={null}
            spent={30000}
            budget={50000}
          />
        );

        expect(screen.getByText('Food')).toBeInTheDocument();
      });

      it('rounds percentage correctly (49.5%)', () => {
        render(
          <BudgetProgress
            categoryName="Food"
            categoryColor="#ef4444"
            categoryIcon="Restaurant01Icon"
            spent={24750}
            budget={50000}
          />
        );

        // 49.5% should round to 50%
        expect(screen.getByText('50%')).toBeInTheDocument();
      });

      it('rounds percentage correctly (49.4%)', () => {
        render(
          <BudgetProgress
            categoryName="Food"
            categoryColor="#ef4444"
            categoryIcon="Restaurant01Icon"
            spent={24700}
            budget={50000}
          />
        );

        // 49.4% should round to 49%
        expect(screen.getByText('49%')).toBeInTheDocument();
      });
    });
  });

  describe('RecentExpenses Component', () => {
    const mockExpenses = [
      {
        entryId: 1,
        description: 'Restaurant Lunch',
        amount: 5000,
        dueDate: '2025-01-15',
        categoryName: 'Food',
        categoryColor: '#ef4444',
        categoryIcon: 'Restaurant01Icon',
        accountName: 'Credit Card',
      },
      {
        entryId: 2,
        description: 'Grocery Store',
        amount: 15000,
        dueDate: '2025-01-14',
        categoryName: 'Food',
        categoryColor: '#ef4444',
        categoryIcon: 'ShoppingBasket01Icon',
        accountName: 'Debit Card',
      },
    ];

    describe('Display Tests', () => {
      it('shows list of expenses with all details', () => {
        render(<RecentExpenses expenses={mockExpenses} />);

        expect(screen.getByText('Recent Expenses')).toBeInTheDocument();
        expect(screen.getByText('Restaurant Lunch')).toBeInTheDocument();
        expect(screen.getByText('Grocery Store')).toBeInTheDocument();
        expect(screen.getByText('Food • Credit Card')).toBeInTheDocument();
        expect(screen.getByText('Food • Debit Card')).toBeInTheDocument();
      });

      it('shows link to full expenses page', () => {
        const { container } = render(<RecentExpenses expenses={mockExpenses} />);

        const link = container.querySelector('a[href="/expenses"]');
        expect(link).toBeInTheDocument();
        expect(link?.textContent).toBe('View all');
      });

      it('shows empty state when no expenses exist', () => {
        render(<RecentExpenses expenses={[]} />);

        expect(screen.getByText('Recent Expenses')).toBeInTheDocument();
        expect(screen.getByText('No expenses this month yet')).toBeInTheDocument();
      });
    });

    describe('Edge Cases', () => {
      it('handles single expense', () => {
        render(<RecentExpenses expenses={[mockExpenses[0]]} />);

        expect(screen.getByText('Restaurant Lunch')).toBeInTheDocument();
        expect(screen.queryByText('Grocery Store')).not.toBeInTheDocument();
      });

      it('handles exactly 5 expenses', () => {
        const fiveExpenses = Array.from({ length: 5 }, (_, i) => ({
          ...mockExpenses[0],
          entryId: i + 1,
          description: `Expense ${i + 1}`,
        }));

        render(<RecentExpenses expenses={fiveExpenses} />);

        expect(screen.getByText('Expense 1')).toBeInTheDocument();
        expect(screen.getByText('Expense 5')).toBeInTheDocument();
      });

      it('handles expense with null icon', () => {
        const expenseWithNullIcon = [
          {
            ...mockExpenses[0],
            categoryIcon: null,
          },
        ];

        render(<RecentExpenses expenses={expenseWithNullIcon} />);

        expect(screen.getByText('Restaurant Lunch')).toBeInTheDocument();
      });

      it('handles very large amounts', () => {
        const largeExpense = [
          {
            ...mockExpenses[0],
            amount: 99999999,
          },
        ];

        render(<RecentExpenses expenses={largeExpense} />);

        expect(screen.getByText(/R\$\s*999\.999,99/)).toBeInTheDocument();
      });
    });
  });

  describe('MonthPicker Component', () => {
    describe('Display Tests', () => {
      it('displays current month name in Portuguese', () => {
        render(<MonthPicker currentMonth="2025-01" />);

        expect(screen.getByText(/janeiro/i)).toBeInTheDocument();
        expect(screen.getByText(/2025/)).toBeInTheDocument();
      });

      it('shows previous and next navigation buttons', () => {
        const { container } = render(<MonthPicker currentMonth="2025-01" />);

        const buttons = container.querySelectorAll('button');
        expect(buttons).toHaveLength(2); // Previous and Next buttons
      });

      it('prefetches adjacent months on mount', () => {
        render(<MonthPicker currentMonth="2025-01" />);

        expect(mockPrefetch).toHaveBeenCalledWith('/dashboard?month=2024-12');
        expect(mockPrefetch).toHaveBeenCalledWith('/dashboard?month=2025-02');
      });
    });

    describe('Navigation', () => {
      it('navigates to previous month when clicking previous button', async () => {
        const { container } = render(<MonthPicker currentMonth="2025-01" />);

        const buttons = container.querySelectorAll('button');
        const prevButton = buttons[0];

        prevButton.click();

        expect(mockPush).toHaveBeenCalledWith('/dashboard?month=2024-12');
      });

      it('navigates to next month when clicking next button', async () => {
        const { container } = render(<MonthPicker currentMonth="2025-01" />);

        const buttons = container.querySelectorAll('button');
        const nextButton = buttons[1];

        nextButton.click();

        expect(mockPush).toHaveBeenCalledWith('/dashboard?month=2025-02');
      });
    });

    describe('Date Arithmetic Edge Cases', () => {
      it('handles January to December transition (year boundary)', () => {
        const { container } = render(<MonthPicker currentMonth="2025-01" />);

        const buttons = container.querySelectorAll('button');
        buttons[0].click(); // Previous

        expect(mockPush).toHaveBeenCalledWith('/dashboard?month=2024-12');
      });

      it('handles December to January transition (year boundary)', () => {
        const { container } = render(<MonthPicker currentMonth="2024-12" />);

        const buttons = container.querySelectorAll('button');
        buttons[1].click(); // Next

        expect(mockPush).toHaveBeenCalledWith('/dashboard?month=2025-01');
      });

      it('handles February correctly', () => {
        render(<MonthPicker currentMonth="2025-02" />);

        expect(screen.getByText(/fevereiro/i)).toBeInTheDocument();
      });
    });

    describe('Internationalization', () => {
      it('displays month names in Portuguese', () => {
        const months = [
          { month: '2025-01', name: 'janeiro' },
          { month: '2025-02', name: 'fevereiro' },
          { month: '2025-03', name: 'março' },
          { month: '2025-04', name: 'abril' },
          { month: '2025-05', name: 'maio' },
          { month: '2025-06', name: 'junho' },
          { month: '2025-07', name: 'julho' },
          { month: '2025-08', name: 'agosto' },
          { month: '2025-09', name: 'setembro' },
          { month: '2025-10', name: 'outubro' },
          { month: '2025-11', name: 'novembro' },
          { month: '2025-12', name: 'dezembro' },
        ];

        months.forEach(({ month, name }) => {
          const { unmount } = render(<MonthPicker currentMonth={month} />);
          expect(screen.getByText(new RegExp(name, 'i'))).toBeInTheDocument();
          unmount();
        });
      });
    });
  });

  describe('CashFlowReport Component', () => {
    describe('Display Tests', () => {
      it('shows income, expenses, transfers, and net cash flow', () => {
        render(
          <CashFlowReport
            income={100000}
            expenses={60000}
            transfersIn={5000}
            transfersOut={10000}
            net={35000}
          />
        );

        expect(screen.getByText('Cash Flow')).toBeInTheDocument();
        expect(screen.getByText('Income')).toBeInTheDocument();
        expect(screen.getByText('Expenses')).toBeInTheDocument();
        expect(screen.getByText('Transfers In')).toBeInTheDocument();
        expect(screen.getByText('Transfers Out')).toBeInTheDocument();
        expect(screen.getByText('Net Cash Flow')).toBeInTheDocument();

        // Check formatted amounts
        expect(screen.getByText(/R\$\s*1\.000,00/)).toBeInTheDocument(); // Income
        expect(screen.getByText(/R\$\s*600,00/)).toBeInTheDocument(); // Expenses
        expect(screen.getByText(/R\$\s*50,00/)).toBeInTheDocument(); // TransfersIn
        expect(screen.getByText(/R\$\s*100,00/)).toBeInTheDocument(); // TransfersOut
        expect(screen.getByText(/R\$\s*350,00/)).toBeInTheDocument(); // Net
      });

      it('displays positive net cash flow in green', () => {
        render(
          <CashFlowReport
            income={100000}
            expenses={60000}
            transfersIn={0}
            transfersOut={0}
            net={40000}
          />
        );

        const netText = screen.getByText(/\+R\$\s*400,00/);
        expect(netText).toHaveClass('text-green-600');
      });

      it('displays negative net cash flow in red', () => {
        render(
          <CashFlowReport
            income={50000}
            expenses={80000}
            transfersIn={0}
            transfersOut={0}
            net={-30000}
          />
        );

        const netText = screen.getByText(/-R\$\s*300,00/);
        expect(netText).toHaveClass('text-red-600');
      });

      it('displays zero net cash flow as positive (green)', () => {
        render(
          <CashFlowReport
            income={50000}
            expenses={50000}
            transfersIn={0}
            transfersOut={0}
            net={0}
          />
        );

        // Zero is considered positive (netPositive = net >= 0)
        // Find the Net Cash Flow row specifically to avoid matching Transfers In
        const netLabel = screen.getByText('Net Cash Flow');
        const netRow = netLabel.closest('.flex');
        const netText = within(netRow as HTMLElement).getByText(/\+R\$\s*0,00/i);
        expect(netText).toHaveClass('text-green-600');
      });
    });

    describe('Edge Cases', () => {
      it('handles all zero values', () => {
        render(
          <CashFlowReport
            income={0}
            expenses={0}
            transfersIn={0}
            transfersOut={0}
            net={0}
          />
        );

        // All amounts should be R$ 0,00
        const zeroAmounts = screen.getAllByText(/R\$\s*0,00/);
        expect(zeroAmounts.length).toBeGreaterThanOrEqual(5);
      });

      it('handles large amounts correctly', () => {
        render(
          <CashFlowReport
            income={99999999}
            expenses={50000000}
            transfersIn={10000000}
            transfersOut={5000000}
            net={54999999}
          />
        );

        expect(screen.getByText(/R\$\s*999\.999,99/)).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*500\.000,00/)).toBeInTheDocument();
        expect(screen.getByText(/R\$\s*549\.999,99/)).toBeInTheDocument();
      });

      it('handles negative values with correct sign display', () => {
        render(
          <CashFlowReport
            income={0}
            expenses={100000}
            transfersIn={0}
            transfersOut={50000}
            net={-150000}
          />
        );

        // Negative net should show with - prefix
        const netText = screen.getByText(/-R\$\s*1\.500,00/);
        expect(netText).toBeInTheDocument();
        expect(netText).toHaveClass('text-red-600');
      });

      it('handles transfers only (no income/expenses)', () => {
        render(
          <CashFlowReport
            income={0}
            expenses={0}
            transfersIn={50000}
            transfersOut={30000}
            net={20000}
          />
        );

        expect(screen.getByText(/\+R\$\s*500,00/)).toBeInTheDocument(); // TransfersIn
        expect(screen.getByText(/-R\$\s*300,00/)).toBeInTheDocument(); // TransfersOut
        expect(screen.getByText(/\+R\$\s*200,00/)).toBeInTheDocument(); // Net
      });
    });
  });
});
