'use client';

import { useEffect } from 'react';
import { useOnboarding } from './onboarding-provider';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { WelcomeStep } from './steps/welcome-step';
import { AccountStep } from './steps/account-step';
import { CategoryStep } from './steps/category-step';
import { BudgetStep } from './steps/budget-step';
import { CompletionStep } from './steps/completion-step';
import { skipOnboarding } from '@/lib/actions/onboarding';
import { useTranslations } from 'next-intl';

const TOTAL_STEPS = 5;

export function OnboardingWizard() {
  const t = useTranslations('onboarding');
  const { wizardStatus, currentStep, needsOnboarding, startWizard, closeWizard } = useOnboarding();

  // Auto-start wizard if needed
  useEffect(() => {
    if (wizardStatus === 'pending' && needsOnboarding) {
      startWizard();
    }
  }, [wizardStatus, needsOnboarding, startWizard]);

  const handleSkip = async () => {
    await skipOnboarding();
    closeWizard();
  };

  const isOpen = wizardStatus === 'in_progress';

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <WelcomeStep />;
      case 1:
        return <AccountStep />;
      case 2:
        return <CategoryStep />;
      case 3:
        return <BudgetStep />;
      case 4:
        return <CompletionStep />;
      default:
        return <WelcomeStep />;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleSkip()}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] flex flex-col pb-[env(safe-area-inset-bottom)]"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <SheetHeader className="space-y-4 pb-0">
          <div className="flex items-center justify-between">
            <SheetTitle>{t('wizard.title')}</SheetTitle>
            {currentStep < TOTAL_STEPS - 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={handleSkip}
              >
                {t('wizard.skip')}
              </Button>
            )}
          </div>

          {/* Progress indicator */}
          <div className="flex gap-2 justify-center">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'size-2 rounded-full transition-colors',
                  i <= currentStep ? 'bg-foreground' : 'bg-muted'
                )}
              />
            ))}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {renderStep()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
