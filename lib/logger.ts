import type { ErrorId } from '@/constants/errorIds';

/**
 * Logging utilities for production error tracking, debugging, and analytics
 */

interface ErrorContext {
  [key: string]: unknown;
}

/**
 * Log error for production monitoring (Sentry, CloudWatch, etc.)
 * Use this for errors that need to be tracked and monitored in production
 *
 * @param errorId - Unique error identifier from ErrorIds
 * @param message - Human-readable error message
 * @param error - Original error object (optional)
 * @param context - Additional context data (optional)
 *
 * @example
 * logError('EVENT_CREATE_FAILED', 'Failed to create event', error, { eventId: 123, userId: 'abc' });
 */
export function logError(
  errorId: ErrorId,
  message: string,
  error?: unknown,
  context?: ErrorContext
): void {
  const timestamp = new Date().toISOString();
  const errorData = {
    errorId,
    message,
    timestamp,
    context,
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error,
  };

  // For now, log to console. In production, this would send to Sentry/monitoring service
  console.error('[ERROR]', errorId, ':', message, errorData);

  // TODO: Integrate with Sentry or monitoring service
  // if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined' && window.Sentry) {
  //   window.Sentry.captureException(error || new Error(message), {
  //     tags: { errorId },
  //     extra: context,
  //   });
  // }
}

/**
 * Log for debugging purposes (development/troubleshooting)
 * Use this for diagnostic logging that helps debug issues
 * These logs are visible in development but should not trigger alerts
 *
 * @param context - Context tag (e.g., 'events:get', 'tasks:update')
 * @param message - Debug message
 * @param data - Additional data to log (optional)
 *
 * @example
 * logForDebugging('events:get', 'Fetching events for user', { userId: 'abc' });
 */
export function logForDebugging(
  context: string,
  message: string,
  data?: unknown
): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DEBUG] [${context}]`, message, data ? data : '');
  } else {
    // In production, only log warnings/errors, not debug info
    // This prevents console spam while keeping critical info
  }
}

/**
 * Log analytics event for tracking user behavior and feature usage
 * Use this for product analytics, metrics, and telemetry
 *
 * @param eventName - Event name (e.g., 'event_created', 'budget_updated')
 * @param properties - Event properties for analytics (optional)
 *
 * @example
 * logEvent('event_created', { eventType: 'meeting', hasRecurrence: true });
 */
export function logEvent(
  eventName: string,
  properties?: Record<string, unknown>
): void {
  const eventData = {
    event: eventName,
    timestamp: new Date().toISOString(),
    properties,
  };

  // For now, log to console. In production, this would send to analytics service
  if (process.env.NODE_ENV === 'development') {
    console.log('[ANALYTICS]', eventName, eventData);
  }

  // TODO: Integrate with analytics service (Mixpanel, PostHog, etc.)
  // if (typeof window !== 'undefined' && window.analytics) {
  //   window.analytics.track(eventName, properties);
  // }
}

/**
 * Helper to log warning (between debug and error)
 * Use for non-critical issues that should be monitored
 *
 * @param context - Context tag
 * @param message - Warning message
 * @param data - Additional data (optional)
 */
export function logWarning(
  context: string,
  message: string,
  data?: unknown
): void {
  const timestamp = new Date().toISOString();
  console.warn(`[WARN] [${context}] ${timestamp}:`, message, data || '');
}
