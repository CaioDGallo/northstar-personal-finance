'use client';

import { useState } from 'react';
import { copyBudgetsFromMonth } from '@/lib/actions/budgets';
import { addMonths } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type CopyBudgetsButtonProps = {
  currentMonth: string;
};

export function CopyBudgetsButton({ currentMonth }: CopyBudgetsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCopy() {
    setIsLoading(true);
    setMessage(null);

    try {
      const previousMonth = addMonths(currentMonth, -1);
      const result = await copyBudgetsFromMonth(previousMonth, currentMonth);

      if (result.total === 0) {
        setMessage('No budgets to copy from previous month');
      } else if (result.copied === 0) {
        setMessage(`All ${result.total} budgets already exist`);
      } else if (result.skipped === 0) {
        setMessage(`Copied ${result.copied} budgets`);
      } else {
        setMessage(`Copied ${result.copied} budgets (${result.skipped} already existed)`);
      }
    } catch (error) {
      setMessage('Failed to copy budgets. Please try again.');
      console.error('Copy budgets error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleCopy} disabled={isLoading} variant="outline">
        {isLoading ? 'Copying...' : 'Copy from previous month'}
      </Button>
      {message && <span className="text-sm text-neutral-600">{message}</span>}
    </div>
  );
}
