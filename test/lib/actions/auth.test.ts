import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type AuthActions = typeof import('@/lib/actions/auth');

const checkLoginRateLimitMock = vi.fn();
const checkPasswordResetRateLimitMock = vi.fn();
const tMock = vi.fn(async (key: string, params?: Record<string, string | number>) => {
  if (params && 'retryAfter' in params) {
    return `${key}:${params.retryAfter}`;
  }
  return key;
});

const redirectMock = vi.fn();
const getCurrentUserIdMock = vi.fn();
const sendEmailMock = vi.fn();
const fetchMock = vi.fn();

const dbQueryFindFirstMock = vi.fn();
const dbInsertValuesMock = vi.fn();
const dbInsertMock = vi.fn(() => ({ values: dbInsertValuesMock }));
const dbUpdateWhereMock = vi.fn();
const dbUpdateSetMock = vi.fn(() => ({ where: dbUpdateWhereMock }));
const dbUpdateMock = vi.fn(() => ({ set: dbUpdateSetMock }));
const dbDeleteWhereMock = vi.fn();
const dbDeleteMock = vi.fn(() => ({ where: dbDeleteWhereMock }));

const hashMock = vi.fn();
const compareMock = vi.fn();

const loadActions = async (): Promise<AuthActions> => {
  vi.doMock('@/lib/rate-limit', () => ({
    checkLoginRateLimit: checkLoginRateLimitMock,
    checkPasswordResetRateLimit: checkPasswordResetRateLimitMock,
  }));
  vi.doMock('@/lib/i18n/server-errors', () => ({ t: tMock }));
  vi.doMock('next/navigation', () => ({ redirect: redirectMock }));
  vi.doMock('@/lib/auth', () => ({ getCurrentUserId: getCurrentUserIdMock }));
  vi.doMock('@/lib/db', () => ({
    db: {
      query: { users: { findFirst: dbQueryFindFirstMock } },
      insert: dbInsertMock,
      update: dbUpdateMock,
      delete: dbDeleteMock,
    },
  }));
  vi.doMock('@/lib/email/send', () => ({ sendEmail: sendEmailMock }));
  vi.doMock('bcryptjs', () => ({
    default: { hash: hashMock, compare: compareMock },
    hash: hashMock,
    compare: compareMock,
  }));

  return await import('@/lib/actions/auth');
};

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

describe('Auth Actions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    process.env.NEXTAUTH_URL = 'http://localhost:3000';

    fetchMock.mockResolvedValue({ json: async () => ({ ok: true }) });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    checkLoginRateLimitMock.mockResolvedValue({ allowed: true });
    checkPasswordResetRateLimitMock.mockResolvedValue({ allowed: true });
    getCurrentUserIdMock.mockResolvedValue('user-123');
    dbQueryFindFirstMock.mockResolvedValue(null);
    dbInsertValuesMock.mockResolvedValue(undefined);
    dbUpdateWhereMock.mockResolvedValue(undefined);
    dbDeleteWhereMock.mockResolvedValue(undefined);
    hashMock.mockResolvedValue('hashed-value');
    compareMock.mockResolvedValue(true);
    sendEmailMock.mockResolvedValue(undefined);

    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('validateLoginAttempt returns error when rate limit denied', async () => {
    checkLoginRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 30 });

    const { validateLoginAttempt } = await loadActions();
    const result = await validateLoginAttempt('user@example.com', 'captcha');

    expect(result).toEqual({ allowed: false, error: 'errors.tooManyAttempts:30' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('validateLoginAttempt returns allowed when rate limit and CAPTCHA pass', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ success: true }) });

    const { validateLoginAttempt } = await loadActions();
    const result = await validateLoginAttempt('user@example.com', 'valid-captcha');

    expect(result).toEqual({ allowed: true, error: null });
  });

  it('validateLoginAttempt returns error when CAPTCHA fails', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ success: false }) });

    const { validateLoginAttempt } = await loadActions();
    const result = await validateLoginAttempt('user@example.com', 'invalid-captcha');

    expect(result).toEqual({ allowed: false, error: 'login.captchaFailed' });
  });

  it('forgotPassword returns translated error when rate limit denied', async () => {
    checkPasswordResetRateLimitMock.mockResolvedValue({ allowed: false, retryAfter: 15 });

    const { forgotPassword } = await loadActions();
    const result = await forgotPassword('user@example.com');

    expect(result).toEqual({ error: 'errors.tooManyAttempts:15' });
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('forgotPassword returns success when user exists and email is sent', async () => {
    dbQueryFindFirstMock.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });

    const { forgotPassword } = await loadActions();
    const result = await forgotPassword('user@example.com');

    expect(result).toEqual({ error: null });
    expect(dbInsertMock).toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalled();
  });

  it('forgotPassword returns success even when email sending fails', async () => {
    dbQueryFindFirstMock.mockResolvedValue({ id: 'user-1', email: 'user@example.com' });
    sendEmailMock.mockRejectedValue(new Error('Send failed'));

    const { forgotPassword } = await loadActions();
    const result = await forgotPassword('user@example.com');

    expect(result).toEqual({ error: null });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('updatePassword returns notAuthenticated when user missing', async () => {
    getCurrentUserIdMock.mockRejectedValue(new Error('Unauthorized'));

    const { updatePassword } = await loadActions();
    const result = await updatePassword('Password123');

    expect(result).toEqual({ error: 'errors.notAuthenticated' });
    expect(dbUpdateMock).not.toHaveBeenCalled();
  });

  it('updatePassword validates minimum length', async () => {
    const { updatePassword } = await loadActions();
    const result = await updatePassword('Short1');

    expect(result).toEqual({ error: 'errors.passwordTooShort' });
    expect(dbUpdateMock).not.toHaveBeenCalled();
  });

  it('updatePassword validates letter and number requirements', async () => {
    const { updatePassword } = await loadActions();
    const result = await updatePassword('12345678');

    expect(result).toEqual({ error: 'errors.passwordRequirementsNotMet' });
    expect(dbUpdateMock).not.toHaveBeenCalled();
  });

  it('updatePassword returns unexpectedError on database failure', async () => {
    dbUpdateWhereMock.mockRejectedValue(new Error('db failed'));

    const { updatePassword } = await loadActions();
    const result = await updatePassword('Password123');

    expect(result).toEqual({ error: 'errors.unexpectedError' });
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('updatePassword returns success on valid password', async () => {
    hashMock.mockResolvedValue('hashed-password');

    const { updatePassword } = await loadActions();
    const result = await updatePassword('Password123');

    expect(result).toEqual({ error: null });
    expect(dbUpdateSetMock).toHaveBeenCalledWith({ passwordHash: 'hashed-password' });
  });
});
