'use client';

import { useEffect, useState } from 'react';
import { ScheduleXCalendar, useNextCalendarApp } from '@schedule-x/react';
import {
  createViewDay,
  createViewMonthAgenda,
  createViewMonthGrid,
  createViewWeek,
} from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import 'temporal-polyfill/global';
import '@schedule-x/theme-default/dist/index.css';
import { deleteEvent, getEvents } from '@/lib/actions/events';
import { deleteTask, getTasks } from '@/lib/actions/tasks';
import { type Event, type Task } from '@/lib/schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

export default function CalendarPage() {
  const eventsService = useState(() => createEventsServicePlugin())[0];
  const [events, setEvents] = useState<Event[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'event' | 'task'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
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
  const t = useTranslations('calendar');
  const tCommon = useTranslations('common');

  async function loadData() {
    setIsLoading(true);
    const [eventsData, tasksData] = await Promise.all([getEvents(), getTasks()]);
    setEvents(eventsData);
    setTasks(tasksData);
    setIsLoading(false);
  }

  useEffect(() => {
    (async () => {
      await loadData();
    })();
  }, []);

  function parseCalendarId(id: string | number) {
    if (typeof id === 'number') return id;
    const parsed = Number(id.replace(/^event-/, '').replace(/^task-/, ''));
    return Number.isNaN(parsed) ? null : parsed;
  }

  function handleCalendarEventClick(calendarEvent: { id: string | number; calendarId?: string }) {
    const parsedId = parseCalendarId(calendarEvent.id);
    if (parsedId === null) return;

    if (calendarEvent.calendarId === 'events') {
      const event = events.find((item) => item.id === parsedId);
      if (!event) return;
      setSelectedEvent(event);
      setEditEventDialogOpen(true);
      return;
    }

    if (calendarEvent.calendarId === 'tasks') {
      const task = tasks.find((item) => item.id === parsedId);
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

  const filteredEvents = events.filter((event) => {
    if (filterType === 'task') return false;
    if (filterStatus !== 'all' && event.status !== filterStatus) return false;
    if (filterPriority !== 'all' && event.priority !== filterPriority) return false;
    return true;
  });

  const filteredTasks = tasks.filter((task) => {
    if (filterType === 'event') return false;
    if (filterStatus !== 'all' && task.status !== filterStatus) return false;
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    return true;
  });

  const scheduleEvents = [
    ...filteredEvents.map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      start: Temporal.ZonedDateTime.from(
        event.startAt.toISOString().replace('Z', '+00:00[UTC]')
      ),
      end: Temporal.ZonedDateTime.from(
        event.endAt.toISOString().replace('Z', '+00:00[UTC]')
      ),
      calendarId: 'events',
      description: event.description || undefined,
      location: event.location || undefined,
    })),
    ...filteredTasks.map((task) => {
      let startDate: Date;
      let endDate: Date;

      if (task.startAt && task.durationMinutes) {
        startDate = task.startAt;
        endDate = new Date(task.startAt.getTime() + task.durationMinutes * 60 * 1000);
      } else {
        startDate = task.dueAt;
        endDate = task.dueAt;
      }

      return {
        id: `task-${task.id}`,
        title: task.title,
        start: Temporal.ZonedDateTime.from(
          startDate.toISOString().replace('Z', '+00:00[UTC]')
        ),
        end: Temporal.ZonedDateTime.from(
          endDate.toISOString().replace('Z', '+00:00[UTC]')
        ),
        calendarId: 'tasks',
        description: task.description || undefined,
        location: task.location || undefined,
      };
    }),
  ];

  const calendar = useNextCalendarApp({
    views: [createViewDay(), createViewWeek(), createViewMonthGrid(), createViewMonthAgenda()],
    events: scheduleEvents,
    plugins: [eventsService],
    calendars: {
      events: {
        colorName: 'events',
        lightColors: {
          main: '#3b82f6',
          container: '#dbeafe',
          onContainer: '#1e3a8a',
        },
        darkColors: {
          main: '#60a5fa',
          container: '#1e40af',
          onContainer: '#dbeafe',
        },
      },
      tasks: {
        colorName: 'tasks',
        lightColors: {
          main: '#10b981',
          container: '#d1fae5',
          onContainer: '#064e3b',
        },
        darkColors: {
          main: '#34d399',
          container: '#065f46',
          onContainer: '#d1fae5',
        },
      },
    },
    callbacks: {
      onEventClick: (event) => handleCalendarEventClick(event),
    },
  });

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

      <div className="mb-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          <Select value={filterType} onValueChange={(value: 'all' | 'event' | 'task') => setFilterType(value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t('allTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allTypes')}</SelectItem>
              <SelectItem value="event">{t('events')}</SelectItem>
              <SelectItem value="task">{t('tasks')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t('allStatus')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatus')}</SelectItem>
              <SelectItem value="scheduled">{t('status.scheduled')}</SelectItem>
              <SelectItem value="pending">{t('status.pending')}</SelectItem>
              <SelectItem value="in_progress">{t('status.inProgress')}</SelectItem>
              <SelectItem value="completed">{t('status.completed')}</SelectItem>
              <SelectItem value="cancelled">{t('status.cancelled')}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder={t('allPriorities')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allPriorities')}</SelectItem>
              <SelectItem value="low">{t('priority.low')}</SelectItem>
              <SelectItem value="medium">{t('priority.medium')}</SelectItem>
              <SelectItem value="high">{t('priority.high')}</SelectItem>
              <SelectItem value="critical">{t('priority.critical')}</SelectItem>
            </SelectContent>
          </Select>
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
          <ScheduleXCalendar calendarApp={calendar} />
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

