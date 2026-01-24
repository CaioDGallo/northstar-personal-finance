'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTransactionsForExport, getTransfersForExport, trackDataExport, type TimeRange } from '@/lib/actions/export';
import { generateTransactionsCsv, generateTransfersCsv, downloadCsv } from '@/lib/csv-generator';
import { getCurrentYearMonth } from '@/lib/utils';

type ExportType = 'transactions' | 'transfers';

export function ExportForm() {
  const t = useTranslations('export');
  const locale = useLocale();
  const [exportType, setExportType] = useState<ExportType>('transactions');
  const [timeRange, setTimeRange] = useState<TimeRange>('month');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentYearMonth());
  const [includeExpenses, setIncludeExpenses] = useState(true);
  const [includeIncome, setIncludeIncome] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);

    try {
      if (exportType === 'transactions') {
        // Fetch transactions
        const data = await getTransactionsForExport(
          timeRange,
          timeRange !== 'all' ? selectedMonth : undefined,
          includeExpenses,
          includeIncome
        );

        if (data.length === 0) {
          setError(t('noDataDescription'));
          setIsExporting(false);
          return;
        }

        // Generate CSV
        const csv = generateTransactionsCsv(data);

        // Download
        const filename = `transacoes_${timeRange === 'all' ? 'todas' : selectedMonth}.csv`;
        downloadCsv(csv, filename);

        // Track export analytics
        await trackDataExport({
          timeRange,
          includeExpenses,
          includeIncome,
          includeTransfers: false,
          recordCount: data.length,
        });
      } else {
        // Fetch transfers
        const data = await getTransfersForExport(
          timeRange,
          timeRange !== 'all' ? selectedMonth : undefined
        );

        if (data.length === 0) {
          setError(t('noDataDescription'));
          setIsExporting(false);
          return;
        }

        // Generate CSV
        const csv = generateTransfersCsv(data);

        // Download
        const filename = `transferencias_${timeRange === 'all' ? 'todas' : selectedMonth}.csv`;
        downloadCsv(csv, filename);

        // Track export analytics
        await trackDataExport({
          timeRange,
          includeExpenses: false,
          includeIncome: false,
          includeTransfers: true,
          recordCount: data.length,
        });
      }
    } catch (err) {
      console.error('Export error:', err);
      setError('Falha ao exportar. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  // Generate month options (last 12 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const label = date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
    return { value: yearMonth, label };
  });

  // Generate year options (last 5 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => {
    const year = currentYear - i;
    return { value: `${year}-01`, label: String(year) };
  });

  return (
    <FieldGroup className="max-w-2xl">
      {/* Export Type */}
      <Field>
        <FieldLabel>{t('exportType')}</FieldLabel>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="exportType"
              value="transactions"
              checked={exportType === 'transactions'}
              onChange={(e) => setExportType(e.target.value as ExportType)}
              className="w-4 h-4 text-blue-600"
            />
            <span>{t('transactions')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="exportType"
              value="transfers"
              checked={exportType === 'transfers'}
              onChange={(e) => setExportType(e.target.value as ExportType)}
              className="w-4 h-4 text-blue-600"
            />
            <span>{t('transfers')}</span>
          </label>
        </div>
      </Field>

      {/* Time Range */}
      <Field>
        <FieldLabel>{t('timeRange')}</FieldLabel>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="timeRange"
              value="month"
              checked={timeRange === 'month'}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="w-4 h-4 text-blue-600"
            />
            <span>{t('month')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="timeRange"
              value="year"
              checked={timeRange === 'year'}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="w-4 h-4 text-blue-600"
            />
            <span>{t('year')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="timeRange"
              value="all"
              checked={timeRange === 'all'}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="w-4 h-4 text-blue-600"
            />
            <span>{t('allTime')}</span>
          </label>
        </div>
      </Field>

      {/* Month/Year Selector */}
      {timeRange === 'month' && (
        <Field>
          <FieldLabel>{t('selectMonth')}</FieldLabel>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {timeRange === 'year' && (
        <Field>
          <FieldLabel>{t('selectMonth')}</FieldLabel>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}

      {/* Include Options (only for transactions) */}
      {exportType === 'transactions' && (
        <Field>
          <FieldLabel>Incluir</FieldLabel>
          <div className="space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={includeExpenses}
                onCheckedChange={(checked) => setIncludeExpenses(checked === true)}
              />
              <span>{t('includeExpenses')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={includeIncome}
                onCheckedChange={(checked) => setIncludeIncome(checked === true)}
              />
              <span>{t('includeIncome')}</span>
            </label>
          </div>
        </Field>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Format Info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-800">{t('formatInfo')}</p>
      </div>

      {/* Export Button */}
      <Button
        onClick={handleExport}
        disabled={isExporting || (exportType === 'transactions' && !includeExpenses && !includeIncome)}
        className="w-full"
      >
        {isExporting ? t('exporting') : t('exportButton')}
      </Button>
    </FieldGroup>
  );
}
