import type { ImportTemplate, ParseResult, ValidatedImportRow, ImportRowError } from '../types';

export const nubankParser: ImportTemplate = {
  id: 'nubank',
  name: 'Nubank Credit Card',
  description: 'CSV format from Nubank credit card exports (date, title, amount)',
  nameKey: 'nubank.name',
  descriptionKey: 'nubank.description',

  parse(content: string): ParseResult {
    const rows: ValidatedImportRow[] = [];
    const errors: ImportRowError[] = [];
    let skipped = 0;

    const lines = content.trim().split('\n');

    lines.forEach((line, index) => {
      // Skip header row
      if (index === 0) {
        skipped++;
        return;
      }

      // Skip empty lines
      if (!line.trim()) {
        skipped++;
        return;
      }

      // Parse CSV line (simple split - assumes no commas in values)
      const parts = line.split(',');

      if (parts.length < 3) {
        errors.push({
          rowIndex: index + 1,
          field: 'description',
          message: 'Invalid CSV format - expected 3 columns',
          messageKey: 'nubank.errors.invalidCsvFormat',
          rawValue: line,
        });
        return;
      }

      const [dateStr, title, amountStr] = parts;

      // Validate date (YYYY-MM-DD)
      const dateMatch = dateStr?.match(/^\d{4}-\d{2}-\d{2}$/);
      if (!dateMatch) {
        errors.push({
          rowIndex: index + 1,
          field: 'date',
          message: 'Invalid date format - expected YYYY-MM-DD',
          messageKey: 'nubank.errors.invalidDateFormat',
          rawValue: dateStr || '',
        });
        return;
      }

      // Validate description
      if (!title?.trim()) {
        errors.push({
          rowIndex: index + 1,
          field: 'description',
          message: 'Description is required',
          messageKey: 'nubank.errors.descriptionRequired',
          rawValue: title || '',
        });
        return;
      }

      // Parse amount
      const amount = parseFloat(amountStr || '');
      if (isNaN(amount)) {
        errors.push({
          rowIndex: index + 1,
          field: 'amount',
          message: 'Invalid amount',
          messageKey: 'nubank.errors.invalidAmount',
          rawValue: amountStr || '',
        });
        return;
      }

      // Determine type: positive = expense (charge), negative = income (refund)
      const isIncome = amount < 0;
      const amountCents = Math.round(Math.abs(amount) * 100);

      rows.push({
        date: dateStr,
        description: title.trim(),
        amountCents,
        rowIndex: index + 1,
        type: isIncome ? 'income' : 'expense',
      });
    });

    return { rows, errors, skipped };
  },
};
