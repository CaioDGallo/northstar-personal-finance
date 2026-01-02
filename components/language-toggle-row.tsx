'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { setLocale } from '@/lib/i18n/actions';
import type { Locale } from '@/lib/i18n/config';

export function LanguageToggleRow() {
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
    <button
      onClick={toggleLanguage}
      disabled={isPending}
      suppressHydrationWarning
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-md w-full',
        'text-foreground hover:bg-muted transition-colors'
      )}
    >
      <span className="flex items-center justify-center w-5 h-5 text-xs font-bold">
        {badge}
      </span>
      <span>{t('label')}: {label}</span>
    </button>
  );
}
