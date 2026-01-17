import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getFaturaMonth,
  getFaturaPaymentDueDate,
  formatFaturaMonthWithLocale,
  getCurrentFaturaMonth,
  computeFaturaWindowStart,
} from '@/lib/fatura-utils';

describe('Fatura Utilities', () => {
  describe('getFaturaMonth', () => {
    describe('closing day logic', () => {
      it('assigns purchase on closing day to current month', () => {
        const purchaseDate = new Date('2025-01-15T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 15)).toBe('2025-01');
      });

      it('assigns purchase before closing day to current month', () => {
        const purchaseDate = new Date('2025-01-10T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 15)).toBe('2025-01');
      });

      it('assigns purchase after closing day to next month', () => {
        const purchaseDate = new Date('2025-01-20T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 15)).toBe('2025-02');
      });
    });

    describe('edge cases with extreme closing days', () => {
      it('closingDay=1: purchase on day 1 goes to current month', () => {
        const purchaseDate = new Date('2025-01-01T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 1)).toBe('2025-01');
      });

      it('closingDay=1: all other purchases go to next month', () => {
        const purchaseDate = new Date('2025-01-02T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 1)).toBe('2025-02');
      });

      it('closingDay=28: purchases up to day 28 go to current month', () => {
        const purchaseDate = new Date('2025-01-28T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 28)).toBe('2025-01');
      });

      it('closingDay=28: purchases after day 28 go to next month', () => {
        const purchaseDate = new Date('2025-01-31T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 28)).toBe('2025-02');
      });

      it('closingDay=15: mid-month split before closing day', () => {
        const purchaseDate = new Date('2025-01-14T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 15)).toBe('2025-01');
      });

      it('closingDay=15: mid-month split on closing day', () => {
        const purchaseDate = new Date('2025-01-15T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 15)).toBe('2025-01');
      });

      it('closingDay=15: mid-month split after closing day', () => {
        const purchaseDate = new Date('2025-01-16T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 15)).toBe('2025-02');
      });
    });

    describe('month boundary handling', () => {
      it('Jan 31 with closingDay=15 → Feb fatura', () => {
        const purchaseDate = new Date('2025-01-31T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 15)).toBe('2025-02');
      });

      it('Jan 15 with closingDay=15 → Jan fatura', () => {
        const purchaseDate = new Date('2025-01-15T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 15)).toBe('2025-01');
      });

      it('Jan 14 with closingDay=15 → Jan fatura', () => {
        const purchaseDate = new Date('2025-01-14T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 15)).toBe('2025-01');
      });

      it('Dec 31 with closingDay=15 → Jan next year fatura', () => {
        const purchaseDate = new Date('2025-12-31T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 15)).toBe('2026-01');
      });

      it('Dec 15 with closingDay=15 → Dec fatura', () => {
        const purchaseDate = new Date('2025-12-15T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 15)).toBe('2025-12');
      });

      it('Feb 28 (non-leap) with closingDay=15 → Mar fatura', () => {
        const purchaseDate = new Date('2025-02-28T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 15)).toBe('2025-03');
      });

      it('Feb 28 (non-leap) with closingDay=28 → Feb fatura', () => {
        const purchaseDate = new Date('2025-02-28T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 28)).toBe('2025-02');
      });
    });

    describe('leap year handling', () => {
      it('Feb 29 (leap year) with closingDay=15 → Mar fatura', () => {
        const purchaseDate = new Date('2024-02-29T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 15)).toBe('2024-03');
      });

      it('Feb 29 (leap year) with closingDay=28 → Mar fatura', () => {
        const purchaseDate = new Date('2024-02-29T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 28)).toBe('2024-03');
      });

      it('Feb 28 (leap year) with closingDay=28 → Feb fatura', () => {
        const purchaseDate = new Date('2024-02-28T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 28)).toBe('2024-02');
      });
    });

    describe('first and last day of month', () => {
      it('purchase on day 1 with closingDay=15 → current month', () => {
        const purchaseDate = new Date('2025-01-01T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 15)).toBe('2025-01');
      });

      it('purchase on day 31 with closingDay=31 → current month', () => {
        const purchaseDate = new Date('2025-01-31T00:00:00Z');
        expect(getFaturaMonth(purchaseDate, 31)).toBe('2025-01');
      });

      it('purchase on last day of month after closing → next month', () => {
        const purchaseDate = new Date('2025-04-30T00:00:00Z'); // April has 30 days
        expect(getFaturaMonth(purchaseDate, 15)).toBe('2025-05');
      });
    });

    describe('timezone consistency (UTC)', () => {
      it('handles UTC dates consistently', () => {
        const utcDate = new Date('2025-01-15T00:00:00Z');
        expect(getFaturaMonth(utcDate, 15)).toBe('2025-01');
      });

      it('uses UTC methods to avoid timezone issues', () => {
        // Even if local time zone would shift the day, UTC should be consistent
        const utcDate = new Date('2025-01-15T23:59:59Z');
        expect(getFaturaMonth(utcDate, 15)).toBe('2025-01');
      });
    });
  });

  describe('getFaturaPaymentDueDate', () => {
    describe('payment due date logic', () => {
      it('paymentDueDay <= closingDay → due NEXT month', () => {
        const dueDate = getFaturaPaymentDueDate('2025-01', 5, 15);
        expect(dueDate).toBe('2025-02-05');
      });

      it('paymentDueDay > closingDay → due SAME month', () => {
        const dueDate = getFaturaPaymentDueDate('2025-01', 12, 5);
        expect(dueDate).toBe('2025-01-12');
      });

      it('paymentDueDay === closingDay → due NEXT month (equal case)', () => {
        const dueDate = getFaturaPaymentDueDate('2025-01', 15, 15);
        expect(dueDate).toBe('2025-02-15');
      });
    });

    describe('edge cases with payment due day', () => {
      it('paymentDueDay=1, closingDay=15 → due next month', () => {
        const dueDate = getFaturaPaymentDueDate('2025-01', 1, 15);
        expect(dueDate).toBe('2025-02-01');
      });

      it('paymentDueDay=28, closingDay=5 → due same month', () => {
        const dueDate = getFaturaPaymentDueDate('2025-01', 28, 5);
        expect(dueDate).toBe('2025-01-28');
      });

      it('both paymentDueDay and closingDay at extremes (1 and 28)', () => {
        const dueDate = getFaturaPaymentDueDate('2025-01', 1, 28);
        expect(dueDate).toBe('2025-02-01');
      });
    });

    describe('month boundary handling', () => {
      it('Dec fatura with paymentDueDay <= closingDay → Jan next year', () => {
        const dueDate = getFaturaPaymentDueDate('2025-12', 5, 15);
        expect(dueDate).toBe('2026-01-05');
      });

      it('Dec fatura with paymentDueDay > closingDay → same month', () => {
        const dueDate = getFaturaPaymentDueDate('2025-12', 20, 15);
        expect(dueDate).toBe('2025-12-20');
      });

      it('Jan fatura → Feb due date', () => {
        const dueDate = getFaturaPaymentDueDate('2025-01', 5, 15);
        expect(dueDate).toBe('2025-02-05');
      });
    });

    describe('different month lengths', () => {
      it('Feb fatura with paymentDueDay=28 in next month (Mar)', () => {
        const dueDate = getFaturaPaymentDueDate('2025-02', 28, 28);
        expect(dueDate).toBe('2025-03-28');
      });

      it('Jan (31 days) → Feb (28 days) with valid day', () => {
        const dueDate = getFaturaPaymentDueDate('2025-01', 28, 28);
        expect(dueDate).toBe('2025-02-28');
      });

      it('Apr (30 days) fatura with paymentDueDay in next month', () => {
        const dueDate = getFaturaPaymentDueDate('2025-04', 15, 20);
        expect(dueDate).toBe('2025-05-15');
      });
    });

    describe('real-world Brazilian billing cycles', () => {
      it('Nubank-style: closingDay=5, paymentDueDay=15 (same month)', () => {
        const dueDate = getFaturaPaymentDueDate('2025-01', 15, 5);
        expect(dueDate).toBe('2025-01-15');
      });

      it('Itaú-style: closingDay=15, paymentDueDay=5 (next month)', () => {
        const dueDate = getFaturaPaymentDueDate('2025-01', 5, 15);
        expect(dueDate).toBe('2025-02-05');
      });

      it('Common pattern: closingDay=10, paymentDueDay=20 (same month)', () => {
        const dueDate = getFaturaPaymentDueDate('2025-01', 20, 10);
        expect(dueDate).toBe('2025-01-20');
      });

      it('Common pattern: closingDay=20, paymentDueDay=10 (next month)', () => {
        const dueDate = getFaturaPaymentDueDate('2025-01', 10, 20);
        expect(dueDate).toBe('2025-02-10');
      });
    });
  });

  describe('formatFaturaMonthWithLocale', () => {
    describe('pt-BR locale', () => {
      it('formats January in Portuguese', () => {
        const formatted = formatFaturaMonthWithLocale('2025-01', 'pt-BR');
        expect(formatted.toLowerCase()).toContain('janeiro');
        expect(formatted).toContain('2025');
      });

      it('formats all 12 months in Portuguese', () => {
        const months = [
          'janeiro',
          'fevereiro',
          'março',
          'abril',
          'maio',
          'junho',
          'julho',
          'agosto',
          'setembro',
          'outubro',
          'novembro',
          'dezembro',
        ];

        months.forEach((month, index) => {
          const yearMonth = `2025-${String(index + 1).padStart(2, '0')}`;
          const formatted = formatFaturaMonthWithLocale(yearMonth, 'pt-BR');
          expect(formatted.toLowerCase()).toContain(month);
        });
      });
    });

    describe('en locale', () => {
      it('formats January in English', () => {
        const formatted = formatFaturaMonthWithLocale('2025-01', 'en');
        expect(formatted).toContain('January');
        expect(formatted).toContain('2025');
      });

      it('formats all 12 months in English', () => {
        const months = [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ];

        months.forEach((month, index) => {
          const yearMonth = `2025-${String(index + 1).padStart(2, '0')}`;
          const formatted = formatFaturaMonthWithLocale(yearMonth, 'en');
          expect(formatted).toContain(month);
        });
      });
    });

    describe('locale-specific formatting', () => {
      it('produces different output for different locales', () => {
        const ptBR = formatFaturaMonthWithLocale('2025-01', 'pt-BR');
        const en = formatFaturaMonthWithLocale('2025-01', 'en');
        expect(ptBR).not.toBe(en);
      });

      it('handles year rollover formatting', () => {
        const formatted = formatFaturaMonthWithLocale('2026-12', 'en');
        expect(formatted).toContain('2026');
        expect(formatted).toContain('December');
      });
    });
  });

  describe('getCurrentFaturaMonth', () => {
    let originalDate: typeof Date;

    beforeEach(() => {
      originalDate = global.Date;
    });

    afterEach(() => {
      global.Date = originalDate;
    });

    it('uses current date with closing day logic', () => {
      // Mock Date to return Jan 10, 2025
      vi.setSystemTime(new Date('2025-01-10T00:00:00Z'));

      const faturaMonth = getCurrentFaturaMonth(15);
      expect(faturaMonth).toBe('2025-01'); // Before closing day
    });

    it('returns next month when after closing day', () => {
      // Mock Date to return Jan 20, 2025
      vi.setSystemTime(new Date('2025-01-20T00:00:00Z'));

      const faturaMonth = getCurrentFaturaMonth(15);
      expect(faturaMonth).toBe('2025-02'); // After closing day
    });

    it('handles year boundary correctly', () => {
      // Mock Date to return Dec 31, 2025
      vi.setSystemTime(new Date('2025-12-31T00:00:00Z'));

      const faturaMonth = getCurrentFaturaMonth(15);
      expect(faturaMonth).toBe('2026-01'); // After closing day, next year
    });
  });

  describe('regression tests from historical bugs', () => {
    it('Bug: purchase after closing day uses correct next month (not purchase month)', () => {
      // This was a real bug: system was using purchase month instead of applying closing day logic
      const purchaseDate = new Date('2025-01-20T00:00:00Z');
      const faturaMonth = getFaturaMonth(purchaseDate, 15);
      expect(faturaMonth).toBe('2025-02'); // NOT '2025-01'
    });

    it('Bug: due date calculation must account for closing day relationship', () => {
      // This was a real bug: due dates were one month off
      const dueDate = getFaturaPaymentDueDate('2025-01', 5, 15);
      expect(dueDate).toBe('2025-02-05'); // NOT '2025-01-05' (can't pay before statement closes)
    });

    it('Bug: paymentDueDay before or on closingDay requires next month', () => {
      // Edge case: when payment is due on same day as closing, it must be next month
      const dueDate = getFaturaPaymentDueDate('2025-01', 15, 15);
      expect(dueDate).toBe('2025-02-15'); // NOT '2025-01-15'
    });
  });

  describe('integration scenarios', () => {
    describe('purchase to fatura month mapping', () => {
      it('maps purchase before closing to current month fatura', () => {
        const purchaseDate = new Date('2025-01-10T00:00:00Z');
        const closingDay = 15;
        const faturaMonth = getFaturaMonth(purchaseDate, closingDay);
        const dueDate = getFaturaPaymentDueDate(faturaMonth, 5, closingDay);

        expect(faturaMonth).toBe('2025-01');
        expect(dueDate).toBe('2025-02-05');
      });

      it('maps purchase after closing to next month fatura', () => {
        const purchaseDate = new Date('2025-01-20T00:00:00Z');
        const closingDay = 15;
        const faturaMonth = getFaturaMonth(purchaseDate, closingDay);
        const dueDate = getFaturaPaymentDueDate(faturaMonth, 5, closingDay);

        expect(faturaMonth).toBe('2025-02');
        expect(dueDate).toBe('2025-03-05');
      });
    });

    describe('installment expenses across multiple months', () => {
      it('3-installment expense with purchases in sequential months', () => {
        const closingDay = 15;
        const paymentDueDay = 5;

        // Purchase on Jan 10 (before closing)
        const installment1Date = new Date('2025-01-10T00:00:00Z');
        const fatura1 = getFaturaMonth(installment1Date, closingDay);
        const due1 = getFaturaPaymentDueDate(fatura1, paymentDueDay, closingDay);

        // Second installment is conceptually "Feb 10"
        const installment2Date = new Date('2025-02-10T00:00:00Z');
        const fatura2 = getFaturaMonth(installment2Date, closingDay);
        const due2 = getFaturaPaymentDueDate(fatura2, paymentDueDay, closingDay);

        // Third installment is "Mar 10"
        const installment3Date = new Date('2025-03-10T00:00:00Z');
        const fatura3 = getFaturaMonth(installment3Date, closingDay);
        const due3 = getFaturaPaymentDueDate(fatura3, paymentDueDay, closingDay);

        expect([fatura1, fatura2, fatura3]).toEqual(['2025-01', '2025-02', '2025-03']);
        expect([due1, due2, due3]).toEqual(['2025-02-05', '2025-03-05', '2025-04-05']);
      });

      it('3-installment expense starting after closing day', () => {
        const closingDay = 15;

        // Purchase on Jan 20 (after closing) → fatura Feb
        const installment1Date = new Date('2025-01-20T00:00:00Z');
        const fatura1 = getFaturaMonth(installment1Date, closingDay);

        // Second installment "Feb 20" → fatura Mar
        const installment2Date = new Date('2025-02-20T00:00:00Z');
        const fatura2 = getFaturaMonth(installment2Date, closingDay);

        // Third installment "Mar 20" → fatura Apr
        const installment3Date = new Date('2025-03-20T00:00:00Z');
        const fatura3 = getFaturaMonth(installment3Date, closingDay);

        expect([fatura1, fatura2, fatura3]).toEqual(['2025-02', '2025-03', '2025-04']);
      });
    });

    describe('year boundary with installments', () => {
      it('handles installments spanning year boundary', () => {
        const closingDay = 15;

        // Purchase Nov 10 → fatura Nov
        const nov = getFaturaMonth(new Date('2025-11-10T00:00:00Z'), closingDay);
        // Purchase Dec 10 → fatura Dec
        const dec = getFaturaMonth(new Date('2025-12-10T00:00:00Z'), closingDay);
        // Purchase Jan 10 (next year) → fatura Jan
        const jan = getFaturaMonth(new Date('2026-01-10T00:00:00Z'), closingDay);

        expect([nov, dec, jan]).toEqual(['2025-11', '2025-12', '2026-01']);
      });
    });
  });

  describe('data consistency checks', () => {
    it('faturaMonth can differ from purchase date month (expected behavior)', () => {
      // This is correct: purchase month != fatura month when after closing day
      const purchaseDate = new Date('2025-01-20T00:00:00Z');
      const faturaMonth = getFaturaMonth(purchaseDate, 15);

      expect(purchaseDate.getUTCMonth() + 1).toBe(1); // January (purchase)
      expect(faturaMonth).toBe('2025-02'); // February (fatura)
    });

    it('budget tracking uses purchase date, fatura grouping uses faturaMonth', () => {
      // This is a design principle, not a test of a single function
      // But documenting the expected behavior:
      const purchaseDate = new Date('2025-01-20T00:00:00Z');
      const faturaMonth = getFaturaMonth(purchaseDate, 15);

      // Budget should track by purchase month (January)
      const budgetMonth = `${purchaseDate.getUTCFullYear()}-${String(purchaseDate.getUTCMonth() + 1).padStart(2, '0')}`;
      expect(budgetMonth).toBe('2025-01');

      // Fatura should group by fatura month (February)
      expect(faturaMonth).toBe('2025-02');

      // These are different by design
      expect(budgetMonth).not.toBe(faturaMonth);
    });
  });

  describe('computeFaturaWindowStart', () => {
    describe('basic functionality', () => {
      it('computes window start as previous closing date + 1 day', () => {
        // Feb 2025 fatura with closingDay=15
        // Previous fatura (Jan) closes on Jan 15
        // Feb window starts Jan 16
        const windowStart = computeFaturaWindowStart('2025-02', 15);
        expect(windowStart).toBe('2025-01-16');
      });

      it('computes window start for March fatura', () => {
        // Mar 2025 fatura with closingDay=15
        // Previous fatura (Feb) closes on Feb 15
        // Mar window starts Feb 16
        const windowStart = computeFaturaWindowStart('2025-03', 15);
        expect(windowStart).toBe('2025-02-16');
      });

      it('computes window start for January (year boundary)', () => {
        // Jan 2026 fatura with closingDay=15
        // Previous fatura (Dec 2025) closes on Dec 15
        // Jan window starts Dec 16
        const windowStart = computeFaturaWindowStart('2026-01', 15);
        expect(windowStart).toBe('2025-12-16');
      });
    });

    describe('different closing days', () => {
      it('closingDay=1: window starts on day 2', () => {
        const windowStart = computeFaturaWindowStart('2025-02', 1);
        expect(windowStart).toBe('2025-01-02');
      });

      it('closingDay=28: window starts on day 29', () => {
        // For Feb fatura, Jan closes on 28, window starts Jan 29
        const windowStart = computeFaturaWindowStart('2025-02', 28);
        expect(windowStart).toBe('2025-01-29');
      });

      it('closingDay=5: window starts on day 6', () => {
        const windowStart = computeFaturaWindowStart('2025-02', 5);
        expect(windowStart).toBe('2025-01-06');
      });
    });

    describe('month boundary edge cases', () => {
      it('handles short months - Feb has only 28 days', () => {
        // For Mar fatura, Feb (non-leap year) closes on Feb 28 (or closingDay if lower)
        // closingDay=30 but Feb only has 28 days, so closes on 28
        // Window starts Feb 29... but wait, 2025 is not leap year
        // So if closingDay=30, Feb closing is Feb 28, window starts Mar 1
        const windowStart = computeFaturaWindowStart('2025-03', 30);
        expect(windowStart).toBe('2025-03-01');
      });

      it('handles leap year - Feb has 29 days', () => {
        // For Mar 2024 fatura, Feb (leap year) has 29 days
        // closingDay=30 but Feb only has 29 days, so closes on 29
        // Window starts Mar 1
        const windowStart = computeFaturaWindowStart('2024-03', 30);
        expect(windowStart).toBe('2024-03-01');
      });

      it('handles closingDay greater than previous month days', () => {
        // Apr fatura, Mar closes on 31 (if closingDay >= 31)
        // closingDay=31, Mar has 31 days, so closes Mar 31
        // Window starts Apr 1
        const windowStart = computeFaturaWindowStart('2025-04', 31);
        expect(windowStart).toBe('2025-04-01');
      });
    });

    describe('installment date calculation integration', () => {
      it('3-installment expense places entries at fatura window starts', () => {
        const closingDay = 15;

        // Purchase on Jan 10 (before closing) → fatura Jan
        // Installment 1: purchaseDate = Jan 10 (actual)
        // Installment 2: faturaMonth = Feb, purchaseDate = window start = Jan 16
        // Installment 3: faturaMonth = Mar, purchaseDate = window start = Feb 16

        const windowStart2 = computeFaturaWindowStart('2025-02', closingDay);
        const windowStart3 = computeFaturaWindowStart('2025-03', closingDay);

        expect(windowStart2).toBe('2025-01-16');
        expect(windowStart3).toBe('2025-02-16');
      });

      it('fatura window start is always within the billing period', () => {
        // Feb fatura window is Jan 16 - Feb 15 (closingDay=15)
        // Window start should be Jan 16
        const windowStart = computeFaturaWindowStart('2025-02', 15);
        expect(windowStart).toBe('2025-01-16');

        // Verify it's after previous closing (Jan 15)
        expect(new Date(windowStart + 'T00:00:00Z').getTime())
          .toBeGreaterThan(new Date('2025-01-15T00:00:00Z').getTime());

        // Verify it's on or before current closing (Feb 15)
        expect(new Date(windowStart + 'T00:00:00Z').getTime())
          .toBeLessThanOrEqual(new Date('2025-02-15T00:00:00Z').getTime());
      });
    });
  });
});
