'use client';

import { useTransition } from 'react';
import { setLocale } from '@/lib/i18n/actions';
import type { Locale } from '@/lib/i18n/config';
import { Button } from '@/components/ui/button';

interface LanguageToggleProps {
  currentLocale: string;
}

export function LanguageToggle({ currentLocale }: LanguageToggleProps) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (locale: Locale) => {
    startTransition(async () => {
      await setLocale(locale);
    });
  };

  return (
    <div className="flex gap-2 mt-2">
      <Button
        variant={currentLocale === 'pt-BR' ? 'default' : 'outline'}
        onClick={() => handleChange('pt-BR')}
        disabled={isPending}
        size="sm"
      >
        Português
      </Button>
      <Button
        variant={currentLocale === 'en' ? 'default' : 'outline'}
        onClick={() => handleChange('en')}
        disabled={isPending}
        size="sm"
      >
        English
      </Button>
    </div>
  );
}
