import { vi } from 'vitest';
import { TEST_USER_ID } from './fixtures';

/**
 * Mock the auth module to return a test user ID.
 * This prevents Next.js cookies() API from being called in tests.
 * Call this before importing server actions that use getCurrentUserId().
 */
export function mockAuth() {
  vi.doMock('@/lib/auth', () => ({
    getCurrentUserId: vi.fn().mockResolvedValue(TEST_USER_ID),
    getSession: vi.fn().mockResolvedValue({
      user: { id: TEST_USER_ID, email: 'test@example.com', name: 'Test User' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    }),
  }));
}
