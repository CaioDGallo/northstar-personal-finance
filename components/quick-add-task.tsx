'use client';

import { useState } from 'react';
import { type ParsedTask } from '@/lib/natural-language-parser';
import { QuickAddInput } from '@/components/quick-add-input';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TaskForm } from '@/components/task-form';
import { EventForm } from '@/components/event-form';
import { useTranslations } from 'next-intl';
import { type Task, type Event } from '@/lib/schema';

interface QuickAddTaskProps {
  onSuccess?: () => void;
  /** Default type when no prefix specified */
  defaultType?: 'task' | 'event';
}

export function QuickAddTask({ onSuccess, defaultType = 'task' }: QuickAddTaskProps) {
  const [input, setInput] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedTask | null>(null);
  const [itemType, setItemType] = useState<'task' | 'event'>('task');
  const t = useTranslations('quickAdd');
  const tCalendar = useTranslations('calendar');

  function handleSubmit(parsed: ParsedTask, type: 'task' | 'event') {
    if (!parsed.title) return;

    setParsedData(parsed);
    setItemType(type);
    setDialogOpen(true);
  }

  function handleDialogClose(open: boolean) {
    setDialogOpen(open);
    if (!open) {
      setParsedData(null);
    }
  }

  function handleCreated() {
    setDialogOpen(false);
    setParsedData(null);
    setInput('');
    onSuccess?.();
  }

  // Convert parsed data to initial task values
  const initialTask = parsedData && itemType === 'task' ? {
    title: parsedData.title,
    dueAt: parsedData.dueAt || new Date(),
    startAt: parsedData.startAt || null,
    durationMinutes: parsedData.durationMinutes || null,
    priority: parsedData.priority || 'medium',
    status: 'pending' as const,
    description: null,
    location: null,
  } : null;

  // Convert parsed data to initial event values
  const initialEvent = parsedData && itemType === 'event' ? {
    title: parsedData.title,
    startAt: parsedData.startAt || parsedData.dueAt || new Date(),
    endAt: parsedData.dueAt || (() => {
      const start = parsedData.startAt || new Date();
      const duration = parsedData.durationMinutes || 60;
      return new Date(start.getTime() + duration * 60 * 1000);
    })(),
    isAllDay: false,
    priority: parsedData.priority || 'medium',
    status: 'scheduled' as const,
    description: null,
    location: null,
  } : null;

  return (
    <>
      <QuickAddInput
        value={input}
        onChange={setInput}
        onParsedSubmit={handleSubmit}
        defaultType={defaultType}
        placeholder={t('placeholder')}
        className="max-w-md"
      />

      <AlertDialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {itemType === 'task' ? tCalendar('addTask') : tCalendar('addEvent')}
            </AlertDialogTitle>
          </AlertDialogHeader>
          {itemType === 'task' && initialTask && (
            <TaskForm
              task={initialTask as Task}
              onSuccess={handleCreated}
            />
          )}
          {itemType === 'event' && initialEvent && (
            <EventForm
              event={initialEvent as Event}
              onSuccess={handleCreated}
            />
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
