import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert cents to currency string
 * @example centsToDisplay(10050) → "100.50"
 */
export function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Convert currency string to cents
 * @example displayToCents("100.50") → 10050
 */
export function displayToCents(value: string): number {
  const parsed = parseCurrencyToNumber(value);
  return parsed === null ? NaN : Math.round(parsed * 100);
}

/**
 * Parse currency string into cents with locale-safe separators.
 * Supports commas or dots as decimal separators and ignores thousand separators.
 * Returns null for invalid inputs.
 * @example parseCurrencyToCents("1.234,56") → 123456
 */
export function parseCurrencyToCents(value: string): number | null {
  const parsed = parseCurrencyToNumber(value);
  if (parsed === null) return null;
  return Math.round(parsed * 100);
}

function parseCurrencyToNumber(value: string): number | null {
  if (!value) return null;

  let raw = value.trim();
  if (!raw) return null;

  const hasParens = raw.includes('(') && raw.includes(')');
  raw = raw.replace(/[()]/g, '');

  // Keep digits, separators, and minus sign only
  raw = raw.replace(/[^\d,.\-]/g, '');
  raw = raw.replace(/(?!^)-/g, '');

  if (!raw || raw === '-') return null;

  const isNegative = hasParens || raw.startsWith('-');
  raw = raw.replace(/-/g, '');

  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  let decimalSep: ',' | '.' | null = null;

  if (lastComma !== -1 && lastDot !== -1) {
    decimalSep = lastComma > lastDot ? ',' : '.';
  } else if (lastComma !== -1) {
    decimalSep = ',';
  } else if (lastDot !== -1) {
    decimalSep = '.';
  }

  let normalized = raw;

  if (decimalSep) {
    const parts = raw.split(decimalSep);

    if (parts.length > 2) {
      normalized = raw.replace(new RegExp(`\\${decimalSep}`, 'g'), '');
      decimalSep = null;
    } else {
      const [intPart, fracPart = ''] = parts;
      const fracLen = fracPart.length;
      const isEmptyFraction = fracLen === 0;
      const isLikelyThousands = fracLen === 3 && intPart.length > 0;

      if (isEmptyFraction || isLikelyThousands) {
        normalized = `${intPart}${fracPart}`;
        decimalSep = null;
      } else {
        normalized = `${intPart}.${fracPart}`;
      }
    }

    if (decimalSep) {
      const thousandsSep = decimalSep === ',' ? '.' : ',';
      normalized = normalized.replace(new RegExp(`\\${thousandsSep}`, 'g'), '');
    }
  } else {
    normalized = raw.replace(/[.,]/g, '');
  }

  if (!normalized) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;

  return isNegative ? -parsed : parsed;
}

/**
 * Format cents as Brazilian Real
 * @example formatCurrency(10050) → "R$ 100,50"
 * @deprecated Use formatCurrencyWithLocale or useFormat hook instead
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * Format cents as Brazilian Real with locale support
 * @example formatCurrencyWithLocale(10050, 'pt-BR') → "R$ 100,50"
 * @example formatCurrencyWithLocale(10050, 'en') → "BRL 100.50"
 */
export function formatCurrencyWithLocale(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * Get current year-month string
 * @example getCurrentYearMonth() → "2024-01"
 */
export function getCurrentYearMonth(next?: boolean): string {
  const now = new Date();
  if (next) {
    now.setMonth(now.getMonth() + 1);
  }
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Parse year-month string to Date
 * @example parseYearMonth("2024-01") → Date(2024, 0, 1)
 */
export function parseYearMonth(yearMonth: string): Date {
  const [year, month] = yearMonth.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

/**
 * Add months to year-month string
 * @example addMonths("2024-01", 1) → "2024-02"
 */
export function addMonths(yearMonth: string, months: number): string {
  const date = parseYearMonth(yearMonth);
  date.setMonth(date.getMonth() + months);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Parse "YYYY-MM-DD" date string as local time (not UTC)
 *
 * Fixes timezone bug where `new Date("2026-01-02")` is parsed as UTC midnight,
 * which in GMT-3 is the previous day (Jan 1 at 21:00).
 *
 * @example parseLocalDate("2026-01-02") → Date at Jan 2, 00:00 local time
 */
export function parseLocalDate(dateString: string): Date {
  return new Date(dateString + 'T00:00:00');
}

/**
 * Format date for display (timezone-safe)
 *
 * Accepts either a "YYYY-MM-DD" string or a Date object.
 * For strings, parses as local time to avoid timezone shifts.
 *
 * @example formatDate("2026-01-02") → "2 de janeiro de 2026"
 * @example formatDate("2026-01-02", { weekday: 'long' }) → "quinta-feira, 2 de janeiro de 2026"
 * @example formatDate(new Date()) → "1 de janeiro de 2026"
 * @deprecated Use formatDateWithLocale or useFormat hook instead
 */
export function formatDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? parseLocalDate(date) : date;
  return dateObj.toLocaleDateString('pt-BR', options);
}

/**
 * Format date for display with locale support (timezone-safe)
 *
 * Accepts either a "YYYY-MM-DD" string or a Date object.
 * For strings, parses as local time to avoid timezone shifts.
 *
 * @example formatDateWithLocale("2026-01-02", 'pt-BR') → "2 de janeiro de 2026"
 * @example formatDateWithLocale("2026-01-02", 'en') → "January 2, 2026"
 */
export function formatDateWithLocale(
  date: string | Date,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? parseLocalDate(date) : date;
  return dateObj.toLocaleDateString(locale, options);
}

/**
 * Format date as relative time (e.g., "2 hours ago", "just now")
 * @example formatRelativeTime(new Date(Date.now() - 60000)) → "1 minute ago"
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
}
