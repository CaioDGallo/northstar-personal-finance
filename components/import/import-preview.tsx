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
};

export function ImportPreview({ parseResult, rowsWithSuggestions, selectedRows, onToggleRow, onSelectAll, onDeselectAll }: Props) {
  const { rows, errors, skipped } = parseResult;
  const tParsers = useTranslations('parsers');
  const t = useTranslations('import');

  const displayRows = rowsWithSuggestions && rowsWithSuggestions.length > 0 ? rowsWithSuggestions : rows;
  const hasSuggestions = rowsWithSuggestions && rowsWithSuggestions.length > 0;

  const expenseCount = displayRows.filter((r) => r.type === 'expense' && 'suggestedCategory' in r && r.suggestedCategory).length;
  const incomeCount = displayRows.filter((r) => r.type === 'income' && 'suggestedCategory' in r && r.suggestedCategory).length;

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

      {/* Preview Table */}
      {displayRows.length > 0 && (
        <div className="border dark:border-gray-800 rounded-lg overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                <tr>
                  <th className="px-4 py-2 w-12"></th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Description</th>
                  {hasSuggestions && (
                    <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Category</th>
                  )}
                  <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.slice(0, 100).map((row) => {
                  const rowWithSuggestion = row as ImportRowWithSuggestion;
                  const isSelected = selectedRows.has(row.rowIndex);
                  return (
                    <tr key={row.rowIndex} className="border-t dark:border-gray-800">
                      <td className="px-4 py-2">
                        <button
                          onClick={() => onToggleRow(row.rowIndex)}
                          className="flex items-center justify-center"
                        >
                          <div
                            className={cn(
                              'size-6 rounded-full border-2 flex items-center justify-center transition-all',
                              isSelected
                                ? 'bg-primary/85 border-green-600'
                                : 'bg-gray-100/70 dark:bg-gray-800/70 border-gray-400 dark:border-gray-600'
                            )}
                          >
                            {isSelected && (
                              <HugeiconsIcon icon={Tick02Icon} className="size-3 text-green-600" strokeWidth={4} />
                            )}
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {formatDate(row.date)}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span>{row.description}</span>
                          {row.type && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                                row.type === 'income'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                  : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                              }`}
                            >
                              {row.type === 'income' ? 'Income' : 'Expense'}
                            </span>
                          )}
                        </div>
                      </td>
                      {hasSuggestions && (
                        <td className="px-4 py-2">
                          {rowWithSuggestion.suggestedCategory ? (
                            <div className="flex items-center gap-2">
                              <span
                                className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                                style={{
                                  backgroundColor: `${rowWithSuggestion.suggestedCategory.color}20`,
                                  color: rowWithSuggestion.suggestedCategory.color,
                                }}
                              >
                                {rowWithSuggestion.suggestedCategory.name}
                              </span>
                            </div>
                          ) : row.type ? (
                            <span className="text-xs text-gray-500">
                              Default ({row.type === 'income' ? 'Income' : 'Expense'})
                            </span>
                          ) : null}
                        </td>
                      )}
                      <td
                        className={`px-4 py-2 text-right font-medium ${
                          row.type === 'income'
                            ? 'text-green-600 dark:text-green-400'
                            : row.type === 'expense'
                              ? 'text-red-600 dark:text-red-400'
                              : ''
                        }`}
                      >
                        {centsToDisplay(row.amountCents)}
                      </td>
                    </tr>
                  );
                })}
                {displayRows.length > 100 && (
                  <tr>
                    <td colSpan={hasSuggestions ? 5 : 4} className="px-4 py-2 text-center text-gray-500 text-xs">
                      ... and {displayRows.length - 100} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
