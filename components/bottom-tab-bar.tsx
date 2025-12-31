'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Home01Icon,
  Invoice03Icon,
  Wallet01Icon,
  MoreHorizontalIcon,
  Add01Icon,
  Remove02Icon,
  ArrowUp01Icon,
} from '@hugeicons/core-free-icons';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TransactionForm } from '@/components/transaction-form';
import { cn } from '@/lib/utils';
import { MoreSheet } from './more-sheet';
import type { Account, Category } from '@/lib/schema';
import { Button } from './ui/button';

type BottomTabBarProps = {
  accounts: Account[];
  expenseCategories: Category[];
  incomeCategories: Category[];
};

type TabItem = {
  title: string;
  href: string | null;
  icon: typeof Home01Icon;
};

const tabs: TabItem[] = [
  { title: 'Dashboard', href: '/dashboard', icon: Home01Icon },
  { title: 'Budgets', href: '/budgets', icon: Invoice03Icon },
  { title: 'Expenses', href: '/expenses', icon: Wallet01Icon },
  { title: 'More', href: null, icon: MoreHorizontalIcon },
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

type CenterFABProps = {
  onExpense: () => void;
  onIncome: () => void;
};

function CenterFAB({ onExpense, onIncome }: CenterFABProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={'popout'}
          className={cn(
            'relative -top-4', // raised above tab bar
            'flex items-center justify-center',
            'size-14',
            'bg-primary text-primary-foreground',
            'shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]', // popout style
            'border-2 border-black',
            'active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
            'transition-all'
          )}
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" sideOffset={8}>
        <DropdownMenuItem onSelect={onExpense}>
          <HugeiconsIcon icon={Remove02Icon} strokeWidth={2} />
          Add Expense
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onIncome}>
          <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} />
          Add Income
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function BottomTabBar({
  accounts,
  expenseCategories,
  incomeCategories,
}: BottomTabBarProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(false);

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
        <div className="flex items-end justify-around h-16 px-2">
          {/* Dashboard tab */}
          <TabButton {...tabs[0]} active={isActive(tabs[0].href)} />

          {/* Budgets tab */}
          <TabButton {...tabs[1]} active={isActive(tabs[1].href)} />

          {/* Center FAB */}
          <CenterFAB
            onExpense={() => setExpenseOpen(true)}
            onIncome={() => setIncomeOpen(true)}
          />

          {/* Expenses tab */}
          <TabButton {...tabs[2]} active={isActive(tabs[2].href)} />

          {/* More tab */}
          <TabButton
            {...tabs[3]}
            active={isMoreActive}
            onClick={() => setMoreOpen(true)}
          />
        </div>
      </nav>

      <MoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        accounts={accounts}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
      />

      <TransactionForm
        mode="expense"
        accounts={accounts}
        categories={expenseCategories}
        open={expenseOpen}
        onOpenChange={setExpenseOpen}
      />

      <TransactionForm
        mode="income"
        accounts={accounts}
        categories={incomeCategories}
        open={incomeOpen}
        onOpenChange={setIncomeOpen}
      />
    </>
  );
}
