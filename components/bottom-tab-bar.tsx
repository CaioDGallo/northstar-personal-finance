'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Home01Icon,
  Invoice03Icon,
  Wallet01Icon,
  CreditCardIcon,
  MoreHorizontalIcon,
} from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { MoreSheet } from './more-sheet';

type TabItem = {
  key: string;
  href: string | null;
  icon: typeof Home01Icon;
};

const tabs: TabItem[] = [
  { key: 'dashboard', href: '/dashboard', icon: Home01Icon },
  { key: 'budgets', href: '/budgets', icon: Invoice03Icon },
  { key: 'expenses', href: '/expenses', icon: Wallet01Icon },
  { key: 'faturas', href: '/faturas', icon: CreditCardIcon },
  { key: 'more', href: null, icon: MoreHorizontalIcon },
];

type TabButtonProps = {
  title: string;
  href: string | null;
  icon: typeof Home01Icon;
  active?: boolean;
  onClick?: () => void;
};

function TabButton({ title, href, icon, active, onClick }: TabButtonProps) {
  const content = (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 p-2 min-w-[64px] relative',
        'text-muted-foreground transition-colors',
        active && 'text-foreground'
      )}
    >
      {active && (
        <div className="absolute top-0 h-0.5 w-8 bg-primary rounded-full" />
      )}
      <HugeiconsIcon icon={icon} strokeWidth={active ? 2.5 : 2} className="size-5" />
      <span className="text-[10px] font-medium">{title}</span>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="relative">
        {content}
      </button>
    );
  }

  return (
    <Link href={href!} prefetch={true} className="relative">
      {content}
    </Link>
  );
}

export function BottomTabBar() {
  const t = useTranslations('navigation');
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string | null) => href ? pathname === href : false;
  const isMoreActive =
    pathname.startsWith('/income') || pathname.startsWith('/settings');

  return (
    <>
      <nav
        className={cn(
          'fixed bottom-0 inset-x-0 z-50 md:hidden',
          'backdrop-blur-xl bg-background/80 border-t border-border',
          'pb-[env(safe-area-inset-bottom)]'
        )}
      >
        <div className="flex items-center justify-around h-16 px-2">
          {tabs.map((tab) => {
            if (tab.key === 'more') {
              return (
                <TabButton
                  key={tab.key}
                  title={t(tab.key)}
                  href={tab.href}
                  icon={tab.icon}
                  active={isMoreActive}
                  onClick={() => setMoreOpen(true)}
                />
              );
            }
            return (
              <TabButton
                key={tab.key}
                title={t(tab.key)}
                href={tab.href}
                icon={tab.icon}
                active={isActive(tab.href)}
              />
            );
          })}
        </div>
      </nav>

      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
