/**
 * Fatura (Credit Card Statement) Utilities
 *
 * Logic for computing which fatura a purchase belongs to based on
 * the purchase date and credit card closing day.
 */

/**
 * Determines which fatura (statement) a purchase belongs to based on closing day.
 *
 * Logic:
 * - Purchases on/before closing day → current month's fatura
 * - Purchases after closing day → next month's fatura
 *
 * Example: closingDay = 15
 * - Purchase on Jan 10 → "2025-01" (closes Jan 15)
 * - Purchase on Jan 20 → "2025-02" (closes Feb 15)
 *
 * @param purchaseDate - When the purchase occurred
 * @param closingDay - Day of month when statement closes (1-28)
 * @returns Fatura month in "YYYY-MM" format
 */
export function getFaturaMonth(purchaseDate: Date, closingDay: number): string {
  // Use UTC methods to avoid timezone issues when parsing date-only strings from DB
  const year = purchaseDate.getUTCFullYear();
  const month = purchaseDate.getUTCMonth(); // 0-indexed
  const day = purchaseDate.getUTCDate();

  if (day <= closingDay) {
    // Purchase on/before closing → belongs to current month's fatura
    return `${year}-${String(month + 1).padStart(2, '0')}`;
  } else {
    // Purchase after closing → belongs to next month's fatura
    const nextMonth = new Date(Date.UTC(year, month + 1, 1));
    return `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}`;
  }
}

/**
 * Calculates the payment due date for a fatura.
 *
 * The payment is due in the month AFTER the fatura month if paymentDueDay
 * is on or before closingDay (can't pay before seeing the bill).
 * Otherwise, payment is in the same month as the fatura.
 *
 * Example: fatura "2025-01" with closingDay=15, paymentDueDay=5
 * → Payment due: 2025-02-05 (next month, since 5 <= 15)
 *
 * Example: fatura "2025-01" with closingDay=5, paymentDueDay=12
 * → Payment due: 2025-01-12 (same month, since 12 > 5)
 *
 * @param faturaMonth - Fatura month in "YYYY-MM" format
 * @param paymentDueDay - Day of month when payment is due (1-28)
 * @param closingDay - Day of month when statement closes (1-28)
 * @returns Due date in "YYYY-MM-DD" format
 */
export function getFaturaPaymentDueDate(
  faturaMonth: string,
  paymentDueDay: number,
  closingDay: number
): string {
  const [year, month] = faturaMonth.split('-').map(Number);

  // If payment due day is on/before closing day, payment must be next month
  // (can't pay before the statement closes)
  if (paymentDueDay <= closingDay) {
    // month is 1-indexed from string, JS Date uses 0-indexed months
    // so using month directly gives us next month
    const paymentDate = new Date(year, month, paymentDueDay);
    return paymentDate.toISOString().split('T')[0];
  } else {
    // Payment is in same month as fatura
    const paymentDate = new Date(year, month - 1, paymentDueDay);
    return paymentDate.toISOString().split('T')[0];
  }
}

/**
 * Formats a fatura month for display.
 *
 * @param yearMonth - Fatura month in "YYYY-MM" format
 * @returns Formatted string like "janeiro de 2025"
 * @deprecated Use formatFaturaMonthWithLocale instead
 */
export function formatFaturaMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

/**
 * Formats a fatura month for display with locale support.
 *
 * @param yearMonth - Fatura month in "YYYY-MM" format
 * @param locale - Locale string (e.g., 'pt-BR', 'en')
 * @returns Formatted string like "janeiro de 2025" or "January 2025"
 */
export function formatFaturaMonthWithLocale(yearMonth: string, locale: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

/**
 * Gets the current fatura month for a credit card based on today's date.
 *
 * @param closingDay - Day of month when statement closes (1-28)
 * @returns Current fatura month in "YYYY-MM" format
 */
export function getCurrentFaturaMonth(closingDay: number): string {
  return getFaturaMonth(new Date(), closingDay);
}
