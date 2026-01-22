/**
 * Landing page analytics tracking utilities
 * Defines event types, properties, and helper functions for PostHog tracking
 */

// ============================================================================
// Type Definitions
// ============================================================================

export type DeviceType = 'desktop' | 'tablet' | 'mobile';
export type CtaType = 'primary' | 'secondary';
export type CtaLocation = 'header' | 'hero' | 'proof';
export type SectionName = 'hero' | 'recursos' | 'como' | 'faq' | 'espera';
export type Platform = 'chromium' | 'ios-safari' | 'other';

// ============================================================================
// Event Property Interfaces
// ============================================================================

export interface LandingBaseProperties {
  viewport_width: number;
  viewport_height: number;
  device_type: DeviceType;
  locale: string;
}

export interface LandingTrafficProperties extends LandingBaseProperties {
  referrer: string;
  referrer_domain: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  is_returning_visitor: boolean;
}

export interface LandingExitProperties extends LandingBaseProperties {
  time_on_page_seconds: number;
  scroll_depth_max_percent: number;
  sections_viewed: SectionName[];
  sections_viewed_count: number;
  deepest_section: SectionName;
  cta_clicks_count: number;
}

export interface LandingSectionProperties {
  section_name: SectionName;
  time_visible_seconds: number;
  scroll_depth_percent: number;
}

export interface LandingCtaProperties {
  cta_type: CtaType;
  cta_text: string;
  cta_location: CtaLocation;
  destination_section: string;
  time_to_click_seconds: number;
}

export interface LandingWaitlistProperties {
  focus_source: 'scroll' | 'click';
  time_on_page_before_focus: number;
  sections_viewed: SectionName[];
}

export interface LandingWaitlistStartedProperties {
  email_entered: boolean;
  form_interaction_time_seconds: number;
}

export interface LandingPwaProperties {
  platform: Platform;
  viewport_size: string;
}

export interface LandingPwaDismissedProperties extends LandingPwaProperties {
  time_visible_seconds: number;
}

export interface LandingPwaClickedProperties extends LandingPwaProperties {
  time_to_interaction_seconds: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detects device type based on viewport width
 */
export function getDeviceType(): DeviceType {
  if (typeof window === 'undefined') return 'desktop';

  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/**
 * Gets current viewport dimensions
 */
export function getViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 0, height: 0 };

  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

/**
 * Calculates scroll depth as percentage
 */
export function getScrollDepth(): number {
  if (typeof window === 'undefined') return 0;

  const scrollTop = window.scrollY;
  const docHeight = document.documentElement.scrollHeight;
  const winHeight = window.innerHeight;
  const scrollPercent = scrollTop / (docHeight - winHeight);

  return Math.min(Math.round(scrollPercent * 100), 100);
}

/**
 * Extracts domain from referrer URL
 */
export function getReferrerDomain(referrer: string): string {
  if (!referrer) return '';

  try {
    const url = new URL(referrer);
    return url.hostname;
  } catch {
    return '';
  }
}

/**
 * Checks if user is returning visitor (has visited before)
 */
export function getReturningVisitor(): boolean {
  if (typeof window === 'undefined') return false;

  const key = 'fluxo_landing_visited';
  const hasVisited = localStorage.getItem(key);

  if (!hasVisited) {
    localStorage.setItem(key, Date.now().toString());
    return false;
  }

  return true;
}

/**
 * Extracts UTM parameters from URL
 */
export function getUtmParams(): {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
} {
  if (typeof window === 'undefined') return {};

  const params = new URLSearchParams(window.location.search);
  const utm: Record<string, string> = {};

  ['source', 'medium', 'campaign', 'content', 'term'].forEach((param) => {
    const value = params.get(`utm_${param}`);
    if (value) utm[`utm_${param}`] = value;
  });

  return utm;
}

/**
 * Gets base properties for all landing events
 */
export function getBaseProperties(): LandingBaseProperties {
  const { width, height } = getViewportSize();

  return {
    viewport_width: width,
    viewport_height: height,
    device_type: getDeviceType(),
    locale: typeof navigator !== 'undefined' ? navigator.language : 'unknown',
  };
}

/**
 * Gets traffic source properties
 */
export function getTrafficProperties(): LandingTrafficProperties {
  const referrer = typeof document !== 'undefined' ? document.referrer : '';

  return {
    ...getBaseProperties(),
    referrer,
    referrer_domain: getReferrerDomain(referrer),
    ...getUtmParams(),
    is_returning_visitor: getReturningVisitor(),
  };
}

/**
 * Detects PWA platform
 */
export function getPlatform(): Platform {
  if (typeof window === 'undefined') return 'other';

  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isSafari = /safari/.test(ua) && !/chrome/.test(ua);

  if (isIOS && isSafari) return 'ios-safari';
  if (/chrome|chromium|edg/.test(ua)) return 'chromium';

  return 'other';
}
