'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HugeiconsIcon } from '@hugeicons/react';
import { Upload02Icon } from '@hugeicons/core-free-icons';
import { parserList, parsers, type ParserKey } from '@/lib/import/parsers';
import type { ParseResult, ImportRowWithSuggestion } from '@/lib/import/types';
import type { Account, Category } from '@/lib/schema';
import { importExpenses, importMixed, getCategorySuggestions, checkDuplicates } from '@/lib/actions/import';
import { FileDropzone } from './file-dropzone';
import { ImportPreview } from './import-preview';

type Step = 'template' | 'upload' | 'configure';

type Props = {
  accounts: Account[];
  categories: Category[];
};

export function ImportModal({ accounts, categories }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<ParserKey | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [rowsWithSuggestions, setRowsWithSuggestions] = useState<ImportRowWithSuggestion[]>([]);
  const [accountId, setAccountId] = useState(accounts[0]?.id?.toString() || '');
  const [categoryId, setCategoryId] = useState(categories[0]?.id?.toString() || '');
  const [isImporting, setIsImporting] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const t = useTranslations('import');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tParsers = useTranslations('parsers');

  // Determine accepted file extension based on parser type
  const getAcceptedFileType = (template: ParserKey | null): string => {
    if (!template) return '.csv,.ofx';
    return template.endsWith('-ofx') ? '.ofx' : '.csv';
  };

  const handleFileSelect = async (content: string) => {
    if (!selectedTemplate) return;

    try {
      const parser = parsers[selectedTemplate];
      const result = parser.parse(content);
      setParseResult(result);

      if (result.rows.length > 0) {
        const expenseDescriptions = result.rows.filter((r) => r.type === 'expense').map((r) => r.description);
        const incomeDescriptions = result.rows.filter((r) => r.type === 'income').map((r) => r.description);
        const externalIds = result.rows.map((r) => r.externalId).filter((id): id is string => !!id);

        const [suggestions, duplicateIds] = await Promise.all([
          getCategorySuggestions({ expenseDescriptions, incomeDescriptions }),
          externalIds.length > 0 ? checkDuplicates(externalIds).catch((error) => {
            console.error('Failed to check duplicates:', error);
            return [];
          }) : Promise.resolve<string[]>([]),
        ]);
        const duplicateSet = new Set(duplicateIds);

        const enrichedRows = result.rows.map((row) => {
          const isDuplicate = !!row.externalId && duplicateSet.has(row.externalId);
          if (row.type === 'expense') {
            return { ...row, suggestedCategory: suggestions.expense[row.description], isDuplicate };
          }
          if (row.type === 'income') {
            return { ...row, suggestedCategory: suggestions.income[row.description], isDuplicate };
          }
          return { ...row, isDuplicate };
        });

        setRowsWithSuggestions(enrichedRows);
        setSelectedRows(new Set(enrichedRows.filter((row) => !row.isDuplicate).map((row) => row.rowIndex)));
      } else {
        setRowsWithSuggestions([]);
        setSelectedRows(new Set());
      }

      setStep('configure');
    } catch (error) {
      console.error('Failed to parse CSV:', error);
      toast.error(tErrors('failedToParseCsv'));
    }
  };

  const handleImport = async () => {
    if (!parseResult || parseResult.rows.length === 0 || selectedRows.size === 0) return;

    setIsImporting(true);

    try {
      // Filter rows by selected indices
      const rowsToImport = parseResult.rows.filter((r) => selectedRows.has(r.rowIndex));

      // Use importMixed if any row has type info (parsers that distinguish income/expense)
      const hasTypeInfo = rowsToImport.some((r) => r.type !== undefined);

      if (hasTypeInfo) {
        const categoryOverrides: Record<number, number> = {};
        for (const row of rowsWithSuggestions) {
          if (row.suggestedCategory && selectedRows.has(row.rowIndex)) {
            categoryOverrides[row.rowIndex] = row.suggestedCategory.id;
          }
        }

        const result = await importMixed({
          rows: rowsToImport,
          accountId: parseInt(accountId),
          categoryOverrides,
        });

        if (result.success) {
          if (result.skippedDuplicates > 0) {
            toast.success(
              `${t('successMixed', {
                expenses: result.importedExpenses,
                income: result.importedIncome,
              })}. ${t('skippedDuplicates', { count: result.skippedDuplicates })}`
            );
          } else {
            toast.success(
              t('successMixed', {
                expenses: result.importedExpenses,
                income: result.importedIncome,
              })
            );
          }
          setOpen(false);
          resetState();
        } else {
          toast.error(result.error);
        }
      } else {
        // Use importExpenses for single-type imports
        const result = await importExpenses({
          rows: rowsToImport,
          accountId: parseInt(accountId),
          categoryId: parseInt(categoryId),
        });

        if (result.success) {
          toast.success(t('successMessage', { count: result.imported }));
          setOpen(false);
          resetState();
        } else {
          toast.error(result.error);
        }
      }
    } catch (error) {
      console.error('Failed to import:', error);
      toast.error(t('errorMessage'));
    } finally {
      setIsImporting(false);
    }
  };

  const resetState = () => {
    setStep('template');
    setSelectedTemplate(null);
    setParseResult(null);
    setSelectedRows(new Set());
  };

  const handleToggleRow = (rowIndex: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
      } else {
        next.add(rowIndex);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (parseResult) {
      setSelectedRows(new Set(parseResult.rows.map((r) => r.rowIndex)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedRows(new Set());
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetState();
      }}
    >
      <SheetTrigger asChild>
        <Button variant="hollow" size="sm">
          <HugeiconsIcon icon={Upload02Icon} className="mr-2 size-4" />
          {t('title')}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-screen! md:max-w-3xl! overflow-y-auto p-2">
        <SheetHeader>
          <SheetTitle>{t('title')}</SheetTitle>
        </SheetHeader>

        <div className="flex mt-2 mb-6 space-y-4">
          {/* Step 1: Select Template */}
          {step === 'template' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('selectFormat')}</p>
              <div className="space-y-2">
                {parserList.map((parser) => (
                  <button
                    key={parser.id}
                    onClick={() => {
                      setSelectedTemplate(parser.id as ParserKey);
                      setStep('upload');
                    }}
                    className="w-full text-left p-4 border dark:border-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition"
                  >
                    <h3 className="font-medium">{parser.nameKey ? tParsers(parser.nameKey) : parser.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {parser.descriptionKey ? tParsers(parser.descriptionKey) : parser.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Upload File */}
          {step === 'upload' && selectedTemplate && (
            <div className="space-y-4 w-full">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <button onClick={() => setStep('template')} className="hover:underline">
                  {t('templates')}
                </button>
                <span>/</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{t('upload')}</span>
              </div>

              <div>
                <h3 className="font-medium mb-2">
                  {t('filters.uploadStep', {
                    parser: parsers[selectedTemplate].nameKey
                      ? tParsers(parsers[selectedTemplate].nameKey!)
                      : parsers[selectedTemplate].name,
                  })}
                </h3>
                <FileDropzone onFileContent={handleFileSelect} accept={getAcceptedFileType(selectedTemplate)} />
              </div>

              <Button variant="outline" onClick={() => setStep('template')} className="w-full">
                {t('back')}
              </Button>
            </div>
          )}

          {/* Step 3: Configure & Import */}
          {step === 'configure' && parseResult && (
            <div className="space-y-4 w-full">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <button onClick={() => setStep('template')} className="hover:underline">
                  {t('templates')}
                </button>
                <span>/</span>
                <button onClick={() => setStep('upload')} className="hover:underline">
                  {t('upload')}
                </button>
                <span>/</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{t('configure')}</span>
              </div>

              <ImportPreview
                parseResult={parseResult}
                rowsWithSuggestions={rowsWithSuggestions}
                selectedRows={selectedRows}
                onToggleRow={handleToggleRow}
                onSelectAll={handleSelectAll}
                onDeselectAll={handleDeselectAll}
              />

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="account">{t('account')}</FieldLabel>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger id="account">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id.toString()}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* Only show category selector when rows don't have type info */}
                {!parseResult.rows.some((r) => r.type !== undefined) && (
                  <Field>
                    <FieldLabel htmlFor="category">{t('category')}</FieldLabel>
                    <Select value={categoryId} onValueChange={setCategoryId}>
                      <SelectTrigger id="category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </FieldGroup>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('upload')} className="flex-1">
                  {t('back')}
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={isImporting || selectedRows.size === 0}
                  className="flex-1"
                >
                  {isImporting ? tCommon('importing') : t('importExpenses', { count: selectedRows.size })}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
