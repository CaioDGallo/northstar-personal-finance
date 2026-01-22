'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import posthog from 'posthog-js';
import {
  getTrafficProperties,
  getScrollDepth,
  type SectionName,
  type LandingExitProperties,
} from '@/lib/tracking/landing-events';

interface LandingPageTrackerProps {
  children: ReactNode;
}

/**
 * Tracks landing page lifecycle events: view on mount, exit on unmount
 * Maintains session state for scroll depth, sections viewed, CTA clicks
 */
export function LandingPageTracker({ children }: LandingPageTrackerProps) {
  const startTimeRef = useRef<number>(0);
  const maxScrollDepthRef = useRef<number>(0);
  const sectionsViewedRef = useRef<Set<SectionName>>(new Set());
  const ctaClicksCountRef = useRef<number>(0);

  useEffect(() => {
    // Record start time
    startTimeRef.current = Date.now();

    // Track page view with traffic properties
    posthog.capture('landing_page_viewed', getTrafficProperties());

    // Track scroll depth
    const handleScroll = () => {
      const currentDepth = getScrollDepth();
      if (currentDepth > maxScrollDepthRef.current) {
        maxScrollDepthRef.current = currentDepth;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup and track page exit
    return () => {
      window.removeEventListener('scroll', handleScroll);

      const timeOnPage = Math.round((Date.now() - startTimeRef.current) / 1000);
      // We want the latest ref value when cleanup runs (component unmount)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const sectionsViewed = sectionsViewedRef.current;
      const sectionsArray = Array.from(sectionsViewed);

      const exitProperties: LandingExitProperties = {
        ...getTrafficProperties(),
        time_on_page_seconds: timeOnPage,
        scroll_depth_max_percent: maxScrollDepthRef.current,
        sections_viewed: sectionsArray,
        sections_viewed_count: sectionsArray.length,
        deepest_section: sectionsArray[sectionsArray.length - 1] || 'hero',
        cta_clicks_count: ctaClicksCountRef.current,
      };

      // Use sendBeacon transport for reliable exit tracking
      posthog.capture('landing_page_exited', exitProperties, { transport: 'sendBeacon' });
    };
  }, []);

  // Expose methods for child components to update session state
  useEffect(() => {
    // Add methods to window for section tracking
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__landingTracking = {
      addSection: (section: SectionName) => {
        sectionsViewedRef.current.add(section);
      },
      incrementCtaClicks: () => {
        ctaClicksCountRef.current += 1;
      },
      getTimeOnPage: () => Math.round((Date.now() - startTimeRef.current) / 1000),
      getSectionsViewed: () => Array.from(sectionsViewedRef.current),
    };

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__landingTracking;
    };
  }, []);

  return <>{children}</>;
}
