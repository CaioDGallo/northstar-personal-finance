'use client';

import { cn } from '@/lib/utils';

interface WizardStepProps {
  children: React.ReactNode;
  className?: string;
}

export function WizardStep({ children, className }: WizardStepProps) {
  return (
    <div
      className={cn(
        'animate-in fade-in slide-in-from-bottom-4 duration-300',
        className
      )}
    >
      {children}
    </div>
  );
}
