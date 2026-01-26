'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { copyBudgetsFromMonth } from '@/lib/actions/budgets';
import { addMonths } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Loading03Icon } from '@hugeicons/core-free-icons';

type CopyBudgetsButtonProps = {
  currentMonth: string;
};

export function CopyBudgetsButton({ currentMonth }: CopyBudgetsButtonProps) {
  const t = useTranslations('budgets');
  const tCommon = useTranslations('common');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCopy() {
    setIsLoading(true);
    setMessage(null);

    try {
      const previousMonth = addMonths(currentMonth, -1);
      const result = await copyBudgetsFromMonth(previousMonth, currentMonth);

      if (result.total === 0) {
        setMessage(
          result.monthlyBudgetCopied
            ? t('copiedMonthlyBudgetOnly')
            : t('noBudgetsToCopy')
        );
      } else if (result.copied === 0) {
        setMessage(
          result.monthlyBudgetCopied
            ? t('copiedMonthlyBudgetAllExist', { total: result.total })
            : t('allBudgetsExist', { total: result.total })
        );
      } else if (result.skipped === 0) {
        setMessage(
          result.monthlyBudgetCopied
            ? t('copiedWithMonthlyBudget', { copied: result.copied })
            : t('copiedBudgets', { copied: result.copied })
        );
      } else {
        setMessage(
          result.monthlyBudgetCopied
            ? t('copiedWithMonthlyBudgetPartial', {
                copied: result.copied,
                skipped: result.skipped,
              })
            : t('copiedBudgetsPartial', {
                copied: result.copied,
                skipped: result.skipped,
              })
        );
      }
    } catch (error) {
      setMessage(t('failedToCopy'));
      console.error('Copy budgets error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleCopy} disabled={isLoading} variant="hollow">
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" aria-hidden="true" />
            {tCommon('copying')}
          </span>
        ) : (
          t('copyFromPreviousMonth')
        )}
      </Button>
      {message && (
        <span className="text-sm text-neutral-600" role="status" aria-live="polite">
          {message}
        </span>
      )}
    </div>
  );
}
