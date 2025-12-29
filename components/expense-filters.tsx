'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { addMonths, getCurrentYearMonth } from '@/lib/utils';
import type { Account, Category } from '@/lib/schema';

type ExpenseFiltersProps = {
  accounts: Account[];
  categories: Category[];
  currentMonth: string;
};

export function ExpenseFilters({
  accounts,
  categories,
  currentMonth,
}: ExpenseFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigateMonth(direction: -1 | 1) {
    const newMonth = addMonths(currentMonth, direction);
    const params = new URLSearchParams(searchParams);
    params.set('month', newMonth);
    router.push(`/expenses?${params.toString()}`);
  }

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/expenses?${params.toString()}`);
  }

  const [year, month] = currentMonth.split('-');
  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString(
    'pt-BR',
    { month: 'long', year: 'numeric' }
  );

  return (
    <div className="mb-6 space-y-4">
      {/* Month picker */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button onClick={() => navigateMonth(-1)} variant="outline" size="icon">
            <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          </Button>
          <span className="min-w-48 text-center text-lg font-medium capitalize">
            {monthName}
          </span>
          <Button onClick={() => navigateMonth(1)} variant="outline" size="icon">
            <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
          </Button>
        </div>
      </div>

      {/* Filter selects */}
      <div className="flex flex-wrap gap-3">
        <Select
          value={searchParams.get('category') || 'all'}
          onValueChange={(value) => updateFilter('category', value)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id.toString()}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get('account') || 'all'}
          onValueChange={(value) => updateFilter('account', value)}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Accounts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Accounts</SelectItem>
            {accounts.map((acc) => (
              <SelectItem key={acc.id} value={acc.id.toString()}>
                {acc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get('status') || 'all'}
          onValueChange={(value) => updateFilter('status', value)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
