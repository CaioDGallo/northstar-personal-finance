'use client';

import { useState, useRef } from 'react';
import posthog from 'posthog-js';
import { Input } from '@/components/ui/input';
import type {
  LandingWaitlistProperties,
  LandingWaitlistStartedProperties,
} from '@/lib/tracking/landing-events';

interface LandingWaitlistFormProps {
  emailLabel: string;
  emailPlaceholder: string;
  submitNote: string;
}

/**
 * Tracks waitlist form interactions: focus, typing (debounced)
 */
export function LandingWaitlistForm({
  emailLabel,
  emailPlaceholder,
  submitNote,
}: LandingWaitlistFormProps) {
  const [hasTrackedFocus, setHasTrackedFocus] = useState(false);
  const [hasTrackedStarted, setHasTrackedStarted] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const interactionStartRef = useRef<number>(0);

  const handleFocus = () => {
    if (hasTrackedFocus) return;

    const timeOnPage =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__landingTracking?.getTimeOnPage() || 0;
    const sectionsViewed =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__landingTracking?.getSectionsViewed() || [];

    const properties: LandingWaitlistProperties = {
      focus_source: timeOnPage < 5 ? 'scroll' : 'click',
      time_on_page_before_focus: timeOnPage,
      sections_viewed: sectionsViewed,
    };

    posthog.capture('landing_waitlist_focused', properties);
    setHasTrackedFocus(true);
    interactionStartRef.current = Date.now();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (hasTrackedStarted) return;

    // Debounce typing event (500ms)
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      const hasValue = e.target.value.length > 0;
      const interactionTime = interactionStartRef.current
        ? (Date.now() - interactionStartRef.current) / 1000
        : 0;

      const properties: LandingWaitlistStartedProperties = {
        email_entered: hasValue,
        form_interaction_time_seconds: Math.round(interactionTime),
      };

      posthog.capture('landing_waitlist_started', properties);
      setHasTrackedStarted(true);
    }, 500);
  };

  return (
    <div className="space-y-4">
      <label
        className="text-xs font-semibold uppercase tracking-[0.2em]"
        htmlFor="waitlist-email"
      >
        {emailLabel}
      </label>
      <Input
        id="waitlist-email"
        type="email"
        placeholder={emailPlaceholder}
        onFocus={handleFocus}
        onChange={handleChange}
      />
      <p className="text-xs text-foreground/80">{submitNote}</p>
    </div>
  );
}
