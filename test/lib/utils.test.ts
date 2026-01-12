import { describe, it, expect, vi } from 'vitest';
import {
  centsToDisplay,
  displayToCents,
  formatCurrency,
  formatCurrencyWithLocale,
  getCurrentYearMonth,
  parseYearMonth,
  addMonths,
} from '@/lib/utils';

describe('Money Utilities', () => {
  describe('centsToDisplay', () => {
    it('converts cents to display string', () => {
      expect(centsToDisplay(10050)).toBe('100.50');
      expect(centsToDisplay(100)).toBe('1.00');
      expect(centsToDisplay(1)).toBe('0.01');
      expect(centsToDisplay(0)).toBe('0.00');
    });

    it('handles negative values', () => {
      expect(centsToDisplay(-5000)).toBe('-50.00');
      expect(centsToDisplay(-1)).toBe('-0.01');
    });

    it('handles large values', () => {
      expect(centsToDisplay(999999999)).toBe('9999999.99');
    });
  });

  describe('displayToCents', () => {
    it('converts display string to cents', () => {
      expect(displayToCents('100.50')).toBe(10050);
      expect(displayToCents('1.00')).toBe(100);
      expect(displayToCents('0.01')).toBe(1);
      expect(displayToCents('0')).toBe(0);
    });

    it('rounds floating point correctly', () => {
      expect(displayToCents('0.30')).toBe(30);
      expect(displayToCents('100.99')).toBe(10099);
    });

    it('returns NaN for invalid input', () => {
      expect(Number.isNaN(displayToCents(''))).toBe(true);
      expect(Number.isNaN(displayToCents('abc'))).toBe(true);
    });

    it('handles extra whitespace', () => {
      expect(displayToCents('  10.50  ')).toBe(1050);
    });
  });

  describe('formatCurrency', () => {
    it('formats cents as BRL', () => {
      // Note: Uses non-breaking space (\u00A0) between R$ and amount
      expect(formatCurrency(10050)).toBe('R$\u00A0100,50');
      expect(formatCurrency(100000)).toBe('R$\u00A01.000,00');
      expect(formatCurrency(1)).toBe('R$\u00A00,01');
    });

    it('handles large values with thousand separators', () => {
      expect(formatCurrency(100000000)).toBe('R$\u00A01.000.000,00');
    });

    it('handles negative values', () => {
      expect(formatCurrency(-5000)).toBe('-R$\u00A050,00');
    });
  });

  describe('formatCurrencyWithLocale', () => {
    it('formats cents as BRL with pt-BR locale', () => {
      // Should match formatCurrency default behavior
      expect(formatCurrencyWithLocale(10050, 'pt-BR')).toBe('R$\u00A0100,50');
      expect(formatCurrencyWithLocale(100000, 'pt-BR')).toBe('R$\u00A01.000,00');
    });

    it('formats cents as BRL with en locale', () => {
      // English locale uses period for decimal, comma for thousands
      expect(formatCurrencyWithLocale(10050, 'en')).toBe('R$100.50');
      expect(formatCurrencyWithLocale(100000, 'en')).toBe('R$1,000.00');
    });

    it('formats cents as BRL with en-US locale', () => {
      expect(formatCurrencyWithLocale(10050, 'en-US')).toBe('R$100.50');
      expect(formatCurrencyWithLocale(1000000, 'en-US')).toBe('R$10,000.00');
    });

    it('handles negative values with locale', () => {
      expect(formatCurrencyWithLocale(-5000, 'pt-BR')).toBe('-R$\u00A050,00');
      expect(formatCurrencyWithLocale(-5000, 'en')).toBe('-R$50.00');
    });

    it('handles zero with locale', () => {
      expect(formatCurrencyWithLocale(0, 'pt-BR')).toBe('R$\u00A00,00');
      expect(formatCurrencyWithLocale(0, 'en')).toBe('R$0.00');
    });

    it('handles large values with locale-specific separators', () => {
      // pt-BR: period for thousands, comma for decimal
      expect(formatCurrencyWithLocale(100000000, 'pt-BR')).toBe('R$\u00A01.000.000,00');
      // en: comma for thousands, period for decimal
      expect(formatCurrencyWithLocale(100000000, 'en')).toBe('R$1,000,000.00');
    });
  });
});

describe('Date Utilities', () => {
  describe('getCurrentYearMonth', () => {
    it('returns current year-month in YYYY-MM format', () => {
      const result = getCurrentYearMonth();
      expect(result).toMatch(/^\d{4}-\d{2}$/);
    });

    it('handles next month across year boundary', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 11, 15));

      expect(getCurrentYearMonth(true)).toBe('2027-01');

      vi.useRealTimers();
    });
  });

  describe('parseYearMonth', () => {
    it('parses year-month to Date', () => {
      const result = parseYearMonth('2025-01');
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // January = 0
      expect(result.getDate()).toBe(1);
    });
  });

  describe('addMonths', () => {
    it('adds months correctly', () => {
      expect(addMonths('2025-01', 1)).toBe('2025-02');
      expect(addMonths('2025-01', 12)).toBe('2026-01');
      expect(addMonths('2025-12', 1)).toBe('2026-01');
    });

    it('subtracts months correctly', () => {
      expect(addMonths('2025-02', -1)).toBe('2025-01');
      expect(addMonths('2026-01', -12)).toBe('2025-01');
      expect(addMonths('2025-01', -1)).toBe('2024-12');
    });

    it('handles zero months', () => {
      expect(addMonths('2025-05', 0)).toBe('2025-05');
    });
  });
});
