'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { parserList, parsers, type ParserKey } from '@/lib/import/parsers';
import type { ParseResult } from '@/lib/import/types';
import type { Account, Category } from '@/lib/schema';
import { importExpenses, importMixed } from '@/lib/actions/import';
import { FileDropzone } from './file-dropzone';
import { ImportPreview } from './import-preview';

type Step = 'template' | 'upload' | 'configure';

type Props = {
  accounts: Account[];
  categories: Category[];
  trigger: React.ReactNode;
};

export function ImportModal({ accounts, categories, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<ParserKey | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [accountId, setAccountId] = useState(accounts[0]?.id?.toString() || '');
  const [categoryId, setCategoryId] = useState(categories[0]?.id?.toString() || '');
  const [isImporting, setIsImporting] = useState(false);

  const t = useTranslations('import');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

  const handleFileSelect = (content: string) => {
    if (!selectedTemplate) return;

    try {
      const parser = parsers[selectedTemplate];
      const result = parser.parse(content);
      setParseResult(result);
      setStep('configure');
    } catch (error) {
      console.error('Failed to parse CSV:', error);
      toast.error(tErrors('failedToParseCsv'));
    }
  };

  const handleImport = async () => {
    if (!parseResult || parseResult.rows.length === 0) return;

    setIsImporting(true);

    try {
      // Check if this is a mixed import parser (has both income and expense rows)
      const hasMixedTypes =
        parseResult.rows.some((r) => r.type === 'income') &&
        parseResult.rows.some((r) => r.type === 'expense');

      if (hasMixedTypes || selectedTemplate === 'nubank-extrato') {
        // Use importMixed for nubank-extrato or any parser with mixed types
        const result = await importMixed({
          rows: parseResult.rows,
          accountId: parseInt(accountId),
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
          rows: parseResult.rows,
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
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetState();
      }}
    >
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="right" className="w-screen! lg:max-w-3xl overflow-y-auto p-2">
        <SheetHeader>
          <SheetTitle>{t('title')}</SheetTitle>
        </SheetHeader>

        <div className="flex mt-2 space-y-4">
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
                    <h3 className="font-medium">{parser.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{parser.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Upload File */}
          {step === 'upload' && selectedTemplate && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <button onClick={() => setStep('template')} className="hover:underline">
                  {t('templates')}
                </button>
                <span>/</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{t('upload')}</span>
              </div>

              <div>
                <h3 className="font-medium mb-2">{t('uploadStep', { parser: parsers[selectedTemplate].name })}</h3>
                <FileDropzone onFileContent={handleFileSelect} />
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

              <ImportPreview parseResult={parseResult} />

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="account">{t('account')}</FieldLabel>
                  <Select value={accountId} onValueChange={setAccountId}>
                    <SelectTrigger id="account">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter((account) =>
                          selectedTemplate === 'nubank-extrato' ? account.type === 'checking' : true
                        )
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id.toString()}>
                            {account.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>

                {/* Only show category selector for non-mixed imports */}
                {selectedTemplate !== 'nubank-extrato' &&
                  !(
                    parseResult.rows.some((r) => r.type === 'income') &&
                    parseResult.rows.some((r) => r.type === 'expense')
                  ) && (
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
                  disabled={isImporting || parseResult.rows.length === 0}
                  className="flex-1"
                >
                  {isImporting ? tCommon('importing') : t('importExpenses', { count: parseResult.rows.length })}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
