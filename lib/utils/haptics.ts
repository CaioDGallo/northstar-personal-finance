/**
 * Trigger haptic feedback on supported devices
 * @param pattern - Vibration pattern in milliseconds (number or array)
 */
export function triggerHaptic(pattern: number | readonly number[] = 50): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern as number | number[]);
  }
}

/**
 * Common haptic patterns for different interactions
 */
export const HapticPatterns = {
  light: 50,        // Light tap (selection, toggle)
  medium: 75,       // Medium feedback (success, category change)
  heavy: [100, 50, 100], // Strong feedback (delete, error)
  success: [50, 100], // Success pattern (save, complete)
} as const;
