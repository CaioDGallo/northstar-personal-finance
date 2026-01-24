import * as admin from 'firebase-admin';

/**
 * Retrieves service account credentials from environment variables.
 * Supports both base64-encoded and raw JSON formats.
 *
 * Priority:
 * 1. FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64 (recommended - safer for escaping)
 * 2. FIREBASE_ADMIN_SERVICE_ACCOUNT (fallback - raw JSON)
 */
function getServiceAccount() {
  // Try base64 first (recommended approach)
  const base64 = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_BASE64;
  if (base64) {
    try {
      const json = Buffer.from(base64, 'base64').toString('utf-8');
      const serviceAccount = JSON.parse(json);
      console.log('[Firebase Admin] Loaded from base64-encoded service account');
      return serviceAccount;
    } catch (error) {
      console.error('[Firebase Admin] Failed to decode base64 service account:', error);
      // Fall through to try raw JSON
    }
  }

  // Fall back to raw JSON
  const raw = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT;
  if (raw) {
    try {
      const serviceAccount = JSON.parse(raw);
      console.log('[Firebase Admin] Loaded from raw JSON service account');
      return serviceAccount;
    } catch (error) {
      console.error('[Firebase Admin] Failed to parse raw JSON service account:', error);
      return null;
    }
  }

  console.warn('[Firebase Admin] No service account configured');
  return null;
}

function getFirebaseAdmin() {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const serviceAccount = getServiceAccount();
  if (!serviceAccount) {
    // Return a dummy app during build time when env vars aren't set
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return null as any;
  }

  try {
    return admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } catch (error) {
    console.error('[Firebase Admin] Failed to initialize:', error);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return null as any;
  }
}

export const firebaseAdmin = getFirebaseAdmin();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const messaging = firebaseAdmin?.messaging ? firebaseAdmin.messaging() : null as any;
