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
import { getEvents } from '@/lib/actions/events';
import { getTasks } from '@/lib/actions/tasks';
import { type Event, type Task } from '@/lib/schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
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
  const [isLoading, setIsLoading] = useState(true);
  const t = useTranslations('calendar');

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
    ...filteredTasks.map((task) => ({
      id: `task-${task.id}`,
      title: task.title,
      start: Temporal.ZonedDateTime.from(
        task.dueAt.toISOString().replace('Z', '+00:00[UTC]')
      ),
      end: Temporal.ZonedDateTime.from(
        task.dueAt.toISOString().replace('Z', '+00:00[UTC]')
      ),
      calendarId: 'tasks',
      description: task.description || undefined,
      location: task.location || undefined,
    })),
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
    </div>
  );
}




