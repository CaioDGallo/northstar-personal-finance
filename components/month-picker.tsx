'use client';

import { addMonths } from '@/lib/utils';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';

type MonthPickerProps = {
  currentMonth: string;
};

export function MonthPicker({ currentMonth }: MonthPickerProps) {
  const router = useRouter();
  const pathname = usePathname();

  function navigate(direction: -1 | 1) {
    const newMonth = addMonths(currentMonth, direction);
    router.push(`${pathname}?month=${newMonth}`);
  }

  const [year, month] = currentMonth.split('-');
  const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString(
    'pt-BR',
    { month: 'long', year: 'numeric' }
  );

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={() => navigate(-1)}
        variant="outline"
        size="icon"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
      </Button>
      <span className="min-w-48 text-center text-lg font-medium capitalize">{monthName}</span>
      <Button
        onClick={() => navigate(1)}
        variant="outline"
        size="icon"
      >
        <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2} />
      </Button>
    </div>
  );
}
