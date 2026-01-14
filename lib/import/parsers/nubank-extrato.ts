import type { ImportTemplate, ParseResult, ValidatedImportRow, ImportRowError } from '../types';
import { parseCurrencyToCents } from '@/lib/utils';
import { simplifyDescription } from './nubank-extrato-simplify';

export const nubankExtratoParser: ImportTemplate = {
  id: 'nubank-extrato',
  name: 'Nubank Extrato (Conta Corrente)',
  description: 'Importar extrato da conta corrente Nubank (CSV)',
  nameKey: 'nubank-extrato.name',
  descriptionKey: 'nubank-extrato.description',

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

      // Parse CSV - format: Data,Valor,Identificador,Descrição (comma or semicolon delimited)
      const delimiter = line.includes(';') ? ';' : ',';
      const parts = line.split(delimiter);

      if (parts.length < 4) {
        errors.push({
          rowIndex: index + 1,
          field: 'description',
          message: 'Invalid CSV format',
          messageKey: 'nubank-extrato.errors.invalidCsvFormat',
          rawValue: line,
        });
        return;
      }

      const [dateStr, amountStr, identifier, ...descriptionParts] = parts;
      const description = descriptionParts.join(delimiter);

      // Convert DD/MM/YYYY to YYYY-MM-DD
      const [day, month, year] = dateStr.split('/');
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

      // Validate date
      const dateObj = new Date(isoDate);
      if (isNaN(dateObj.getTime())) {
        errors.push({
          rowIndex: index + 1,
          field: 'date',
          message: 'Invalid date format',
          messageKey: 'nubank-extrato.errors.invalidDateFormat',
          rawValue: dateStr,
        });
        return;
      }

      // Validate UUID format
      const uuidRegex = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
      if (!uuidRegex.test(identifier)) {
        errors.push({
          rowIndex: index + 1,
          field: 'identifier',
          message: 'Invalid identifier format (expected UUID)',
          messageKey: 'nubank-extrato.errors.invalidIdentifierFormat',
          rawValue: identifier,
        });
        return;
      }

      // Parse amount
      const amountCents = parseCurrencyToCents(amountStr);
      if (amountCents === null || amountCents === 0) {
        errors.push({
          rowIndex: index + 1,
          field: 'amount',
          message: 'Invalid or zero amount',
          messageKey: 'nubank-extrato.errors.invalidOrZeroAmount',
          rawValue: amountStr,
        });
        return;
      }

      // Determine type: positive = income, negative = expense
      const isIncome = amountCents > 0;
      const normalizedCents = Math.abs(amountCents);

      rows.push({
        date: isoDate,
        description: simplifyDescription(description.trim()).simplified,
        amountCents: normalizedCents,
        rowIndex: index + 1,
        externalId: identifier,
        type: isIncome ? 'income' : 'expense',
      });
    });

    return { rows, errors, skipped };
  },
};
