'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { backfillFaturaTransfers } from '@/lib/actions/transfers';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

type BackfillTransfersButtonProps = {
  className?: string;
};

export function BackfillTransfersButton({ className }: BackfillTransfersButtonProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const t = useTranslations('transfers');
  const tCommon = useTranslations('common');

  const handleBackfill = async () => {
    setIsRunning(true);
    setError(null);

    try {
      const result = await backfillFaturaTransfers();
      if ('error' in result) {
        setError(result.error);
        toast.error(result.error);
        return;
      }

      toast.success(t('backfillSuccess', { count: result.created }));
      setOpen(false);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          {t('backfillButton')}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('backfillTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('backfillDescription')}</AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRunning}>{tCommon('cancel')}</AlertDialogCancel>
          <Button onClick={handleBackfill} disabled={isRunning}>
            {isRunning ? tCommon('loading') : t('backfillConfirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
