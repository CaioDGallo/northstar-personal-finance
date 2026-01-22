import type { ParseResult, ImportRowWithSuggestion } from '@/lib/import/types';
import { centsToDisplay, formatDate, cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/button';

type Props = {
  parseResult: ParseResult;
  rowsWithSuggestions?: ImportRowWithSuggestion[];
  selectedRows: Set<number>;
  onToggleRow: (rowIndex: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  startDate?: string;
  closingDate?: string;
};

export function ImportPreview({ parseResult, rowsWithSuggestions, selectedRows, onToggleRow, onSelectAll, onDeselectAll, startDate, closingDate }: Props) {
  const { rows, errors, skipped } = parseResult;
  const tParsers = useTranslations('parsers');
  const t = useTranslations('import');

  const displayRows = rowsWithSuggestions && rowsWithSuggestions.length > 0 ? rowsWithSuggestions : rows;
  const hasSuggestions = rowsWithSuggestions && rowsWithSuggestions.length > 0;

  const expenseCount = displayRows.filter((r) => r.type === 'expense' && 'suggestedCategory' in r && r.suggestedCategory).length;
  const incomeCount = displayRows.filter((r) => r.type === 'income' && 'suggestedCategory' in r && r.suggestedCategory).length;

  // Check for transactions outside OFX date range
  const outOfRangeCount = (startDate && closingDate) ? displayRows.filter((r) => {
    const date = r.date;
    return date < startDate || date > closingDate;
  }).length : 0;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Valid rows</span>
          <span className="font-medium text-green-600 dark:text-green-400">{rows.length}</span>
        </div>
        {hasSuggestions && (expenseCount > 0 || incomeCount > 0) && (
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-600 dark:text-gray-400">Auto-categorized</span>
            <span className="font-medium text-blue-600 dark:text-blue-400">
              {expenseCount + incomeCount} / {rows.length} ({expenseCount} expenses, {incomeCount} income)
            </span>
          </div>
        )}
        {errors.length > 0 && (
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-600 dark:text-gray-400">Errors</span>
            <span className="font-medium text-red-600 dark:text-red-400">{errors.length}</span>
          </div>
        )}
        {skipped > 0 && (
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-600 dark:text-gray-400">Skipped</span>
            <span className="font-medium text-gray-500">{skipped}</span>
          </div>
        )}
        {outOfRangeCount > 0 && (
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-600 dark:text-gray-400">Fora do período OFX</span>
            <span className="font-medium text-yellow-600 dark:text-yellow-400">{outOfRangeCount}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t dark:border-gray-800">
          <span className="text-gray-600 dark:text-gray-400">{t('selectedCount', { selected: selectedRows.size, total: rows.length })}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={selectedRows.size === rows.length ? onDeselectAll : onSelectAll}
          >
            {selectedRows.size === rows.length ? t('deselectAll') : t('selectAll')}
          </Button>
        </div>
      </div>

      {/* Preview Cards */}
      {displayRows.length > 0 && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {displayRows.slice(0, 100).map((row) => {
            const rowWithSuggestion = row as ImportRowWithSuggestion;
            const isSelected = selectedRows.has(row.rowIndex);
            return (
              <div
                key={row.rowIndex}
                role="checkbox"
                aria-checked={isSelected}
                aria-label={`${row.description}, ${centsToDisplay(row.amountCents)}`}
                tabIndex={0}
                onClick={() => onToggleRow(row.rowIndex)}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    onToggleRow(row.rowIndex);
                  }
                }}
                style={{ touchAction: 'manipulation' }}
                className={cn(
                  'p-3 rounded-lg border dark:border-gray-800 cursor-pointer transition-all',
                  'hover:bg-muted/50 active:bg-muted',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  '[-webkit-tap-highlight-color:transparent]',
                  isSelected && 'bg-green-500/10 border-green-700/80',
                  rowWithSuggestion.isDuplicate && 'opacity-60'
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Selection indicator */}
                  <div
                    className={cn(
                      'size-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all',
                      isSelected
                        ? 'bg-primary/85 border-green-600'
                        : 'bg-muted border-muted-foreground/30'
                    )}
                  >
                    {isSelected && (
                      <HugeiconsIcon icon={Tick02Icon} className="size-3 text-green-600" strokeWidth={4} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Date and Amount row */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(row.date)}
                      </span>
                      <span
                        className={cn(
                          'font-medium',
                          row.type === 'income'
                            ? 'text-green-600 dark:text-green-400'
                            : row.type === 'expense'
                              ? 'text-red-600 dark:text-red-400'
                              : ''
                        )}
                      >
                        {centsToDisplay(row.amountCents)}
                      </span>
                    </div>

                    {/* Description */}
                    <div className="font-medium truncate mt-0.5">{row.description}</div>

                    {/* Badges row */}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {/* Category badge */}
                      {hasSuggestions && rowWithSuggestion.suggestedCategory && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{
                            backgroundColor: `${rowWithSuggestion.suggestedCategory.color}20`,
                            color: rowWithSuggestion.suggestedCategory.color,
                          }}
                        >
                          {rowWithSuggestion.suggestedCategory.name}
                        </span>
                      )}

                      {/* Type badge */}
                      {row.type && (
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-full whitespace-nowrap',
                            row.type === 'income'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          )}
                        >
                          {row.type === 'income' ? 'Income' : 'Expense'}
                        </span>
                      )}

                      {/* Refund candidate badge */}
                      {row.isRefundCandidate && (
                        <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                          {t('refundCandidate')}
                        </span>
                      )}

                      {/* Duplicate warning */}
                      {rowWithSuggestion.isDuplicate && (
                        <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                          {t('alreadyImported')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {displayRows.length > 100 && (
            <div className="px-4 py-2 text-center text-gray-500 text-xs">
              ... and {displayRows.length - 100} more rows
            </div>
          )}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="border border-red-200 dark:border-red-900 rounded-lg overflow-hidden">
          <div className="bg-red-50 dark:bg-red-950 px-4 py-2 border-b border-red-200 dark:border-red-900">
            <h3 className="text-sm font-medium text-red-900 dark:text-red-100">Errors</h3>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-sm">
              <tbody>
                {errors.slice(0, 20).map((error, idx) => (
                  <tr key={idx} className="border-t border-red-200 dark:border-red-900">
                    <td className="px-4 py-2 text-red-600 dark:text-red-400 whitespace-nowrap">Row {error.rowIndex}</td>
                    <td className="px-4 py-2 text-red-600 dark:text-red-400">{error.field}</td>
                    <td className="px-4 py-2 text-red-800 dark:text-red-200">
                      {error.messageKey ? tParsers(error.messageKey) : error.message}
                    </td>
                  </tr>
                ))}
                {errors.length > 20 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-center text-red-500 text-xs">
                      ... and {errors.length - 20} more errors
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {rows.length === 0 && errors.length === 0 && (
        <div className="text-center py-8 text-gray-500">No data found in file</div>
      )}
    </div>
  );
}
