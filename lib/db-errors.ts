import { t } from '@/lib/i18n/server-errors';

/**
 * PostgreSQL error codes
 * https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const PG_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
  CHECK_VIOLATION: '23514',
  CONNECTION_EXCEPTION: '08000',
  CONNECTION_FAILURE: '08006',
} as const;

interface PostgresError extends Error {
  code?: string;
  constraint?: string;
  detail?: string;
}

function isPostgresError(error: unknown): error is PostgresError {
  return error instanceof Error && 'code' in error;
}

/**
 * Handles database errors and returns user-friendly translated messages
 */
export async function handleDbError(error: unknown, fallbackKey: string): Promise<string> {
  // If it's a regular Error with a message that looks like a translation key,
  // preserve it (these are validation errors from actions)
  if (error instanceof Error && error.message.startsWith('errors.')) {
    return error.message;
  }

  if (!isPostgresError(error)) {
    return await t(fallbackKey);
  }

  switch (error.code) {
    case PG_ERROR_CODES.UNIQUE_VIOLATION:
      return await t('errors.duplicateEntry');

    case PG_ERROR_CODES.FOREIGN_KEY_VIOLATION:
      return await t('errors.relatedRecordNotFound');

    case PG_ERROR_CODES.NOT_NULL_VIOLATION:
      return await t('errors.requiredFieldMissing');

    case PG_ERROR_CODES.CHECK_VIOLATION:
      return await t('errors.invalidDataConstraint');

    case PG_ERROR_CODES.CONNECTION_EXCEPTION:
    case PG_ERROR_CODES.CONNECTION_FAILURE:
      return await t('errors.databaseConnectionFailed');

    default:
      return await t(fallbackKey);
  }
}
