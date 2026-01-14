'use client';

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
  Tick02Icon,
  Wallet01Icon,
  Calendar03Icon,
  Notification02Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ThemeToggleRow } from './theme-toggle-row';
import { LanguageToggleRow } from './language-toggle-row';

const moreItems = [
  { key: 'reminders', href: '/reminders', icon: Notification02Icon },
  { key: 'tasks', href: '/tasks', icon: Tick02Icon },
  { key: 'faturas', href: '/faturas', icon: CreditCardIcon },
  { key: 'income', href: '/income', icon: ArrowUp01Icon },
  { key: 'transfers', href: '/transfers', icon: ArrowLeftRightIcon },
  { key: 'accounts', href: '/settings/accounts', icon: Wallet01Icon },
  { key: 'categories', href: '/settings/categories', icon: SparklesIcon },
  { key: 'budgets', href: '/settings/budgets', icon: Invoice03Icon },
  { key: 'calendars', href: '/settings/calendars', icon: Calendar03Icon },
  { key: 'preferences', href: '/settings/preferences', icon: Notification02Icon },
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
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          'pb-[env(safe-area-inset-bottom)]',
          'backdrop-blur-xl bg-background/95'
        )}
      >
        <SheetHeader>
          <SheetTitle>{t('more')}</SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 py-4">
          {moreItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onOpenChange(false)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-md',
                'text-foreground hover:bg-muted transition-colors',
                pathname === item.href && 'bg-muted font-medium'
              )}
            >
              <HugeiconsIcon icon={item.icon} className="size-5" />
              <span>{t(item.key)}</span>
            </Link>
          ))}
        </nav>

        {/* Theme toggle at bottom */}
        <div className="border-t pt-4 pb-3 mt-2">
          <ThemeToggleRow />
          <LanguageToggleRow />
        </div>
      </SheetContent>
    </Sheet>
  );
}
