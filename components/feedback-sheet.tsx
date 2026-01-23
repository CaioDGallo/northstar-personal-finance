'use client';

import { useTranslations } from 'next-intl';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { FeedbackForm } from '@/components/feedback-form';

interface FeedbackSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedbackSheet({ open, onOpenChange }: FeedbackSheetProps) {
  const t = useTranslations('feedback');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] flex flex-col pb-[env(safe-area-inset-bottom)]">
        <SheetHeader className="pb-0">
          <SheetTitle>{t('title')}</SheetTitle>
          <SheetDescription className="sr-only">
            {t('messagePlaceholder')}
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <FeedbackForm onSuccess={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
