'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { SidebarMenuButton } from '@/components/ui/sidebar';
import { setLocale } from '@/lib/i18n/actions';
import type { Locale } from '@/lib/i18n/config';

export function LanguageToggleSidebar() {
  const locale = useLocale() as Locale;
  const t = useTranslations('language');
  const [isPending, startTransition] = useTransition();

  const toggleLanguage = () => {
    const nextLocale: Locale = locale === 'pt-BR' ? 'en' : 'pt-BR';
    startTransition(async () => {
      await setLocale(nextLocale);
    });
  };

  const label = locale === 'pt-BR' ? t('portuguese') : t('english');
  const badge = locale === 'pt-BR' ? 'PT' : 'EN';

  return (
    <SidebarMenuButton onClick={toggleLanguage} disabled={isPending} suppressHydrationWarning>
      <span className="flex items-center justify-center w-5 h-5 text-xs font-bold">
        {badge}
      </span>
      <span>{label}</span>
    </SidebarMenuButton>
  );
}
