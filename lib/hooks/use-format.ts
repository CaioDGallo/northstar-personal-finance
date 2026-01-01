'use client';

import { useFormatter, useLocale } from 'next-intl';
import { parseLocalDate } from '@/lib/utils';

export function useFormat() {
  const format = useFormatter();
  const locale = useLocale();

  return {
    /**
     * Format cents as Brazilian Real
     * @example currency(10050) → "R$ 100,50" (pt-BR) or "BRL 100.50" (en)
     */
    currency: (cents: number) =>
      format.number(cents / 100, {
        style: 'currency',
        currency: 'BRL',
      }),

    /**
     * Format date for display (timezone-safe)
     * @example date("2026-01-02") → "2 de janeiro de 2026" (pt-BR) or "January 2, 2026" (en)
     */
    date: (date: Date | string, options?: Parameters<typeof format.dateTime>[1]) => {
      const dateObj = typeof date === 'string' ? parseLocalDate(date) : date;
      return format.dateTime(dateObj, options);
    },

    /**
     * Format fatura month for display
     * @example faturaMonth("2025-01") → "janeiro de 2025" (pt-BR) or "January 2025" (en)
     */
    faturaMonth: (yearMonth: string) => {
      const [year, month] = yearMonth.split('-').map(Number);
      const date = new Date(year, month - 1, 1);
      return format.dateTime(date, { month: 'long', year: 'numeric' });
    },

    /** Current locale */
    locale,
  };
}
