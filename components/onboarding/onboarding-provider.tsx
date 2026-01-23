'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getOnboardingStatus, markHintViewed as markHintViewedAction } from '@/lib/actions/onboarding';

interface OnboardingContextValue {
  wizardStatus: 'loading' | 'pending' | 'in_progress' | 'completed';
  currentStep: number;
  hintsViewed: Set<string>;
  needsOnboarding: boolean;

  // Actions
  nextStep: () => void;
  prevStep: () => void;
  setStep: (step: number) => void;
  startWizard: () => void;
  closeWizard: () => void;
  isHintViewed: (key: string) => boolean;
  markHintViewed: (key: string) => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [wizardStatus, setWizardStatus] = useState<'loading' | 'pending' | 'in_progress' | 'completed'>('loading');
  const [currentStep, setCurrentStep] = useState(0);
  const [hintsViewed, setHintsViewed] = useState<Set<string>>(new Set());
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Load onboarding status on mount
  useEffect(() => {
    getOnboardingStatus().then((status) => {
      setNeedsOnboarding(status.needsOnboarding);
      setHintsViewed(new Set(status.hintsViewed));

      // Check localStorage for current step
      const savedStep = localStorage.getItem('onboarding-step');
      if (savedStep) {
        setCurrentStep(parseInt(savedStep, 10));
      }

      // Check localStorage for wizard status
      const savedStatus = localStorage.getItem('onboarding-wizard-status');
      if (savedStatus === 'in_progress') {
        setWizardStatus('in_progress');
      } else if (status.needsOnboarding) {
        setWizardStatus('pending');
      } else {
        setWizardStatus('completed');
      }
    });
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = prev + 1;
      localStorage.setItem('onboarding-step', next.toString());
      return next;
    });
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => {
      const next = Math.max(0, prev - 1);
      localStorage.setItem('onboarding-step', next.toString());
      return next;
    });
  }, []);

  const setStep = useCallback((step: number) => {
    setCurrentStep(step);
    localStorage.setItem('onboarding-step', step.toString());
  }, []);

  const startWizard = useCallback(() => {
    setWizardStatus('in_progress');
    setCurrentStep(0);
    localStorage.setItem('onboarding-wizard-status', 'in_progress');
    localStorage.setItem('onboarding-step', '0');
  }, []);

  const closeWizard = useCallback(() => {
    setWizardStatus('completed');
    setNeedsOnboarding(false);
    localStorage.removeItem('onboarding-wizard-status');
    localStorage.removeItem('onboarding-step');
  }, []);

  const isHintViewed = useCallback((key: string) => {
    return hintsViewed.has(key);
  }, [hintsViewed]);

  const markHintViewed = useCallback(async (key: string) => {
    if (!hintsViewed.has(key)) {
      setHintsViewed((prev) => new Set([...prev, key]));
      await markHintViewedAction(key);
    }
  }, [hintsViewed]);

  const value: OnboardingContextValue = {
    wizardStatus,
    currentStep,
    hintsViewed,
    needsOnboarding,
    nextStep,
    prevStep,
    setStep,
    startWizard,
    closeWizard,
    isHintViewed,
    markHintViewed,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (context === undefined) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
