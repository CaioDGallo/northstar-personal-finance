import type { ImportTemplate, ParseResult, ValidatedImportRow, ImportRowError, InstallmentInfo } from '../types';
import { parseOFXTransactions } from './ofx-parser';

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

export const nubankOfxParser: ImportTemplate = {
  id: 'nubank-ofx',
  name: 'Nubank Cartão de Crédito (OFX)',
  description: 'Importar fatura OFX do cartão Nubank',
  nameKey: 'nubank-ofx.name',
  descriptionKey: 'nubank-ofx.description',

  parse(content: string): ParseResult {
    const rows: ValidatedImportRow[] = [];
    const errors: ImportRowError[] = [];

    try {
      const transactions = parseOFXTransactions(content);

      transactions.forEach((txn, index) => {
        // For credit card: negative amount = expense (charge), positive = income (refund)
        const isIncome = txn.amount > 0;
        const normalizedCents = Math.abs(txn.amount);

        const installmentInfo = parseInstallmentInfo(txn.description);

        rows.push({
          date: txn.date,
          description: txn.description,
          amountCents: normalizedCents,
          rowIndex: index + 1,
          type: isIncome ? 'income' : 'expense',
          externalId: txn.externalId,
          installmentInfo: installmentInfo ?? undefined,
        });
      });

      // If no transactions found, add an error
      if (transactions.length === 0 && !content.includes('<STMTTRN>')) {
        errors.push({
          rowIndex: 1,
          field: 'description',
          message: 'No OFX transactions found in file',
          messageKey: 'nubank-ofx.errors.noTransactionsFound',
          rawValue: '',
        });
      }
    } catch (error) {
      errors.push({
        rowIndex: 1,
        field: 'description',
        message: `Failed to parse OFX file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        messageKey: 'nubank-ofx.errors.parseError',
        rawValue: '',
      });
    }

    return { rows, errors, skipped: 0 };
  },
};
