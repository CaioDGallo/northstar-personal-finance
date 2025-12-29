'use client';

import { useState } from 'react';
import { upsertBudget } from '@/lib/actions/budgets';
import { displayToCents, centsToDisplay } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { CategoryIcon } from '@/components/icon-picker';

type BudgetRow = {
  categoryId: number;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string | null;
  budgetAmount: number | null;
};

type BudgetFormProps = {
  yearMonth: string;
  budgets: BudgetRow[];
};

export function BudgetForm({ yearMonth, budgets }: BudgetFormProps) {
  const [values, setValues] = useState<Record<number, string>>(
    Object.fromEntries(
      budgets.map((b) => [
        b.categoryId,
        b.budgetAmount ? centsToDisplay(b.budgetAmount) : '',
      ])
    )
  );
  const [errors, setErrors] = useState<Record<number, string>>({});

  async function handleBlur(categoryId: number, value: string) {
    if (value && !isNaN(parseFloat(value))) {
      try {
        const cents = displayToCents(value);
        await upsertBudget(categoryId, yearMonth, cents);
        setErrors((prev) => {
          const next = { ...prev };
          delete next[categoryId];
          return next;
        });
      } catch (error) {
        setErrors((prev) => ({ ...prev, [categoryId]: 'Failed to save' }));
        console.error('Budget save error:', error);
      }
    }
  }

  function handleChange(categoryId: number, value: string) {
    setValues((prev) => ({ ...prev, [categoryId]: value }));
    if (errors[categoryId]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[categoryId];
        return next;
      });
    }
  }

  return (
    <div className="space-y-3">
      {budgets.map((budget) => (
        <Card
          key={budget.categoryId}
          className="flex items-center justify-between p-4"
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: budget.categoryColor }}
            >
              <CategoryIcon icon={budget.categoryIcon} />
            </div>
            <span className="font-medium">{budget.categoryName}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-neutral-500">R$</span>
              <Input
                type="number"
                step="0.01"
                value={values[budget.categoryId] || ''}
                onChange={(e) => handleChange(budget.categoryId, e.target.value)}
                onBlur={(e) => handleBlur(budget.categoryId, e.target.value)}
                placeholder="0.00"
                className="w-32 text-right"
              />
            </div>
            {errors[budget.categoryId] && (
              <span className="text-xs text-red-600">{errors[budget.categoryId]}</span>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
