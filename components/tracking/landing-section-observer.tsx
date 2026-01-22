'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import posthog from 'posthog-js';
import {
  getScrollDepth,
  type SectionName,
  type LandingSectionProperties,
} from '@/lib/tracking/landing-events';

interface LandingSectionObserverProps {
  sectionId: SectionName;
  children: ReactNode;
}

/**
 * Tracks section visibility using Intersection Observer
 * Fires event after section is 50%+ visible for 1+ second
 */
export function LandingSectionObserver({ sectionId, children }: LandingSectionObserverProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const visibilityStartRef = useRef<number | null>(null);
  const hasTrackedRef = useRef<boolean>(false);

  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting && entry.intersectionRatio >= 0.5;

        if (isVisible && !visibilityStartRef.current) {
          // Section became visible
          visibilityStartRef.current = Date.now();

          // Check after 1 second if still visible
          setTimeout(() => {
            if (visibilityStartRef.current && !hasTrackedRef.current) {
              const timeVisible = (Date.now() - visibilityStartRef.current) / 1000;

              if (timeVisible >= 1) {
                const properties: LandingSectionProperties = {
                  section_name: sectionId,
                  time_visible_seconds: Math.round(timeVisible),
                  scroll_depth_percent: getScrollDepth(),
                };

                posthog.capture('landing_section_viewed', properties);
                hasTrackedRef.current = true;

                // Notify parent tracker
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if ((window as any).__landingTracking) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (window as any).__landingTracking.addSection(sectionId);
                }
              }
            }
          }, 1000);
        } else if (!isVisible && visibilityStartRef.current) {
          // Section became not visible (before 1 second threshold)
          visibilityStartRef.current = null;
        }
      },
      {
        threshold: [0.5], // Track at 50% visibility
        rootMargin: '0px',
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [sectionId]);

  return <div ref={sectionRef}>{children}</div>;
}
