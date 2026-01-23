'use client';

import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  ArrowUp01Icon,
  ArrowLeftRightIcon,
  CreditCardIcon,
  Invoice03Icon,
  SparklesIcon,
  Wallet01Icon,
  Calendar03Icon,
  Notification02Icon,
  Settings02Icon,
  FileDownloadIcon,
  Message01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoutButton } from './logout-button';
import { FeedbackSheet } from './feedback-sheet';

const moreItems = [
  { key: 'calendar', href: '/calendar', icon: Calendar03Icon },
  { key: 'reminders', href: '/reminders', icon: Notification02Icon },
  { key: 'faturas', href: '/faturas', icon: CreditCardIcon },
  { key: 'income', href: '/income', icon: ArrowUp01Icon },
  { key: 'transfers', href: '/transfers', icon: ArrowLeftRightIcon },
  { key: 'accounts', href: '/settings/accounts', icon: Wallet01Icon },
  { key: 'categories', href: '/settings/categories', icon: SparklesIcon },
  { key: 'budgets', href: '/settings/budgets', icon: Invoice03Icon },
  { key: 'calendars', href: '/settings/calendars', icon: Calendar03Icon },
  { key: 'preferences', href: '/settings/preferences', icon: Notification02Icon },
  { key: 'export', href: '/settings/export', icon: FileDownloadIcon },
  { key: 'settings', href: '/settings/data', icon: Settings02Icon },
];

type MoreSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MoreSheet({
  open,
  onOpenChange,
}: MoreSheetProps) {
  const t = useTranslations('navigation');
  const tFeedback = useTranslations('feedback');
  const pathname = usePathname();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const handleFeedbackClick = () => {
    onOpenChange(false); // Close More sheet
    setFeedbackOpen(true); // Open Feedback sheet
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(
            'pb-[env(safe-area-inset-bottom)]',
            'backdrop-blur-xl bg-background/95',
            'max-h-[80vh] flex flex-col'
          )}
        >
          <SheetHeader className="shrink-0">
            <SheetTitle>{t('more')}</SheetTitle>
          </SheetHeader>

          <nav className="flex flex-col gap-1 py-4 overflow-y-auto flex-1 min-h-0">
            {moreItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-md shrink-0',
                  'text-foreground hover:bg-muted transition-colors',
                  pathname === item.href && 'bg-muted font-medium'
                )}
              >
                <HugeiconsIcon icon={item.icon} className="size-5" />
                <span>{t(item.key)}</span>
              </Link>
            ))}
          </nav>

          {/* Feedback and Logout at bottom */}
          <div className="border-t pt-4 pb-3 mt-2 shrink-0 flex flex-col gap-2">
            <button
              onClick={handleFeedbackClick}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-md',
                'text-foreground hover:bg-muted transition-colors'
              )}
            >
              <HugeiconsIcon icon={Message01Icon} className="size-5" />
              <span>{tFeedback('button')}</span>
            </button>
            <LogoutButton variant="mobile" />
          </div>
        </SheetContent>
      </Sheet>

      <FeedbackSheet open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
