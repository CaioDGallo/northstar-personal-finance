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
  return Math.round(parseFloat(value) * 100);
}

/**
 * Format cents as Brazilian Real
 * @example formatCurrency(10050) → "R$ 100,50"
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * Get current year-month string
 * @example getCurrentYearMonth() → "2024-01"
 */
export function getCurrentYearMonth(): string {
  const now = new Date();
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
 */
export function formatDate(
  date: string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === 'string' ? parseLocalDate(date) : date;
  return dateObj.toLocaleDateString('pt-BR', options);
}
