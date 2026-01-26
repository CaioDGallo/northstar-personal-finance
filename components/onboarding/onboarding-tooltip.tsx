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
  const { isHintViewed, markHintViewed, wizardStatus, hintsLoading } = useOnboarding();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Only show hint after:
    // 1. Wizard completed
    // 2. Hints loaded from DB
    // 3. Hint not viewed
    if (wizardStatus === 'completed' && !hintsLoading && !isHintViewed(hintKey)) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hintKey, isHintViewed, wizardStatus, hintsLoading]);

  const handleDismiss = async () => {
    setIsVisible(false);
    await markHintViewed(hintKey);
  };

  // if (!isVisible) {
  //   return null;
  // }

  return (
    <div
      className={cn(
        'animate-in fade-in slide-in-from-top-2 duration-300',
        'rounded-none bg-card p-4 border-2 border-black transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none active:translate-x-0.5 active:translate-y-0.5 active:shadow-none shadow-gray-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]',
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
