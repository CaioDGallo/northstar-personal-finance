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

/**
 * Computes the actual closing date for a given fatura month and closing day.
 * Handles months with fewer than the specified closing day (e.g., Feb 30 → Feb 28).
 *
 * Example: computeClosingDate("2025-02", 30) → "2025-02-28"
 * Example: computeClosingDate("2025-01", 15) → "2025-01-15"
 *
 * @param yearMonth - Fatura month in "YYYY-MM" format
 * @param closingDay - Desired closing day (1-31)
 * @returns Actual closing date in "YYYY-MM-DD" format
 */
export function computeClosingDate(yearMonth: string, closingDay: number): string {
  const [year, month] = yearMonth.split('-').map(Number);

  // Get last day of the month
  const lastDayOfMonth = new Date(year, month, 0).getDate();

  // Use the lesser of closingDay and lastDayOfMonth
  const actualDay = Math.min(closingDay, lastDayOfMonth);

  // Create date in local time to avoid timezone issues
  const date = new Date(year, month - 1, actualDay);
  return date.toISOString().split('T')[0];
}

/**
 * Determines which fatura month a purchase belongs to based on the actual closing date.
 * This is used when faturas have custom closing dates that differ from account defaults.
 *
 * Logic:
 * - If purchase date <= closing date → belongs to the fatura's month
 * - If purchase date > closing date → belongs to next month's fatura
 *
 * Example: closingDate = "2025-01-31"
 * - Purchase on 2025-01-15 → "2025-01"
 * - Purchase on 2025-02-01 → "2025-02"
 *
 * @param purchaseDate - When the purchase occurred
 * @param closingDate - The actual closing date for a specific fatura
 * @returns Fatura month in "YYYY-MM" format
 */
export function getFaturaMonthFromClosingDate(
  purchaseDate: Date,
  closingDate: Date
): string {
  // Compare dates using getTime() to handle timezone consistently
  if (purchaseDate.getTime() <= closingDate.getTime()) {
    // Purchase on/before closing → belongs to this fatura's month
    const year = closingDate.getUTCFullYear();
    const month = closingDate.getUTCMonth() + 1; // Convert 0-indexed to 1-indexed
    return `${year}-${String(month).padStart(2, '0')}`;
  } else {
    // Purchase after closing → belongs to next month's fatura
    const year = purchaseDate.getUTCFullYear();
    const month = purchaseDate.getUTCMonth() + 1; // Already 1-indexed
    return `${year}-${String(month).padStart(2, '0')}`;
  }
}

/**
 * Computes the start date of a fatura billing window.
 *
 * The fatura window starts the day after the previous month's closing date.
 * This is used to determine the purchaseDate for installments after the first one.
 *
 * Example: For Feb 2025 fatura with closingDay=15
 * - Previous fatura (Jan) closes on 2025-01-15
 * - Feb fatura window starts on 2025-01-16
 *
 * @param yearMonth - Fatura month in "YYYY-MM" format
 * @param closingDay - Day of month when statement closes (1-28)
 * @returns Start date of the billing window in "YYYY-MM-DD" format
 */
export function computeFaturaWindowStart(yearMonth: string, closingDay: number): string {
  const [year, month] = yearMonth.split('-').map(Number);

  // Get the previous month
  const prevMonthDate = new Date(Date.UTC(year, month - 2, 1)); // month is 1-indexed, Date uses 0-indexed
  const prevYear = prevMonthDate.getUTCFullYear();
  const prevMonth = prevMonthDate.getUTCMonth(); // 0-indexed

  // Get the last day of the previous month
  const lastDayOfPrevMonth = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();

  // The previous month's closing day (adjusted if month has fewer days)
  const actualClosingDay = Math.min(closingDay, lastDayOfPrevMonth);

  // Window starts the day after the previous closing date
  const startDate = new Date(Date.UTC(prevYear, prevMonth, actualClosingDay + 1));

  return startDate.toISOString().split('T')[0];
}
