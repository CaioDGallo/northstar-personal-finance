import { getServerSession } from 'next-auth';
import { authConfig } from '@/lib/auth-config';

/**
 * Gets the currently authenticated user's ID.
 * @throws {Error} If no user is authenticated (throws 'Unauthorized')
 * @returns The user's ID
 */
export async function getCurrentUserId(): Promise<string> {
  // E2E bypass (same as before)
  if (process.env.E2E_AUTH_BYPASS === 'true' && process.env.E2E_AUTH_USER_ID) {
    return process.env.E2E_AUTH_USER_ID;
  }

  const session = await getServerSession(authConfig);

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  return session.user.id;
}

/**
 * Gets the current session (null if not authenticated)
 */
export async function getSession() {
  return await getServerSession(authConfig);
}

export { authConfig };
