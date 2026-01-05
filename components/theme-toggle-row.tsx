'use client';

import { useEffect, useState, useRef } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Sun03Icon, SunCloudLittleRain01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

type Theme = 'light' | 'dark' | 'system';

export function ThemeToggleRow() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('theme') as Theme | null) || 'system';
  });
  const mounted = useRef(false);
  const t = useTranslations('theme');

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

  return (
    <button
      onClick={cycleTheme}
      suppressHydrationWarning
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-md w-full',
        'text-foreground hover:bg-muted transition-colors'
      )}
    >
      <HugeiconsIcon icon={theme === 'light' ? Sun03Icon : SunCloudLittleRain01Icon} className="size-5" />
      <span>Theme: {t(theme)}</span>
    </button>
  );
}
