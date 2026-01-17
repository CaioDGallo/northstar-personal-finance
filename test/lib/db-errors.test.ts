import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('handleDbError', () => {
  const tMock = vi.fn(async (key: string) => key);

  const loadModule = async () => {
    vi.doMock('@/lib/i18n/server-errors', () => ({ t: tMock }));
    return await import('@/lib/db-errors');
  };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns fallback for non-Postgres errors', async () => {
    const { handleDbError } = await loadModule();

    const result = await handleDbError(new Error('boom'), 'errors.failedToSave');

    expect(result).toBe('errors.failedToSave');
    expect(tMock).toHaveBeenCalledWith('errors.failedToSave');
  });

  it('preserves validation error messages that start with "errors."', async () => {
    const { handleDbError } = await loadModule();

    const result = await handleDbError(new Error('errors.nameRequired'), 'errors.failedToSave');

    expect(result).toBe('errors.nameRequired');
    expect(tMock).not.toHaveBeenCalled();
  });

  it('returns fallback for non-error values', async () => {
    const { handleDbError } = await loadModule();

    const result = await handleDbError(null, 'errors.failedToSave');

    expect(result).toBe('errors.failedToSave');
  });

  it.each([
    ['23505', 'errors.duplicateEntry'],
    ['23503', 'errors.relatedRecordNotFound'],
    ['23502', 'errors.requiredFieldMissing'],
    ['23514', 'errors.invalidDataConstraint'],
    ['08000', 'errors.databaseConnectionFailed'],
    ['08006', 'errors.databaseConnectionFailed'],
  ])('maps postgres code %s to %s', async (code, expected) => {
    const { handleDbError } = await loadModule();

    const error = Object.assign(new Error('db error'), { code });
    const result = await handleDbError(error, 'errors.failedToSave');

    expect(result).toBe(expected);
  });

  it('falls back for unknown postgres codes', async () => {
    const { handleDbError } = await loadModule();

    const error = Object.assign(new Error('db error'), { code: '99999' });
    const result = await handleDbError(error, 'errors.failedToSave');

    expect(result).toBe('errors.failedToSave');
  });
});
