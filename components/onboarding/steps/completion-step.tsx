'use client';

import { WizardStep } from '../wizard-step';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '../onboarding-provider';
import { useTranslations } from 'next-intl';
import { completeOnboarding } from '@/lib/actions/onboarding';
import { useRouter } from 'next/navigation';
import { HugeiconsIcon } from '@hugeicons/react';
import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';

export function CompletionStep() {
  const t = useTranslations('onboarding.completion');
  const { closeWizard } = useOnboarding();
  const router = useRouter();

  const handleComplete = async () => {
    await completeOnboarding();
    closeWizard();
    router.push('/dashboard');
  };

  return (
    <WizardStep className="space-y-6 text-center">
      <div className="flex justify-center">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={64} className="text-green-500" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold">{t('title')}</h2>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      <div className="space-y-3">
        <h3 className="font-medium">{t('nextSteps.title')}</h3>
        <ul className="space-y-2 text-sm text-muted-foreground text-left">
          <li>• {t('nextSteps.addExpenses')}</li>
          <li>• {t('nextSteps.trackBudgets')}</li>
          <li>• {t('nextSteps.viewInsights')}</li>
        </ul>
      </div>

      <Button onClick={handleComplete} className="w-full">
        {t('goToDashboard')}
      </Button>
    </WizardStep>
  );
}
