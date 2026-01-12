import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import { mockAuth } from '@/test/auth-utils';
import { TEST_USER_ID } from '@/test/fixtures';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

type UserSettingsActions = typeof import('@/lib/actions/user-settings');

describe('User Settings Actions', () => {
  let db: ReturnType<typeof getTestDb>;
  let getUserSettings: UserSettingsActions['getUserSettings'];
  let getOrCreateUserSettings: UserSettingsActions['getOrCreateUserSettings'];
  let updateUserSettings: UserSettingsActions['updateUserSettings'];

  const tMock = vi.fn(async (key: string) => key);
  const revalidatePathMock = vi.mocked(revalidatePath);

  beforeAll(async () => {
    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({ db }));
    mockAuth();
    vi.doMock('@/lib/i18n/server-errors', () => ({ t: tMock }));

    const actions = await import('@/lib/actions/user-settings');
    getUserSettings = actions.getUserSettings;
    getOrCreateUserSettings = actions.getOrCreateUserSettings;
    updateUserSettings = actions.updateUserSettings;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
  });

  it('getUserSettings returns existing settings', async () => {
    await db.insert(schema.userSettings).values({
      userId: TEST_USER_ID,
      timezone: 'America/Sao_Paulo',
      notificationEmail: 'user@example.com',
      notificationsEnabled: true,
    });

    const settings = await getUserSettings();
    expect(settings?.userId).toBe(TEST_USER_ID);
    expect(settings?.timezone).toBe('America/Sao_Paulo');
    expect(settings?.notificationEmail).toBe('user@example.com');
  });

  it('getOrCreateUserSettings creates when missing', async () => {
    const settings = await getOrCreateUserSettings();
    expect(settings?.userId).toBe(TEST_USER_ID);

    const rows = await db
      .select()
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, TEST_USER_ID));
    expect(rows).toHaveLength(1);
  });

  it('getOrCreateUserSettings returns existing when present', async () => {
    const [existing] = await db
      .insert(schema.userSettings)
      .values({ userId: TEST_USER_ID, timezone: 'UTC' })
      .returning();

    const settings = await getOrCreateUserSettings();
    expect(settings?.id).toBe(existing.id);

    const rows = await db
      .select()
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, TEST_USER_ID));
    expect(rows).toHaveLength(1);
  });

  it('validates timezone', async () => {
    const result = await updateUserSettings({ timezone: 'Invalid/Zone' });
    expect(result).toEqual({ success: false, error: 'errors.invalidTimezone' });
  });

  it('validates notification email', async () => {
    const result = await updateUserSettings({ notificationEmail: 'not-an-email' });
    expect(result).toEqual({ success: false, error: 'errors.invalidEmail' });
  });

  it('validates offset minutes', async () => {
    const result1 = await updateUserSettings({ defaultEventOffsetMinutes: -1 });
    expect(result1).toEqual({ success: false, error: 'errors.invalidOffsetMinutes' });

    const result2 = await updateUserSettings({ defaultTaskOffsetMinutes: 10081 });
    expect(result2).toEqual({ success: false, error: 'errors.invalidOffsetMinutes' });
  });

  it('updates settings and revalidates paths', async () => {
    await db.insert(schema.userSettings).values({ userId: TEST_USER_ID });

    const result = await updateUserSettings({
      timezone: 'America/Sao_Paulo',
      notificationEmail: 'new@example.com',
      notificationsEnabled: false,
      defaultEventOffsetMinutes: 30,
    });

    expect(result).toEqual({ success: true });

    const [settings] = await db
      .select()
      .from(schema.userSettings)
      .where(eq(schema.userSettings.userId, TEST_USER_ID));

    expect(settings).toMatchObject({
      timezone: 'America/Sao_Paulo',
      notificationEmail: 'new@example.com',
      notificationsEnabled: false,
      defaultEventOffsetMinutes: 30,
    });

    expect(revalidatePathMock).toHaveBeenCalledWith('/settings');
    expect(revalidatePathMock).toHaveBeenCalledWith('/calendar');
  });
});
