import type { ImportTemplate, ParseResult, ValidatedImportRow, ImportRowError } from '../types';
import { parseOFXTransactions } from './ofx-parser';
import { simplifyDescription } from './nubank-extrato-simplify';

export const nubankExtratoOfxParser: ImportTemplate = {
  id: 'nubank-extrato-ofx',
  name: 'Nubank Extrato (OFX)',
  description: 'Importar extrato OFX da conta corrente Nubank',
  nameKey: 'nubank-extrato-ofx.name',
  descriptionKey: 'nubank-extrato-ofx.description',

  parse(content: string): ParseResult {
    const rows: ValidatedImportRow[] = [];
    const errors: ImportRowError[] = [];

    try {
      const transactions = parseOFXTransactions(content);

      transactions.forEach((txn, index) => {
        // For checking account OFX: negative amount = expense, positive = income
        // (OFX uses standard convention for both account types)
        const isIncome = txn.amount > 0;
        const normalizedCents = Math.abs(txn.amount);

        rows.push({
          date: txn.date,
          description: simplifyDescription(txn.description).simplified,
          amountCents: normalizedCents,
          rowIndex: index + 1,
          externalId: txn.externalId,
          type: isIncome ? 'income' : 'expense',
        });
      });

      // If no transactions found, add an error
      if (transactions.length === 0 && !content.includes('<STMTTRN>')) {
        errors.push({
          rowIndex: 1,
          field: 'description',
          message: 'No OFX transactions found in file',
          messageKey: 'nubank-extrato-ofx.errors.noTransactionsFound',
          rawValue: '',
        });
      }
    } catch (error) {
      errors.push({
        rowIndex: 1,
        field: 'description',
        message: `Failed to parse OFX file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        messageKey: 'nubank-extrato-ofx.errors.parseError',
        rawValue: '',
      });
    }

    return { rows, errors, skipped: 0 };
  },
};
