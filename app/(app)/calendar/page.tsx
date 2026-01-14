'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScheduleXCalendar, useNextCalendarApp } from '@schedule-x/react';
import {
  createViewDay,
  createViewMonthAgenda,
  createViewMonthGrid,
  createViewWeek,
  CalendarEvent
} from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import 'temporal-polyfill/global';
import '@schedule-x/theme-shadcn/dist/index.css';
import { deleteEvent, getEventsWithRecurrence } from '@/lib/actions/events';
import { deleteTask, getTasksWithRecurrence } from '@/lib/actions/tasks';
import { getActiveBillReminders } from '@/lib/actions/bill-reminders';
import { getUserSettings } from '@/lib/actions/user-settings';
import { type Event, type Task, type BillReminder } from '@/lib/schema';
import { parseRRule } from '@/lib/recurrence';
import { buildTaskSchedule, type TaskWithRecurrence } from '@/lib/task-schedule';
import { buildBillReminderSchedule } from '@/lib/bill-reminder-schedule';
import { getBrowserTimeZone, resolveTimeZone, toZonedDateTime } from '@/lib/timezone-utils';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { EventForm } from '@/components/event-form';
import { TaskForm } from '@/components/task-form';
import { MonthAgendaEventItem } from '@/components/calendar/month-agenda-event-item';
import { WeekEventItem } from '@/components/calendar/week-event-item';
import { DayEventItem } from '@/components/calendar/day-event-item';
import { MonthGridEventItem } from '@/components/calendar/month-grid-event-item';
import { EventDetailSheet } from '@/components/calendar/event-detail-sheet';
import { BillReminderDetailSheet } from '@/components/calendar/bill-reminder-detail-sheet';
import { QuickAddTask } from '@/components/quick-add-task';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Theme } from '@/components/theme-toggle';
import { Toggle } from '@/components/ui/toggle';
import { Separator } from '@/components/ui/separator';

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toOptionalDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  return toDate(value);
}

type EventWithRecurrence = Event & { recurrenceRule?: string | null };

function addMonthsToDate(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function resolveRecurrenceWindow(rule: ReturnType<typeof parseRRule>, baseStartAt: Date) {
  const now = new Date();
  const lookBack = addMonthsToDate(now, -1);

  if (rule.options.until || rule.options.count) {
    const rangeStart = baseStartAt;
    let rangeEnd = baseStartAt;

    if (rule.options.until) {
      rangeEnd = new Date(rule.options.until);
    } else if (rule.options.count) {
      const all = rule.all();
      rangeEnd = all[all.length - 1] ?? baseStartAt;
    }

    if (rangeEnd < rangeStart) {
      rangeEnd = rangeStart;
    }

    return { rangeStart, rangeEnd };
  }

  const anchor = baseStartAt > now ? baseStartAt : now;
  const rangeStart = baseStartAt > now ? baseStartAt : lookBack;
  const rangeEnd = addMonthsToDate(anchor, 6);

  return { rangeStart, rangeEnd };
}

export default function CalendarPage() {
  const eventsService = useState(() => createEventsServicePlugin())[0];
  const [events, setEvents] = useState<EventWithRecurrence[]>([]);
  const [tasks, setTasks] = useState<TaskWithRecurrence[]>([]);
  const [billReminders, setBillReminders] = useState<BillReminder[]>([]);
  const [timeZone, setTimeZone] = useState(() => getBrowserTimeZone());

  // Simple toggle filters
  const [showEvents, setShowEvents] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showBillReminders, setShowBillReminders] = useState(true);
  const [hideCompleted, setHideCompleted] = useState(false);

  // Event state
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editEventDialogOpen, setEditEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  // Task state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editTaskDialogOpen, setEditTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Bill Reminder state
  const [billReminderSheetOpen, setBillReminderSheetOpen] = useState(false);
  const [selectedBillReminder, setSelectedBillReminder] = useState<BillReminder | null>(null);

  // Shared state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [detailSheetData, setDetailSheetData] = useState<{
    id: number;
    title: string;
    description?: string | null;
    location?: string | null;
    startAt: Date;
    endAt: Date;
    isAllDay?: boolean;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: string;
    type: 'event' | 'task';
    durationMinutes?: number | null;
  } | null>(null);
  const eventsRef = useRef<EventWithRecurrence[]>([]);
  const tasksRef = useRef<TaskWithRecurrence[]>([]);
  const billRemindersRef = useRef<BillReminder[]>([]);
  const occurrenceOverridesRef = useRef(new Map<string, { startAt: Date; endAt: Date }>());
  const t = useTranslations('calendar');
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const [theme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('theme') as Theme | null) || 'system';
  });
  const prefersDark = typeof window === 'undefined' ? false : window.matchMedia('(prefers-color-scheme: dark)').matches;

  const loadData = useCallback(async () => {
    setIsLoading(true);

    try {
      const [eventsData, tasksData, billRemindersData, settings] = await Promise.all([
        getEventsWithRecurrence(),
        getTasksWithRecurrence(),
        getActiveBillReminders(),
        getUserSettings(),
      ]);
      setTimeZone(resolveTimeZone(settings));

      // Normalize events
      const normalizedEvents = eventsData.map((event) => ({
        ...event,
        recurrenceRule: event.recurrenceRule ?? null,
        startAt: toDate(event.startAt),
        endAt: toDate(event.endAt),
        createdAt: toOptionalDate(event.createdAt),
        updatedAt: toOptionalDate(event.updatedAt),
      }));
      eventsRef.current = normalizedEvents;
      setEvents(normalizedEvents);

      // Normalize tasks
      const normalizedTasks = tasksData.map((task) => ({
        ...task,
        recurrenceRule: task.recurrenceRule ?? null,
        dueAt: toDate(task.dueAt),
        startAt: task.startAt ? toDate(task.startAt) : null,
        completedAt: toOptionalDate(task.completedAt),
        createdAt: toOptionalDate(task.createdAt),
        updatedAt: toOptionalDate(task.updatedAt),
      }));
      tasksRef.current = normalizedTasks;
      setTasks(normalizedTasks);

      // Set bill reminders
      billRemindersRef.current = billRemindersData;
      setBillReminders(billRemindersData);
    } catch (error) {
      console.error('[calendar:loadData] Failed:', error);
      toast.error(tErrors('failedToLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [tErrors]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCalendarEventClick = useCallback((calendarEvent: { id: string | number; calendarId?: string }) => {
    const idStr = String(calendarEvent.id);

    // Parse item type and ID from calendar event ID
    if (idStr.startsWith('event-')) {
      const match = /^event-(\d+)/.exec(idStr);
      if (!match) return;
      const parsedId = Number(match[1]);
      if (Number.isNaN(parsedId)) return;

      const event = eventsRef.current.find((item) => item.id === parsedId);
      if (!event) return;

      const occurrenceOverride = occurrenceOverridesRef.current.get(idStr);
      const startAt = occurrenceOverride?.startAt ?? event.startAt;
      const endAt = occurrenceOverride?.endAt ?? event.endAt;

      setDetailSheetData({
        id: event.id,
        title: event.title,
        description: event.description,
        location: event.location,
        startAt,
        endAt,
        isAllDay: event.isAllDay,
        priority: event.priority,
        status: event.status,
        type: 'event',
      });
      setDetailSheetOpen(true);
    } else if (idStr.startsWith('task-')) {
      const match = /^task-(\d+)/.exec(idStr);
      if (!match) return;
      const parsedId = Number(match[1]);
      if (Number.isNaN(parsedId)) return;

      const task = tasksRef.current.find((item) => item.id === parsedId);
      if (!task) return;

      const occurrenceOverride = occurrenceOverridesRef.current.get(idStr);
      const startAt = occurrenceOverride?.startAt ?? (task.startAt || task.dueAt);
      const endAt = occurrenceOverride?.endAt ?? task.dueAt;

      setDetailSheetData({
        id: task.id,
        title: task.title,
        description: task.description,
        location: task.location,
        startAt,
        endAt,
        priority: task.priority,
        status: task.status,
        type: 'task',
        durationMinutes: task.durationMinutes,
      });
      setDetailSheetOpen(true);
    } else if (idStr.startsWith('bill-reminder-')) {
      const match = /^bill-reminder-(\d+)/.exec(idStr);
      if (!match) return;
      const parsedId = Number(match[1]);
      if (Number.isNaN(parsedId)) return;

      const reminder = billRemindersRef.current.find((item) => item.id === parsedId);
      if (!reminder) return;

      setSelectedBillReminder(reminder);
      setBillReminderSheetOpen(true);
    }
  }, []);

  function handleEditEventOpenChange(open: boolean) {
    setEditEventDialogOpen(open);
    if (!open) {
      setSelectedEvent(null);
    }
  }

  function handleEditTaskOpenChange(open: boolean) {
    setEditTaskDialogOpen(open);
    if (!open) {
      setSelectedTask(null);
    }
  }

  function handleDeleteDialogOpenChange(open: boolean) {
    setDeleteDialogOpen(open);
    if (!open) {
      setDeleteTarget(null);
      setDeleteError(null);
      setIsDeleting(false);
    }
  }

  function requestDelete(target: { id: number; title: string }) {
    setDeleteError(null);
    setDeleteTarget(target);
    setDeleteDialogOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      // Determine item type from detail sheet data
      const isTask = detailSheetData?.type === 'task';
      const result = isTask
        ? await deleteTask(deleteTarget.id)
        : await deleteEvent(deleteTarget.id);

      if (!result.success) {
        setDeleteError(result.error);
        return;
      }

      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setSelectedEvent(null);
      setSelectedTask(null);
      await loadData();
    } catch (error) {
      console.error('[Calendar] Delete failed:', error);
      setDeleteError(tCommon('unexpectedError'));
    } finally {
      setIsDeleting(false);
    }
  }

  // Handlers for detail sheet actions
  const handleDetailSheetEdit = useCallback(() => {
    if (!detailSheetData) return;

    if (detailSheetData.type === 'event') {
      const event = eventsRef.current.find((e) => e.id === detailSheetData.id);
      if (!event) return;
      setSelectedEvent(event);
      setEditEventDialogOpen(true);
    } else if (detailSheetData.type === 'task') {
      const task = tasksRef.current.find((t) => t.id === detailSheetData.id);
      if (!task) return;
      setSelectedTask(task);
      setEditTaskDialogOpen(true);
    }
  }, [detailSheetData]);

  const handleDetailSheetDelete = useCallback(() => {
    if (!detailSheetData) return;

    requestDelete({
      id: detailSheetData.id,
      title: detailSheetData.title,
    });
  }, [detailSheetData]);

  // Handlers for custom event item context menu
  const handleEventItemEdit = useCallback((id: number, itemType?: string) => {
    if (itemType === 'task') {
      handleCalendarEventClick({ id: `task-${id}`, calendarId: 'tasks' });
    } else {
      handleCalendarEventClick({ id: `event-${id}`, calendarId: 'events' });
    }
  }, [handleCalendarEventClick]);

  const handleEventItemDelete = useCallback((id: number, itemType?: string) => {
    if (itemType === 'task') {
      const item = tasksRef.current.find((t) => t.id === id);
      if (!item) return;
      requestDelete({ id, title: item.title });
    } else {
      const item = eventsRef.current.find((e) => e.id === id);
      if (!item) return;
      requestDelete({ id, title: item.title });
    }
  }, []);

  // Handler for bill reminder clicks
  const handleBillReminderClick = useCallback((id: number) => {
    const reminder = billRemindersRef.current.find((r) => r.id === id);
    if (!reminder) return;
    setSelectedBillReminder(reminder);
    setBillReminderSheetOpen(true);
  }, []);

  // Custom event item components for each view
  const CustomMonthAgendaEventItem = useCallback(({ calendarEvent }: { calendarEvent: CalendarEvent }) => {
    return (
      <MonthAgendaEventItem
        calendarEvent={calendarEvent}
        onEdit={handleEventItemEdit}
        onDelete={handleEventItemDelete}
        onBillReminderClick={handleBillReminderClick}
      />
    );
  }, [handleEventItemEdit, handleEventItemDelete, handleBillReminderClick]);

  const CustomWeekEventItem = useCallback(({ calendarEvent }: { calendarEvent: CalendarEvent }) => {
    return (
      <WeekEventItem
        calendarEvent={calendarEvent}
        onEdit={handleEventItemEdit}
        onDelete={handleEventItemDelete}
        onBillReminderClick={handleBillReminderClick}
      />
    );
  }, [handleEventItemEdit, handleEventItemDelete, handleBillReminderClick]);

  const CustomDayEventItem = useCallback(({ calendarEvent }: { calendarEvent: CalendarEvent }) => {
    return (
      <DayEventItem
        calendarEvent={calendarEvent}
        onEdit={handleEventItemEdit}
        onDelete={handleEventItemDelete}
        onBillReminderClick={handleBillReminderClick}
      />
    );
  }, [handleEventItemEdit, handleEventItemDelete, handleBillReminderClick]);

  const CustomMonthGridEventItem = useCallback(({ calendarEvent }: { calendarEvent: CalendarEvent }) => {
    return (
      <MonthGridEventItem
        calendarEvent={calendarEvent}
        onEdit={handleEventItemEdit}
        onBillReminderClick={handleBillReminderClick}
      />
    );
  }, [handleEventItemEdit, handleBillReminderClick]);

  // Filter and combine all item types
  const filteredItems = useMemo(() => {
    const filteredEventsList = showEvents ? events.filter((event) => {
      if (hideCompleted && event.status === 'completed') return false;
      return true;
    }) : [];

    const filteredTasksList = showTasks ? tasks.filter((task) => {
      if (hideCompleted && task.status === 'completed') return false;
      return true;
    }) : [];

    return {
      events: filteredEventsList,
      tasks: filteredTasksList,
      billReminders: showBillReminders ? billReminders : [],
    };
  }, [events, tasks, billReminders, showEvents, showTasks, showBillReminders, hideCompleted]);

  const scheduleData = useMemo(() => {
    const occurrenceOverrides = new Map<string, { startAt: Date; endAt: Date }>();

    // Build event schedule events
    const buildScheduleEvent = (event: EventWithRecurrence, id: string, startAt: Date, endAt: Date) => {
      occurrenceOverrides.set(id, { startAt, endAt });
      return {
        id,
        title: event.title,
        start: toZonedDateTime(startAt, timeZone),
        end: toZonedDateTime(endAt, timeZone),
        calendarId: 'events',
        description: event.description || undefined,
        location: event.location || undefined,
        priority: event.priority,
        status: event.status,
        itemType: 'event' as const,
        itemId: event.id,
        isAllDay: event.isAllDay,
      };
    };

    const eventScheduleEvents = filteredItems.events.flatMap((event) => {
      const baseStartAt = toDate(event.startAt);
      const baseEndAt = toDate(event.endAt);
      const baseId = `event-${event.id}`;

      if (!event.recurrenceRule) {
        return [buildScheduleEvent(event, baseId, baseStartAt, baseEndAt)];
      }

      let rule: ReturnType<typeof parseRRule>;
      try {
        rule = parseRRule(event.recurrenceRule, { dtstart: baseStartAt });
      } catch (error) {
        console.error('[Calendar] Invalid event recurrence rule:', {
          eventId: event.id,
          rrule: event.recurrenceRule,
          error,
        });
        return [buildScheduleEvent(event, baseId, baseStartAt, baseEndAt)];
      }

      const { rangeStart, rangeEnd } = resolveRecurrenceWindow(rule, baseStartAt);
      const occurrences = rule.between(rangeStart, rangeEnd, true);

      if (occurrences.length === 0) {
        return [buildScheduleEvent(event, baseId, baseStartAt, baseEndAt)];
      }

      const durationMs = baseEndAt.getTime() - baseStartAt.getTime();
      return occurrences.map((occurrence) => {
        const startAt = new Date(occurrence);
        const endAt = new Date(startAt.getTime() + durationMs);
        const occurrenceId = `event-${event.id}-occ-${startAt.getTime()}`;
        return buildScheduleEvent(event, occurrenceId, startAt, endAt);
      });
    });

    // Build task schedule using existing helper
    const { scheduleEvents: taskScheduleEvents } = buildTaskSchedule(
      filteredItems.tasks,
      timeZone
    );

    // Build bill reminder schedule using existing helper
    const now = new Date();
    const viewStart = addMonthsToDate(now, -1);
    const viewEnd = addMonthsToDate(now, 6);
    const { scheduleEvents: billReminderScheduleEvents } = buildBillReminderSchedule(
      filteredItems.billReminders,
      timeZone,
      viewStart,
      viewEnd
    );

    const allScheduleEvents = [
      ...eventScheduleEvents,
      ...taskScheduleEvents,
      ...billReminderScheduleEvents,
    ];

    return { scheduleEvents: allScheduleEvents, occurrenceOverrides };
  }, [filteredItems, timeZone]);

  useEffect(() => {
    occurrenceOverridesRef.current = scheduleData.occurrenceOverrides;
  }, [scheduleData.occurrenceOverrides]);

  const calendar = useNextCalendarApp({
    theme: 'shadcn',
    views: [createViewMonthAgenda(), createViewDay(), createViewWeek(), createViewMonthGrid()],
    events: scheduleData.scheduleEvents,
    plugins: [eventsService],
    timezone: timeZone,
    isDark: theme === 'dark' || (theme === 'system' && prefersDark),
    isResponsive: true,
    dayBoundaries: {
      start: '06:00',
      end: '23:00',
    },
    calendars: {
      events: {
        colorName: 'events',
        lightColors: {
          main: 'oklch(0.60 0.20 250)',
          container: 'oklch(0.95 0.05 250)',
          onContainer: 'oklch(0.40 0.20 250)',
        },
        darkColors: {
          main: 'oklch(0.70 0.20 250)',
          container: 'oklch(0.30 0.15 250)',
          onContainer: 'oklch(0.95 0.05 250)',
        },
      },
      tasks: {
        colorName: 'tasks',
        lightColors: {
          main: 'oklch(0.65 0.15 145)',
          container: 'oklch(0.95 0.10 145)',
          onContainer: 'oklch(0.40 0.15 145)',
        },
        darkColors: {
          main: 'oklch(0.75 0.15 145)',
          container: 'oklch(0.35 0.10 145)',
          onContainer: 'oklch(0.95 0.05 145)',
        },
      },
      'bill-reminders': {
        colorName: 'bill-reminders',
        lightColors: {
          main: 'oklch(0.70 0.15 85)',
          container: 'oklch(0.95 0.10 85)',
          onContainer: 'oklch(0.40 0.15 85)',
        },
        darkColors: {
          main: 'oklch(0.80 0.15 85)',
          container: 'oklch(0.35 0.10 85)',
          onContainer: 'oklch(0.95 0.05 85)',
        },
      },
    },
    callbacks: {
      onEventClick: (event) => handleCalendarEventClick(event),
    },
  });

  useEffect(() => {
    if (!calendar) return;
    eventsService.set(scheduleData.scheduleEvents);
  }, [calendar, eventsService, scheduleData.scheduleEvents]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6 flex-col md:flex-row space-y-4 md:space-y-0">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex gap-2 w-full justify-start md:justify-end flex-col md:flex-row">
          <QuickAddTask defaultType="event" onSuccess={loadData} />

          <div className='flex flex-row justify-center w-full md:w-auto space-x-4 md:justify-end'>
            <AlertDialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="hollow">{t('addEvent')}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('addEvent')}</AlertDialogTitle>
                </AlertDialogHeader>
                <EventForm onSuccess={() => { setEventDialogOpen(false); loadData(); }} />
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="hollow">{t('addTask')}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('addTask')}</AlertDialogTitle>
                </AlertDialogHeader>
                <TaskForm onSuccess={() => { setTaskDialogOpen(false); loadData(); }} />
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <AlertDialog open={editEventDialogOpen} onOpenChange={handleEditEventOpenChange}>
            <AlertDialogContent closeOnBackdropClick>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('editEvent')}</AlertDialogTitle>
              </AlertDialogHeader>
              {selectedEvent && (
                <>
                  <EventForm
                    key={`event-${selectedEvent.id}`}
                    event={selectedEvent}
                    onSuccess={() => {
                      setEditEventDialogOpen(false);
                      setSelectedEvent(null);
                      loadData();
                    }}
                  />
                  <div className="flex justify-end border-t border-border pt-3">
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={() => {
                        setEditEventDialogOpen(false);
                        requestDelete({
                          id: selectedEvent.id,
                          title: selectedEvent.title,
                        });
                      }}
                    >
                      {tCommon('delete')}
                    </Button>
                  </div>
                </>
              )}
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="mb-4 gap-2 flex flex-wrap items-center">
        <Toggle pressed={showEvents} onPressedChange={setShowEvents} aria-label={t('filter.events')}>
          <span className="w-2 h-2 rounded-full bg-[oklch(0.60_0.20_250)] dark:bg-[oklch(0.70_0.20_250)] mr-2" />
          {t('filter.events')}
        </Toggle>
        <Toggle pressed={showTasks} onPressedChange={setShowTasks} aria-label={t('filter.tasks')}>
          <span className="w-2 h-2 rounded-full bg-[oklch(0.65_0.15_145)] dark:bg-[oklch(0.75_0.15_145)] mr-2" />
          {t('filter.tasks')}
        </Toggle>
        <Toggle pressed={showBillReminders} onPressedChange={setShowBillReminders} aria-label={t('filter.billReminders')}>
          <span className="w-2 h-2 rounded-full bg-[oklch(0.70_0.15_85)] dark:bg-[oklch(0.80_0.15_85)] mr-2" />
          {t('filter.billReminders')}
        </Toggle>
        <Separator orientation="vertical" className="h-6 mx-2" />
        <Toggle pressed={hideCompleted} onPressedChange={setHideCompleted} aria-label={t('filter.hideCompleted')}>
          {t('filter.hideCompleted')}
        </Toggle>
      </div>

      {isLoading ? (
        <div className="bg-background rounded-lg border border-border p-4 flex items-center justify-center min-h-96">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-500"></div>
            <p className="mt-4 text-sm text-muted-foreground">{t('loading')}</p>
          </div>
        </div>
      ) : (
        <div className="bg-background border border-border -mx-4">
          <ScheduleXCalendar calendarApp={calendar} customComponents={{
            monthAgendaEvent: CustomMonthAgendaEventItem,
            timeGridEvent: CustomWeekEventItem,
            dateGridEvent: CustomDayEventItem,
            monthGridEvent: CustomMonthGridEventItem
          }} />
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={handleDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('deleteEventTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.title}
              <span className="block mt-2">{tCommon('actionCannotBeUndone')}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {deleteError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {deleteError}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{tCommon('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDeleteConfirm();
              }}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting ? tCommon('deleting') : tCommon('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Task Dialog */}
      <AlertDialog open={editTaskDialogOpen} onOpenChange={handleEditTaskOpenChange}>
        <AlertDialogContent closeOnBackdropClick>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('editTask')}</AlertDialogTitle>
          </AlertDialogHeader>
          {selectedTask && (
            <>
              <TaskForm
                key={`task-${selectedTask.id}`}
                task={selectedTask}
                onSuccess={() => {
                  setEditTaskDialogOpen(false);
                  setSelectedTask(null);
                  loadData();
                }}
              />
              <div className="flex justify-end border-t border-border pt-3">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setEditTaskDialogOpen(false);
                    requestDelete({
                      id: selectedTask.id,
                      title: selectedTask.title,
                    });
                  }}
                >
                  {tCommon('delete')}
                </Button>
              </div>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>

      {/* Event Detail Sheet */}
      <EventDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        event={detailSheetData}
        timeZone={timeZone}
        onEdit={handleDetailSheetEdit}
        onDelete={handleDetailSheetDelete}
      />

      {/* Bill Reminder Detail Sheet */}
      <BillReminderDetailSheet
        open={billReminderSheetOpen}
        onOpenChange={setBillReminderSheetOpen}
        reminder={selectedBillReminder}
      />
    </div>
  );
}
