'use client';

import { useEffect, useState, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Sun03Icon, Moon02Icon, SunCloudLittleRain01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { Button } from './ui/button';

type Theme = 'light' | 'dark' | 'system';

type ThemeToggleRowProps = {
  className?: string;
  showLabel?: boolean;
  iconOnly?: boolean;
  asButton?: boolean;
  labelClassName?: string;
};

export function ThemeToggleRow({
  className,
  showLabel = true,
  iconOnly = false,
  asButton = false,
  labelClassName,
}: ThemeToggleRowProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('theme') as Theme | null) || 'system';
  });
  const mounted = useRef(false);
  const t = useTranslations('theme');
  const label = t('label');

  useEffect(() => {
    mounted.current = true;
  }, []);

  useEffect(() => {
    if (!mounted.current) return;

    const root = document.documentElement;
    const applyTheme = () => {
      if (theme === 'dark') {
        root.classList.add('dark');
      } else if (theme === 'light') {
        root.classList.remove('dark');
      } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme();
    localStorage.setItem('theme', theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [theme]);

  const cycleTheme = () => {
    setTheme((prev) => {
      if (prev === 'system') return 'light';
      if (prev === 'light') return 'dark';
      return 'system';
    });
  };

  return (asButton ?
    <Button
      onClick={cycleTheme}
      suppressHydrationWarning
      variant={'hollow'}
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-none w-full',
        'text-foreground hover:bg-muted transition-colors',
        className
      )}
    >
      <HugeiconsIcon icon={theme === 'light' ? Sun03Icon : Moon02Icon} className="size-5" />
      {!iconOnly && (
        <span className={cn('text-xs font-semibold uppercase tracking-[0.2em]', labelClassName)}>
          {showLabel ? `${label}: ${t(theme)}` : t(theme)}
        </span>
      )}
    </Button>
    :
    (
      <button
        onClick={cycleTheme}
        suppressHydrationWarning
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-md w-full',
          'text-foreground hover:bg-muted transition-colors',
          className
        )}
      >
        <HugeiconsIcon icon={theme === 'light' ? Sun03Icon : SunCloudLittleRain01Icon} className="size-5" />
        <span className={cn(labelClassName)}>
          {showLabel ? `${label}: ${t(theme)}` : t(theme)}
        </span >
      </button>
    )
  );
}
