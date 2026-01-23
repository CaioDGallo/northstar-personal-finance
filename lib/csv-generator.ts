import type { ExportEntry, ExportTransfer } from '@/lib/actions/export';
import { centsToDisplay } from '@/lib/utils';

/**
 * Escape CSV special characters (quotes, commas, newlines)
 */
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert transfer type enum to Portuguese label
 */
function getTransferTypeLabel(type: string): string {
  const typeMap: Record<string, string> = {
    fatura_payment: 'Pagamento de fatura',
    internal_transfer: 'Transferência',
    deposit: 'Depósito',
    withdrawal: 'Saque',
  };
  return typeMap[type] || type;
}

/**
 * Generate CSV for transactions (expenses + income)
 * Expenses are negative, income is positive
 */
export function generateTransactionsCsv(
  data: ExportEntry[]
): string {
  // CSV Header
  const header = 'Data,Descricao,Categoria,Conta,Valor,Tipo,Status,Parcela,ID';

  // CSV Rows
  const rows = data.map((item) => {
    const amount = item.type === 'expense' ? -item.amount : item.amount;
    const amountDisplay = centsToDisplay(Math.abs(amount));
    const amountWithSign = item.type === 'expense' ? `-${amountDisplay}` : amountDisplay;

    const tipo = item.type === 'expense' ? 'Despesa' : 'Receita';
    const status = item.status === 'paid'
      ? (item.type === 'expense' ? 'Pago' : 'Recebido')
      : 'Pendente';

    const prefix = item.type === 'expense' ? 'TXN' : 'INC';
    const id = `${prefix}-${item.transactionId}`;

    return [
      escapeCSV(item.date),
      escapeCSV(item.description),
      escapeCSV(item.categoryName),
      escapeCSV(item.accountName),
      escapeCSV(amountWithSign),
      escapeCSV(tipo),
      escapeCSV(status),
      escapeCSV(item.installment || ''),
      escapeCSV(id),
    ].join(',');
  });

  return header + '\n' + rows.join('\n');
}

/**
 * Generate CSV for transfers
 */
export function generateTransfersCsv(
  data: ExportTransfer[]
): string {
  // CSV Header
  const header = 'Data,Origem,Destino,Valor,Tipo,Descricao,ID';

  // CSV Rows
  const rows = data.map((transfer) => {
    const amountDisplay = centsToDisplay(transfer.amount);
    const tipo = getTransferTypeLabel(transfer.type);
    const id = `TRF-${transfer.id}`;

    return [
      escapeCSV(transfer.date),
      escapeCSV(transfer.fromAccountName || ''),
      escapeCSV(transfer.toAccountName || ''),
      escapeCSV(amountDisplay),
      escapeCSV(tipo),
      escapeCSV(transfer.description || ''),
      escapeCSV(id),
    ].join(',');
  });

  return header + '\n' + rows.join('\n');
}

/**
 * Download CSV file to browser
 * Uses UTF-8 with BOM for Excel compatibility with Portuguese characters
 */
export function downloadCsv(content: string, filename: string): void {
  // Add UTF-8 BOM for Excel compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + content], { type: 'text/csv;charset=utf-8;' });

  // Create download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up URL
  URL.revokeObjectURL(url);
}
