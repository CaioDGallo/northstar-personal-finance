'use client';

import { useEffect, useState } from 'react';
import { useOnboarding } from './onboarding-provider';
import { Button } from '@/components/ui/button';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

interface OnboardingTooltipProps {
  hintKey: string;
  children: React.ReactNode;
  className?: string;
}

export function OnboardingTooltip({
  hintKey,
  children,
  className,
}: OnboardingTooltipProps) {
  const { isHintViewed, markHintViewed, wizardStatus } = useOnboarding();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show hint after wizard is completed and if not viewed yet
    if (wizardStatus === 'completed' && !isHintViewed(hintKey)) {
      // Delay showing hint slightly for better UX
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hintKey, isHintViewed, wizardStatus]);

  const handleDismiss = async () => {
    setIsVisible(false);
    await markHintViewed(hintKey);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        'animate-in fade-in slide-in-from-top-2 duration-300',
        'rounded-lg border bg-card p-4 shadow-lg',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 text-sm">{children}</div>
        <Button
          variant="ghost"
          size="sm"
          className="size-6 p-0 hover:bg-muted"
          onClick={handleDismiss}
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </Button>
      </div>
    </div>
  );
}
