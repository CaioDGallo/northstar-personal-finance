'use client';

import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { addMonths } from '@/lib/utils';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

interface MonthPickerProps {
  currentMonth: string;
}

export function MonthPicker({ currentMonth }: MonthPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const tCommon = useTranslations('common');

  const [year, month] = currentMonth.split('-');
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
    new Date(parseInt(year), parseInt(month) - 1)
  );

  const navigate = (direction: -1 | 1) => {
    const newMonth = addMonths(currentMonth, direction);
    router.push(`${pathname}?month=${newMonth}`);
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        onClick={() => navigate(-1)}
        variant="hollow"
        size="icon"
        aria-label={tCommon('previousMonth')}
      >
        <HugeiconsIcon
          icon={ArrowLeft01Icon}
          strokeWidth={2}
          aria-hidden="true"
        />
      </Button>
      <span className="min-w-48 text-center text-lg font-medium capitalize">
        {monthName}
      </span>
      <Button
        onClick={() => navigate(1)}
        variant="hollow"
        size="icon"
        aria-label={tCommon('nextMonth')}
      >
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          strokeWidth={2}
          aria-hidden="true"
        />
      </Button>
    </div>
  );
}
