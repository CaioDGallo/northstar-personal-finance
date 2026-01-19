'use client';

import { useEffect, useState, useRef } from 'react';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { HugeiconsIcon } from '@hugeicons/react';
import { Sun03Icon, SunCloudLittleRain01Icon } from '@hugeicons/core-free-icons';
import { useTranslations } from 'next-intl';

export type Theme = 'light' | 'dark' | 'system';

export function ThemeToggle() {
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
  }, [theme, mounted]);

  const cycleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'system' ? 'light' : prev === 'light' ? 'dark' : 'system';
      // Notify toaster of theme change
      window.dispatchEvent(new Event('theme-change'));
      return next;
    });
  };

  return (
    <SidebarMenuButton onClick={cycleTheme} suppressHydrationWarning>
      <HugeiconsIcon icon={theme == 'light' ? Sun03Icon : SunCloudLittleRain01Icon} />
      <span>{t(theme)}</span>
    </SidebarMenuButton>
  );
}
