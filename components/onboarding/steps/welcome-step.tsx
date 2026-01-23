'use client';

import { WizardStep } from '../wizard-step';
import { Button } from '@/components/ui/button';
import { TypingText } from '@/components/typing-text';
import { useOnboarding } from '../onboarding-provider';
import { useTranslations } from 'next-intl';

export function WelcomeStep() {
  const t = useTranslations('onboarding.welcome');
  const { nextStep } = useOnboarding();

  return (
    <WizardStep className="space-y-6">
      <div className="space-y-4">
        <TypingText
          text={t('title')}
          className="text-2xl font-bold"
          speed={50}
        />
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium">{t('features.title')}</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• {t('features.expenses')}</li>
          <li>• {t('features.budgets')}</li>
          <li>• {t('features.invoices')}</li>
          <li>• {t('features.insights')}</li>
        </ul>
      </div>

      <Button onClick={nextStep} className="w-full">
        {t('continue')}
      </Button>
    </WizardStep>
  );
}
