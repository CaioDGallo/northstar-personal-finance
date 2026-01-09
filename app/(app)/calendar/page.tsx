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
import { getUserSettings } from '@/lib/actions/user-settings';
import { type Event } from '@/lib/schema';
import { parseRRule } from '@/lib/recurrence';
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
import { MonthAgendaEventItem } from '@/components/calendar/month-agenda-event-item';
import { EventDetailSheet } from '@/components/calendar/event-detail-sheet';
import { QuickAddTask } from '@/components/quick-add-task';
import { useTranslations } from 'next-intl';
import { Theme } from '@/components/theme-toggle';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Clock01Icon,
  Flag01Icon,
  Alert01Icon,
  CircleIcon,
  Tick02Icon,
} from '@hugeicons/core-free-icons';

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
  const [timeZone, setTimeZone] = useState(() => getBrowserTimeZone());
  const [statusFilters, setStatusFilters] = useState({
    scheduled: true,
    completed: true,
  });
  const [priorityFilters, setPriorityFilters] = useState({
    low: true,
    medium: true,
    high: true,
    critical: true,
  });

  const toggleStatus = (key: 'scheduled' | 'completed') => {
    setStatusFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePriority = (key: 'low' | 'medium' | 'high' | 'critical') => {
    setPriorityFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editEventDialogOpen, setEditEventDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
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
  const occurrenceOverridesRef = useRef(new Map<string, { startAt: Date; endAt: Date }>());
  const t = useTranslations('calendar');
  const tCommon = useTranslations('common');
  const [theme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('theme') as Theme | null) || 'system';
  });
  const prefersDark = typeof window === 'undefined' ? false : window.matchMedia('(prefers-color-scheme: dark)').matches;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [eventsData, settings] = await Promise.all([
      getEventsWithRecurrence(),
      getUserSettings(),
    ]);
    setTimeZone(resolveTimeZone(settings));
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
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCalendarEventClick = useCallback((calendarEvent: { id: string | number; calendarId?: string }) => {
    function parseCalendarId(id: string | number) {
      const raw = typeof id === 'number' ? `event-${id}` : id;
      const match = /^event-(\d+)/.exec(raw);
      if (!match) return null;
      const parsed = Number(match[1]);
      return Number.isNaN(parsed) ? null : parsed;
    }

    const parsedId = parseCalendarId(calendarEvent.id);
    if (parsedId === null) return;

    const event = eventsRef.current.find((item) => item.id === parsedId);
    if (!event) return;
    const eventKey = typeof calendarEvent.id === 'number' ? `event-${calendarEvent.id}` : calendarEvent.id;
    const occurrenceOverride = occurrenceOverridesRef.current.get(eventKey);
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
  }, []);

  function handleEditEventOpenChange(open: boolean) {
    setEditEventDialogOpen(open);
    if (!open) {
      setSelectedEvent(null);
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
      const result = await deleteEvent(deleteTarget.id);

      if (!result.success) {
        setDeleteError(result.error);
        return;
      }

      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setSelectedEvent(null);
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

    const event = eventsRef.current.find((e) => e.id === detailSheetData.id);
    if (!event) return;
    setSelectedEvent(event);
    setEditEventDialogOpen(true);
  }, [detailSheetData]);

  const handleDetailSheetDelete = useCallback(() => {
    if (!detailSheetData) return;

    requestDelete({
      id: detailSheetData.id,
      title: detailSheetData.title,
    });
  }, [detailSheetData]);

  // Handlers for custom event item context menu
  const handleEventItemEdit = useCallback((id: number) => {
    handleCalendarEventClick({ id: `event-${id}`, calendarId: 'events' });
  }, [handleCalendarEventClick]);

  const handleEventItemDelete = useCallback((id: number) => {
    const item = eventsRef.current.find((e) => e.id === id);

    if (!item) return;

    requestDelete({
      id,
      title: item.title,
    });
  }, []);

  // Custom event item component for month agenda view
  const CustomNorthstarEventItem = useCallback(({ calendarEvent }: { calendarEvent: CalendarEvent }) => {
    return (
      <MonthAgendaEventItem
        calendarEvent={calendarEvent}
        onEdit={handleEventItemEdit}
        onDelete={handleEventItemDelete}
      />
    );
  }, [handleEventItemEdit, handleEventItemDelete]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Status filter
      const statusMatch =
        (event.status === 'scheduled' && statusFilters.scheduled) ||
        (event.status === 'completed' && statusFilters.completed);
      if (!statusMatch) return false;

      // Priority filter
      if (!priorityFilters[event.priority]) return false;

      return true;
    });
  }, [events, statusFilters, priorityFilters]);

  const scheduleData = useMemo(() => {
    const occurrenceOverrides = new Map<string, { startAt: Date; endAt: Date }>();

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

    const scheduleEvents = filteredEvents.flatMap((event) => {
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
        console.error('[Calendar] Invalid recurrence rule:', {
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

    return { scheduleEvents, occurrenceOverrides };
  }, [filteredEvents, timeZone]);

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
        <div className="flex gap-2 w-full justify-start md:justify-end">
          <QuickAddTask defaultType="event" onSuccess={loadData} />
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

      <div className="mb-4 gap-4 flex flex-col md:flex-row space-x-0 md:space-x-4">
        {/* Status Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground inline min-w-[60px]">
            {t('statusLabel')}:
          </span>
          <div className="flex gap-2">
            <Button
              variant={statusFilters.scheduled ? 'popout' : 'hollow'}
              size="icon-sm"
              onClick={() => toggleStatus('scheduled')}
              aria-label={t('status.scheduled')}
              aria-pressed={statusFilters.scheduled}
              title={t('status.scheduled')}
              className='p-4'
            >
              <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} />
            </Button>
            <Button
              variant={statusFilters.completed ? 'popout' : 'hollow'}
              size="icon-sm"
              onClick={() => toggleStatus('completed')}
              aria-label={t('status.completed')}
              aria-pressed={statusFilters.completed}
              title={t('status.completed')}
              className='p-4'
            >
              <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
            </Button>
          </div>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground inline min-w-[60px]">
            {t('priorityLabel')}:
          </span>
          <div className="flex gap-2">
            <Button
              variant={priorityFilters.low ? 'popout' : 'hollow'}
              size="icon-sm"
              onClick={() => togglePriority('low')}
              aria-label={t('priority.low')}
              aria-pressed={priorityFilters.low}
              title={t('priority.low')}
              className={'text-muted-foreground p-4'}
            >
              <HugeiconsIcon icon={CircleIcon} strokeWidth={2} />
            </Button>
            <Button
              variant={priorityFilters.medium ? 'popout' : 'hollow'}
              size="icon-sm"
              onClick={() => togglePriority('medium')}
              aria-label={t('priority.medium')}
              aria-pressed={priorityFilters.medium}
              title={t('priority.medium')}
              className={'text-blue-600 p-4'}
            >
              <HugeiconsIcon icon={Flag01Icon} strokeWidth={2} />
            </Button>
            <Button
              variant={priorityFilters.high ? 'popout' : 'hollow'}
              size="icon-sm"
              onClick={() => togglePriority('high')}
              aria-label={t('priority.high')}
              aria-pressed={priorityFilters.high}
              title={t('priority.high')}
              className={'text-orange-600 p-4'}
            >
              <HugeiconsIcon icon={Flag01Icon} strokeWidth={2} />
            </Button>
            <Button
              variant={priorityFilters.critical ? 'popout' : 'hollow'}
              size="icon-sm"
              onClick={() => togglePriority('critical')}
              aria-label={t('priority.critical')}
              aria-pressed={priorityFilters.critical}
              title={t('priority.critical')}
              className={'text-red-600 p-4'}
            >
              <HugeiconsIcon icon={Alert01Icon} strokeWidth={2} />
            </Button>
          </div>
        </div>
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
            monthAgendaEvent: CustomNorthstarEventItem
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

      {/* Event Detail Sheet */}
      <EventDetailSheet
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        event={detailSheetData}
        timeZone={timeZone}
        onEdit={handleDetailSheetEdit}
        onDelete={handleDetailSheetDelete}
      />
    </div>
  );
}
