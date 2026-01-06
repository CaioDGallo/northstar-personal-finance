import type { ParseResult } from '@/lib/import/types';
import { centsToDisplay, formatDate } from '@/lib/utils';

type Props = {
  parseResult: ParseResult;
};

export function ImportPreview({ parseResult }: Props) {
  const { rows, errors, skipped } = parseResult;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400">Valid rows</span>
          <span className="font-medium text-green-600 dark:text-green-400">{rows.length}</span>
        </div>
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
      </div>

      {/* Preview Table */}
      {rows.length > 0 && (
        <div className="border dark:border-gray-800 rounded-lg overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-400">Description</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-600 dark:text-gray-400">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 100).map((row) => (
                  <tr key={row.rowIndex} className="border-t dark:border-gray-800">
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
                ))}
                {rows.length > 100 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-2 text-center text-gray-500 text-xs">
                      ... and {rows.length - 100} more rows
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
                    <td className="px-4 py-2 text-red-800 dark:text-red-200">{error.message}</td>
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
