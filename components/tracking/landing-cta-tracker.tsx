'use client';

import { type ReactElement, cloneElement } from 'react';
import posthog from 'posthog-js';
import {
  type CtaType,
  type CtaLocation,
  type LandingCtaProperties,
} from '@/lib/tracking/landing-events';

interface LandingCtaTrackerProps {
  ctaType: CtaType;
  ctaText: string;
  ctaLocation: CtaLocation;
  destination: string;
  children: ReactElement;
}

/**
 * Tracks CTA button clicks with context
 * Wraps button elements and attaches click handler
 */
export function LandingCtaTracker({
  ctaType,
  ctaText,
  ctaLocation,
  destination,
  children,
}: LandingCtaTrackerProps) {
  const handleClick = (e: React.MouseEvent) => {
    const timeToClick =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__landingTracking?.getTimeOnPage() || 0;

    const properties: LandingCtaProperties = {
      cta_type: ctaType,
      cta_text: ctaText,
      cta_location: ctaLocation,
      destination_section: destination,
      time_to_click_seconds: timeToClick,
    };

    posthog.capture('landing_cta_clicked', properties);

    // Increment CTA click count
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).__landingTracking) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__landingTracking.incrementCtaClicks();
    }

    // Call original onClick if it exists
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalOnClick = (children.props as any)?.onClick;
    if (originalOnClick) {
      originalOnClick(e);
    }
  };

  // Clone child element and attach click handler
  return cloneElement(children, {
    onClick: handleClick,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}
