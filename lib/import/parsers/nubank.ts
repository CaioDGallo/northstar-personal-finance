import type { ImportTemplate, ParseResult, ValidatedImportRow, ImportRowError, InstallmentInfo } from '../types';
import { parseCurrencyToCents } from '@/lib/utils';

const PARCELA_REGEX = /^(.+?)\s*-\s*Parcela\s+(\d+)\/(\d+)$/i;

function parseInstallmentInfo(description: string): InstallmentInfo | null {
  const match = description.match(PARCELA_REGEX);
  if (!match) return null;

  const [, baseDescription, currentStr, totalStr] = match;
  const current = parseInt(currentStr, 10);
  const total = parseInt(totalStr, 10);

  // Validate: current must be 1-total, total > 1
  if (current < 1 || current > total || total < 2) return null;

  return {
    current,
    total,
    baseDescription: baseDescription.trim(),
  };
}

function generateSyntheticExternalId(date: string, description: string, amountCents: number): string {
  // Create deterministic string
  const input = `${date}|${description}|${amountCents}`;

  // Use DJB2 hash - fast, deterministic, good distribution
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }

  // Convert to hex format
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `cc-${date}-${hex}`;
}

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

      // Parse CSV line with delimiter detection (comma or semicolon)
      const delimiter = line.includes(';') ? ';' : ',';
      const parts = line.split(delimiter);

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

      const dateStr = parts[0];
      const amountStr = parts[parts.length - 1];
      const title = parts.slice(1, -1).join(delimiter);

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
      const amountCents = amountStr ? parseCurrencyToCents(amountStr) : null;
      if (amountCents === null) {
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
      const isIncome = amountCents < 0;
      const normalizedCents = Math.abs(amountCents);

      const description = title.trim();
      const installmentInfo = parseInstallmentInfo(description);
      const externalId = generateSyntheticExternalId(dateStr, description, normalizedCents);

      rows.push({
        date: dateStr,
        description,
        amountCents: normalizedCents,
        rowIndex: index + 1,
        type: isIncome ? 'income' : 'expense',
        externalId,
        installmentInfo: installmentInfo ?? undefined,
      });
    });

    return { rows, errors, skipped };
  },
};
