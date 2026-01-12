import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import { TEST_USER_ID, createTestEvent, createTestTask } from '@/test/fixtures';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';

type StatusUpdateActions = typeof import('@/lib/actions/status-updates');

describe('Status Updates', () => {
  let db: ReturnType<typeof getTestDb>;
  let updatePastItemStatuses: StatusUpdateActions['updatePastItemStatuses'];

  beforeAll(async () => {
    db = await setupTestDb();
    vi.doMock('@/lib/db', () => ({ db }));

    const actions = await import('@/lib/actions/status-updates');
    updatePastItemStatuses = actions.updatePastItemStatuses;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates past events and overdue tasks only', async () => {
    const pastEvent = createTestEvent({
      userId: TEST_USER_ID,
      title: 'Past Event',
      startAt: new Date('2026-02-01T09:00:00Z'),
      endAt: new Date('2026-02-01T10:00:00Z'),
      status: 'scheduled',
    });

    const futureEvent = createTestEvent({
      userId: TEST_USER_ID,
      title: 'Future Event',
      startAt: new Date('2026-02-01T13:00:00Z'),
      endAt: new Date('2026-02-01T14:00:00Z'),
      status: 'scheduled',
    });

    await db.insert(schema.events).values([pastEvent, futureEvent]);

    const overdueTask = createTestTask({
      userId: TEST_USER_ID,
      title: 'Overdue Task',
      dueAt: new Date('2026-02-01T10:30:00Z'),
      status: 'pending',
    });

    const inProgressTask = createTestTask({
      userId: TEST_USER_ID,
      title: 'In Progress Task',
      dueAt: new Date('2026-02-01T11:00:00Z'),
      status: 'in_progress',
    });

    const futureTask = createTestTask({
      userId: TEST_USER_ID,
      title: 'Future Task',
      dueAt: new Date('2026-02-01T13:00:00Z'),
      status: 'pending',
    });

    const completedTask = createTestTask({
      userId: TEST_USER_ID,
      title: 'Completed Task',
      dueAt: new Date('2026-02-01T09:00:00Z'),
      status: 'completed',
      completedAt: new Date('2026-02-01T10:00:00Z'),
    });

    await db.insert(schema.tasks).values([
      overdueTask,
      inProgressTask,
      futureTask,
      completedTask,
    ]);

    const result = await updatePastItemStatuses();

    expect(result).toEqual({
      eventsCompleted: 1,
      tasksMarkedOverdue: 2,
    });

    const [updatedPastEvent] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.title, 'Past Event'));
    expect(updatedPastEvent.status).toBe('completed');

    const [updatedFutureEvent] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.title, 'Future Event'));
    expect(updatedFutureEvent.status).toBe('scheduled');

    const tasks = await db.select().from(schema.tasks);
    const overdueStatuses = tasks
      .filter(task => task.title === 'Overdue Task' || task.title === 'In Progress Task')
      .map(task => task.status);
    expect(overdueStatuses).toEqual(['overdue', 'overdue']);

    const [futureTaskRow] = tasks.filter(task => task.title === 'Future Task');
    expect(futureTaskRow.status).toBe('pending');

    const [completedTaskRow] = tasks.filter(task => task.title === 'Completed Task');
    expect(completedTaskRow.status).toBe('completed');
  });
});
