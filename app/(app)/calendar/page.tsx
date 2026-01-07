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
import { deleteEvent, getEvents } from '@/lib/actions/events';
import { deleteTask, getTasks } from '@/lib/actions/tasks';
import { getUserSettings } from '@/lib/actions/user-settings';
import { type Event, type Task, type UserSettings } from '@/lib/schema';
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
import { useTranslations } from 'next-intl';
import { Theme } from '@/components/theme-toggle';
import { createEventModalPlugin } from '@schedule-x/event-modal';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Calendar03Icon,
  Tick02Icon,
  Clock01Icon,
  Loading03Icon,
  Flag01Icon,
  Alert01Icon,
  CircleIcon,
} from '@hugeicons/core-free-icons';

const eventModal = createEventModalPlugin()

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toOptionalDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  return toDate(value);
}

function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function resolveTimeZone(settings?: UserSettings | null): string {
  const browserTimeZone = getBrowserTimeZone();
  if (!settings?.timezone) return browserTimeZone;
  if (settings.timezone === 'UTC' && browserTimeZone !== 'UTC') {
    return browserTimeZone;
  }
  return settings.timezone;
}

function toZonedDateTime(date: Date, timeZone: string) {
  return Temporal.Instant.from(date.toISOString()).toZonedDateTimeISO(timeZone);
}

const CustomNorthstarEventItem = ({ calendarEvent }: { calendarEvent: CalendarEvent }) => {
  return <div>{calendarEvent.title}</div>
}

export default function CalendarPage() {
  const eventsService = useState(() => createEventsServicePlugin())[0];
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeZone, setTimeZone] = useState(() => getBrowserTimeZone());
  const [filterType, setFilterType] = useState<'event' | 'task'>('event');
  const [statusFilters, setStatusFilters] = useState({
    pending: true,
    inProgress: true,
    completed: true,
  });
  const [priorityFilters, setPriorityFilters] = useState({
    low: true,
    medium: true,
    high: true,
    critical: true,
  });

  const toggleStatus = (key: 'pending' | 'inProgress' | 'completed') => {
    setStatusFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePriority = (key: 'low' | 'medium' | 'high' | 'critical') => {
    setPriorityFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editEventDialogOpen, setEditEventDialogOpen] = useState(false);
  const [editTaskDialogOpen, setEditTaskDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'event' | 'task';
    id: number;
    title: string;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const eventsRef = useRef<Event[]>([]);
  const tasksRef = useRef<Task[]>([]);
  const t = useTranslations('calendar');
  const tCommon = useTranslations('common');
  const [theme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('theme') as Theme | null) || 'system';
  });
  const prefersDark = typeof window === 'undefined' ? false : window.matchMedia('(prefers-color-scheme: dark)').matches;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [eventsData, tasksData, settings] = await Promise.all([
      getEvents(),
      getTasks(),
      getUserSettings(),
    ]);
    setTimeZone(resolveTimeZone(settings));
    const normalizedEvents = eventsData.map((event) => ({
      ...event,
      startAt: toDate(event.startAt),
      endAt: toDate(event.endAt),
      createdAt: toOptionalDate(event.createdAt),
      updatedAt: toOptionalDate(event.updatedAt),
    }));
    const normalizedTasks = tasksData.map((task) => ({
      ...task,
      dueAt: toDate(task.dueAt),
      startAt: toOptionalDate(task.startAt),
      completedAt: toOptionalDate(task.completedAt),
      createdAt: toOptionalDate(task.createdAt),
      updatedAt: toOptionalDate(task.updatedAt),
    }));
    eventsRef.current = normalizedEvents;
    tasksRef.current = normalizedTasks;
    setEvents(normalizedEvents);
    setTasks(normalizedTasks);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function parseCalendarId(id: string | number) {
    if (typeof id === 'number') return id;
    const parsed = Number(id.replace(/^event-/, '').replace(/^task-/, ''));
    return Number.isNaN(parsed) ? null : parsed;
  }

  function handleCalendarEventClick(calendarEvent: { id: string | number; calendarId?: string }) {
    const parsedId = parseCalendarId(calendarEvent.id);
    if (parsedId === null) return;
    const inferredCalendarId = (() => {
      if (calendarEvent.calendarId) return calendarEvent.calendarId;
      if (typeof calendarEvent.id === 'string') {
        if (calendarEvent.id.startsWith('event-')) return 'events';
        if (calendarEvent.id.startsWith('task-')) return 'tasks';
      }
      return undefined;
    })();

    if (inferredCalendarId === 'events') {
      const event = eventsRef.current.find((item) => item.id === parsedId);
      if (!event) return;
      setSelectedEvent(event);
      setEditEventDialogOpen(true);
      return;
    }

    if (inferredCalendarId === 'tasks') {
      const task = tasksRef.current.find((item) => item.id === parsedId);
      if (!task) return;
      setSelectedTask(task);
      setEditTaskDialogOpen(true);
    }
  }

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

  function requestDelete(target: { type: 'event' | 'task'; id: number; title: string }) {
    setDeleteError(null);
    setDeleteTarget(target);
    setDeleteDialogOpen(true);
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = deleteTarget.type === 'event'
        ? await deleteEvent(deleteTarget.id)
        : await deleteTask(deleteTarget.id);

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

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      // Type filter
      if (filterType === 'task') return false;

      // Status filter - map event statuses to our 3 categories
      const statusMatch =
        (event.status === 'scheduled' && statusFilters.pending) ||
        (event.status === 'completed' && statusFilters.completed);
      if (!statusMatch) return false;

      // Priority filter
      if (!priorityFilters[event.priority]) return false;

      return true;
    });
  }, [events, filterType, statusFilters, priorityFilters]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Type filter
      if (filterType === 'event') return false;

      // Status filter
      const statusMatch =
        (task.status === 'pending' && statusFilters.pending) ||
        (task.status === 'in_progress' && statusFilters.inProgress) ||
        (task.status === 'completed' && statusFilters.completed);
      if (!statusMatch) return false;

      // Priority filter
      if (!priorityFilters[task.priority]) return false;

      return true;
    });
  }, [tasks, filterType, statusFilters, priorityFilters]);

  const scheduleEvents = useMemo(() => {
    return [
      ...filteredEvents.map((event) => {
        const startAt = toDate(event.startAt);
        const endAt = toDate(event.endAt);

        return {
          id: `event-${event.id}`,
          title: event.title,
          start: toZonedDateTime(startAt, timeZone),
          end: toZonedDateTime(endAt, timeZone),
          calendarId: 'events',
          description: event.description || undefined,
          location: event.location || undefined,
        };
      }),
      ...filteredTasks.map((task) => {
        let startDate: Date;
        let endDate: Date;

        if (task.startAt && task.durationMinutes) {
          const taskStart = toDate(task.startAt);
          startDate = taskStart;
          endDate = new Date(taskStart.getTime() + task.durationMinutes * 60 * 1000);
        } else {
          const taskDue = toDate(task.dueAt);
          startDate = taskDue;
          endDate = taskDue;
        }

        return {
          id: `task-${task.id}`,
          title: task.title,
          start: toZonedDateTime(startDate, timeZone),
          end: toZonedDateTime(endDate, timeZone),
          calendarId: 'tasks',
          description: task.description || undefined,
          location: task.location || undefined,
        };
      }),
    ];
  }, [filteredEvents, filteredTasks, timeZone]);

  const calendar = useNextCalendarApp({
    theme: 'shadcn',
    views: [createViewDay(), createViewWeek(), createViewMonthGrid(), createViewMonthAgenda()],
    events: scheduleEvents,
    plugins: [eventsService, eventModal],
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
      tasks: {
        colorName: 'tasks',
        lightColors: {
          main: 'oklch(0.65 0.15 145)',
          container: 'oklch(0.95 0.10 145)',
          onContainer: 'oklch(0.40 0.15 145)',
        },
        darkColors: {
          main: 'oklch(0.75 0.15 145)',
          container: 'oklch(0.30 0.10 145)',
          onContainer: 'oklch(0.95 0.10 145)',
        },
      },
    },
    callbacks: {
      // onEventClick: (event) => handleCalendarEventClick(event),
    },
  });

  useEffect(() => {
    if (!calendar) return;
    eventsService.set(scheduleEvents);
  }, [calendar, eventsService, scheduleEvents]);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6 flex-col md:flex-row space-y-4 md:space-y-0">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <div className="flex gap-2">
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

          <AlertDialog open={editEventDialogOpen} onOpenChange={handleEditEventOpenChange}>
            <AlertDialogContent>
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
                          type: 'event',
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

          <AlertDialog open={editTaskDialogOpen} onOpenChange={handleEditTaskOpenChange}>
            <AlertDialogContent>
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
                          type: 'task',
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
        </div>
      </div>

      <div className="mb-4 space-y-3">
        {/* Type Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground hidden md:inline min-w-[60px]">
            {t('type')}:
          </span>
          <div className="flex gap-1 border border-border rounded-md p-1 bg-background">
            <Button
              variant={filterType === 'event' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterType('event')}
              className="gap-1.5"
            >
              <HugeiconsIcon icon={Calendar03Icon} />
              <span className="hidden xs:inline">{t('events')}</span>
            </Button>
            <Button
              variant={filterType === 'task' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilterType('task')}
              className="gap-1.5"
            >
              <HugeiconsIcon icon={Tick02Icon} />
              <span className="hidden xs:inline">{t('tasks')}</span>
            </Button>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground hidden md:inline min-w-[60px]">
            {t('status')}:
          </span>
          <div className="flex gap-2">
            <Button
              variant={statusFilters.pending ? 'default' : 'outline'}
              size="icon-sm"
              onClick={() => toggleStatus('pending')}
              aria-label={t('status.pending')}
              aria-pressed={statusFilters.pending}
              title={t('status.pending')}
            >
              <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} />
            </Button>
            <Button
              variant={statusFilters.inProgress ? 'default' : 'outline'}
              size="icon-sm"
              onClick={() => toggleStatus('inProgress')}
              disabled={filterType === 'event'}
              aria-label={t('status.inProgress')}
              aria-pressed={statusFilters.inProgress}
              title={t('status.inProgress')}
              className={filterType === 'event' ? 'opacity-30' : ''}
            >
              <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} />
            </Button>
            <Button
              variant={statusFilters.completed ? 'default' : 'outline'}
              size="icon-sm"
              onClick={() => toggleStatus('completed')}
              aria-label={t('status.completed')}
              aria-pressed={statusFilters.completed}
              title={t('status.completed')}
            >
              <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} />
            </Button>
          </div>
        </div>

        {/* Priority Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground hidden md:inline min-w-[60px]">
            {t('priority')}:
          </span>
          <div className="flex gap-2">
            <Button
              variant={priorityFilters.low ? 'default' : 'outline'}
              size="icon-sm"
              onClick={() => togglePriority('low')}
              aria-label={t('priority.low')}
              aria-pressed={priorityFilters.low}
              title={t('priority.low')}
              className={!priorityFilters.low ? 'text-muted-foreground' : ''}
            >
              <HugeiconsIcon icon={CircleIcon} strokeWidth={2} />
            </Button>
            <Button
              variant={priorityFilters.medium ? 'default' : 'outline'}
              size="icon-sm"
              onClick={() => togglePriority('medium')}
              aria-label={t('priority.medium')}
              aria-pressed={priorityFilters.medium}
              title={t('priority.medium')}
              className={!priorityFilters.medium ? 'text-blue-600' : ''}
            >
              <HugeiconsIcon icon={Flag01Icon} strokeWidth={2} />
            </Button>
            <Button
              variant={priorityFilters.high ? 'default' : 'outline'}
              size="icon-sm"
              onClick={() => togglePriority('high')}
              aria-label={t('priority.high')}
              aria-pressed={priorityFilters.high}
              title={t('priority.high')}
              className={!priorityFilters.high ? 'text-orange-600' : ''}
            >
              <HugeiconsIcon icon={Flag01Icon} strokeWidth={2} />
            </Button>
            <Button
              variant={priorityFilters.critical ? 'default' : 'outline'}
              size="icon-sm"
              onClick={() => togglePriority('critical')}
              aria-label={t('priority.critical')}
              aria-pressed={priorityFilters.critical}
              title={t('priority.critical')}
              className={!priorityFilters.critical ? 'text-red-600' : ''}
            >
              <HugeiconsIcon icon={Alert01Icon} strokeWidth={2} />
            </Button>
          </div>
        </div>

        {/* <div className="flex flex-wrap gap-2 text-sm"> */}
        {/*   <span className="font-medium">{t('legend')}:</span> */}
        {/*   <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20"> */}
        {/*     {t('events')} */}
        {/*   </Badge> */}
        {/*   <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"> */}
        {/*     {t('tasks')} */}
        {/*   </Badge> */}
        {/* </div> */}
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
              {deleteTarget?.type === 'task' ? t('deleteTaskTitle') : t('deleteEventTitle')}
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
    </div>
  );
}
