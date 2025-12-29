import { formatCurrency } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CategoryIcon } from '@/components/icon-picker';
import Link from 'next/link';

type RecentExpensesProps = {
  expenses: {
    entryId: number;
    description: string;
    amount: number;
    dueDate: string;
    categoryName: string;
    categoryColor: string;
    categoryIcon: string | null;
    accountName: string;
  }[];
};

export function RecentExpenses({ expenses }: RecentExpensesProps) {
  if (expenses.length === 0) {
    return (
      <Card data-slot="recent-expenses">
        <CardHeader>
          <CardTitle>Recent Expenses</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-gray-500">No expenses this month yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-slot="recent-expenses">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Recent Expenses</CardTitle>
          <Link href="/expenses" className="text-xs text-blue-600 hover:underline">
            View all
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {expenses.map((expense) => (
          <div
            key={expense.entryId}
            className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0"
          >
            <div className="flex items-center gap-3">
              <div
                className="flex size-10 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: expense.categoryColor }}
              >
                <CategoryIcon icon={expense.categoryIcon} />
              </div>
              <div>
                <div className="font-medium">{expense.description}</div>
                <div className="text-xs text-gray-500">
                  {expense.categoryName} • {expense.accountName}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{formatCurrency(expense.amount)}</div>
              <div className="text-xs text-gray-500">
                {new Date(expense.dueDate).toLocaleDateString('pt-BR', {
                  month: 'short',
                  day: 'numeric',
                })}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
