import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Suppress console.error to keep test output clean
// Tests that need to verify error logging can spy on it individually
vi.spyOn(console, 'error').mockImplementation(() => {});

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js cache functions
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

// Mock Next.js headers to provide a stable locale for error translations
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (name: string) => (name === 'NEXT_LOCALE' ? { value: 'en' } : undefined),
  }),
}));

// Prevent tests from performing real network requests in the sandbox.
const blockedHosts = new Set(['localhost', '127.0.0.1', '::1']);
const createJsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

globalThis.fetch = async (input: RequestInfo | URL) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  try {
    const parsed = new URL(url, 'http://localhost');
    if (blockedHosts.has(parsed.hostname)) {
      return createJsonResponse({ ok: true });
    }
  } catch {
    // If URL parsing fails, fall through to the error below.
  }

  throw new Error(`Unexpected fetch in tests: ${url}`);
};
