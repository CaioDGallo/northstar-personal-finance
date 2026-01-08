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
import { deleteTask, getTasksWithRecurrence } from '@/lib/actions/tasks';
import { getUserSettings } from '@/lib/actions/user-settings';
import { type Task } from '@/lib/schema';
import { filterTasks, resolveTaskRange } from '@/lib/tasks-utils';
import { buildTaskSchedule, type TaskWithRecurrence } from '@/lib/task-schedule';
import { getBrowserTimeZone, resolveTimeZone } from '@/lib/timezone-utils';
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
import { TaskForm } from '@/components/task-form';
import { MonthAgendaEventItem } from '@/components/calendar/month-agenda-event-item';
import { EventDetailSheet } from '@/components/calendar/event-detail-sheet';
import { useTranslations } from 'next-intl';
import { Theme } from '@/components/theme-toggle';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Clock01Icon,
  Loading03Icon,
  Tick02Icon,
  Flag01Icon,
  Alert01Icon,
  CircleIcon,
} from '@hugeicons/core-free-icons';

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function toOptionalDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  return toDate(value);
}

export default function TasksPage() {
  const eventsService = useState(() => createEventsServicePlugin())[0];
  const [tasks, setTasks] = useState<TaskWithRecurrence[]>([]);
  const [timeZone, setTimeZone] = useState(() => getBrowserTimeZone());
  const [statusFilters, setStatusFilters] = useState({
    pending: true,
    inProgress: true,
    completed: true,
    cancelled: false,
  });
  const [priorityFilters, setPriorityFilters] = useState({
    low: true,
    medium: true,
    high: true,
    critical: true,
  });

  const toggleStatus = (key: 'pending' | 'inProgress' | 'completed' | 'cancelled') => {
    setStatusFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePriority = (key: 'low' | 'medium' | 'high' | 'critical') => {
    setPriorityFilters(prev => ({ ...prev, [key]: !prev[key] }));
  };
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editTaskDialogOpen, setEditTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
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
  const tasksRef = useRef<TaskWithRecurrence[]>([]);
  const occurrenceOverridesRef = useRef(new Map<string, { startAt: Date; endAt: Date }>());
  const t = useTranslations('calendar');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('navigation');
  const [theme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('theme') as Theme | null) || 'system';
  });
  const prefersDark = typeof window === 'undefined' ? false : window.matchMedia('(prefers-color-scheme: dark)').matches;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const [tasksData, settings] = await Promise.all([
      getTasksWithRecurrence(),
      getUserSettings(),
    ]);
    setTimeZone(resolveTimeZone(settings));
    const normalizedTasks = tasksData.map((task) => ({
      ...task,
      recurrenceRule: task.recurrenceRule ?? null,
      dueAt: toDate(task.dueAt),
      startAt: toOptionalDate(task.startAt),
      completedAt: toOptionalDate(task.completedAt),
      createdAt: toOptionalDate(task.createdAt),
      updatedAt: toOptionalDate(task.updatedAt),
    }));
    tasksRef.current = normalizedTasks;
    setTasks(normalizedTasks);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCalendarEventClick = useCallback((calendarEvent: { id: string | number; calendarId?: string }) => {
    function parseCalendarId(id: string | number) {
      const raw = typeof id === 'number' ? `task-${id}` : id;
      const match = /^task-(\d+)/.exec(raw);
      if (!match) return null;
      const parsed = Number(match[1]);
      return Number.isNaN(parsed) ? null : parsed;
    }

    const parsedId = parseCalendarId(calendarEvent.id);
    if (parsedId === null) return;

    const task = tasksRef.current.find((item) => item.id === parsedId);
    if (!task) return;

    const eventKey = typeof calendarEvent.id === 'number' ? `task-${calendarEvent.id}` : calendarEvent.id;
    const occurrenceOverride = occurrenceOverridesRef.current.get(eventKey);
    const taskRange = occurrenceOverride ?? resolveTaskRange(task);
    setDetailSheetData({
      id: task.id,
      title: task.title,
      description: task.description,
      location: task.location,
      startAt: taskRange.startAt,
      endAt: taskRange.endAt,
      priority: task.priority,
      status: task.status,
      type: 'task',
      durationMinutes: task.durationMinutes,
    });
    setDetailSheetOpen(true);
  }, []);

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
      const result = await deleteTask(deleteTarget.id);

      if (!result.success) {
        setDeleteError(result.error);
        return;
      }

      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      setSelectedTask(null);
      await loadData();
    } catch (error) {
      console.error('[Tasks] Delete failed:', error);
      setDeleteError(tCommon('unexpectedError'));
    } finally {
      setIsDeleting(false);
    }
  }

  // Handlers for detail sheet actions
  const handleDetailSheetEdit = useCallback(() => {
    if (!detailSheetData) return;

    const task = tasksRef.current.find((t) => t.id === detailSheetData.id);
    if (!task) return;
    setSelectedTask(task);
    setEditTaskDialogOpen(true);
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
    handleCalendarEventClick({ id: `task-${id}`, calendarId: 'tasks' });
  }, [handleCalendarEventClick]);

  const handleEventItemDelete = useCallback((id: number) => {
    const item = tasksRef.current.find((t) => t.id === id);

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

  const filteredTasks = useMemo(() => {
    return filterTasks(tasks, statusFilters, priorityFilters);
  }, [tasks, statusFilters, priorityFilters]);

  const scheduleData = useMemo(() => {
    return buildTaskSchedule(filteredTasks, timeZone);
  }, [filteredTasks, timeZone]);

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
        <h1 className="text-2xl font-bold">{tNav('tasks')}</h1>
        <div className="flex gap-2 w-full justify-start">
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
        </div>
      </div>

      <div className="mb-4 gap-2 flex flex-row md:flex-col">
        {/* Status Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground hidden md:inline min-w-[60px]">
            {t('statusLabel')}:
          </span>
          <div className="flex gap-2">
            <Button
              variant={statusFilters.pending ? 'popout' : 'hollow'}
              size="icon-sm"
              onClick={() => toggleStatus('pending')}
              aria-label={t('status.pending')}
              aria-pressed={statusFilters.pending}
              title={t('status.pending')}
              className='p-4'
            >
              <HugeiconsIcon icon={Clock01Icon} strokeWidth={2} />
            </Button>
            <Button
              variant={statusFilters.inProgress ? 'popout' : 'hollow'}
              size="icon-sm"
              onClick={() => toggleStatus('inProgress')}
              aria-label={t('status.inProgress')}
              aria-pressed={statusFilters.inProgress}
              title={t('status.inProgress')}
              className='p-4'
            >
              <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} />
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
            <Button
              variant={statusFilters.cancelled ? 'popout' : 'hollow'}
              size="icon-sm"
              onClick={() => toggleStatus('cancelled')}
              aria-label={t('status.cancelled')}
              aria-pressed={statusFilters.cancelled}
              title={t('status.cancelled')}
              className='p-4'
            >
              <HugeiconsIcon icon={CircleIcon} strokeWidth={2} />
            </Button>
          </div>
        </div>

        <div className='border border-gray-300 ml-1 flex md:hidden' />

        {/* Priority Filter */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground hidden md:inline min-w-[60px]">
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
              {t('deleteTaskTitle')}
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

      {/* Task Detail Sheet */}
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
