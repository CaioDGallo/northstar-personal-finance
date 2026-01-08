'use client';

import { useState, useEffect } from 'react';
import { createTask, updateTask } from '@/lib/actions/tasks';
import { createRecurrenceRule, deleteRecurrenceRule, getRecurrenceRuleByItem, updateRecurrenceRule } from '@/lib/actions/recurrence';
import { createSimpleRRule } from '@/lib/recurrence';
import type { Task } from '@/lib/schema';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useTranslations } from 'next-intl';
import { RecurrenceSelect, type RepeatFrequency, type EndType } from '@/components/recurrence-select';

type TaskFormProps = {
  task?: Task;
  onSuccess?: () => void;
};

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInputToEndOfDay(dateValue: string): Date {
  const [year, month, day] = dateValue.split('-').map(Number);
  return new Date(year, month - 1, day, 23, 59, 59);
}

export function TaskForm({ task, onSuccess }: TaskFormProps) {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [location, setLocation] = useState(task?.location || '');
  const [dueDate, setDueDate] = useState(
    task?.dueAt ? formatDateInput(task.dueAt) : formatDateInput(new Date())
  );
  const [dueTime, setDueTime] = useState(
    task?.dueAt ? task.dueAt.toTimeString().slice(0, 5) : '09:00'
  );
  const [hasTime, setHasTime] = useState(!!task?.startAt || false);
  const [startTime, setStartTime] = useState(
    task?.startAt ? task.startAt.toTimeString().slice(0, 5) : '09:00'
  );
  const [duration, setDuration] = useState<number>(task?.durationMinutes || 60);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>(
    task?.priority || 'medium'
  );
  const [status, setStatus] = useState<'pending' | 'in_progress' | 'completed' | 'cancelled'>(
    task?.status || 'pending'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recurrence state
  const [repeat, setRepeat] = useState<RepeatFrequency>('never');
  const [endType, setEndType] = useState<EndType>('never');
  const [endCount, setEndCount] = useState(1);
  const [endDate_, setEndDate_] = useState(formatDateInput(new Date()));
  const [existingRecurrenceId, setExistingRecurrenceId] = useState<number | null>(null);

  const t = useTranslations('taskForm');
  const tCommon = useTranslations('common');

  // Fetch existing recurrence rule on edit
  useEffect(() => {
    if (!task?.id) return;

    async function fetchRecurrence() {
      const rule = await getRecurrenceRuleByItem('task', task!.id);
      if (rule) {
        setExistingRecurrenceId(rule.id);

        // Parse RRULE string to populate state
        const parts = rule.rrule.split(';');
        const freqPart = parts.find(p => p.startsWith('FREQ='));
        const countPart = parts.find(p => p.startsWith('COUNT='));
        const untilPart = parts.find(p => p.startsWith('UNTIL='));

        if (freqPart) {
          const freq = freqPart.split('=')[1] as RepeatFrequency;
          setRepeat(freq);

          if (countPart) {
            setEndType('after');
            setEndCount(parseInt(countPart.split('=')[1]));
          } else if (untilPart) {
            setEndType('on');
            const untilValue = untilPart.split('=')[1];
            const date = new Date(
              parseInt(untilValue.slice(0, 4)),
              parseInt(untilValue.slice(4, 6)) - 1,
              parseInt(untilValue.slice(6, 8))
            );
            setEndDate_(formatDateInput(date));
          } else {
            setEndType('never');
          }
        }
      }
    }

    fetchRecurrence();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Parse dates using Date constructor for explicit local timezone handling
      const [year, month, day] = dueDate.split('-').map(Number);
      const [dueHours, dueMinutes] = dueTime.split(':').map(Number);
      const dueDateTime = new Date(year, month - 1, day, dueHours, dueMinutes, 0);

      const startAtDateTime = hasTime
        ? (() => {
            const [hours, minutes] = startTime.split(':').map(Number);
            return new Date(year, month - 1, day, hours, minutes, 0);
          })()
        : null;

      if (startAtDateTime && startAtDateTime > dueDateTime) {
        setError(t('invalidDateTime'));
        return;
      }

      const data = {
        title,
        description: description || null,
        location: location || null,
        dueAt: dueDateTime,
        startAt: startAtDateTime,
        durationMinutes: hasTime ? duration : null,
        priority,
        status,
      };

      const result = task
        ? await updateTask(task.id, data)
        : await createTask(data);

      if (!result.success) {
        setError(result.error);
        return;
      }

      // Handle recurrence rule
      const taskId = task?.id || result.data?.id;
      if (!taskId) {
        console.error('[TaskForm] No task ID after create/update');
        setError(tCommon('unexpectedError'));
        return;
      }

      if (repeat === 'never') {
        // Delete existing recurrence rule if any
        if (existingRecurrenceId) {
          await deleteRecurrenceRule(existingRecurrenceId);
        }
      } else {
        // Create RRULE string
        const rruleString = createSimpleRRule(
          repeat,
          1,
          endType === 'after' ? endCount : undefined,
          endType === 'on' ? parseDateInputToEndOfDay(endDate_) : undefined
        );

        if (existingRecurrenceId) {
          // Update existing rule
          await updateRecurrenceRule(existingRecurrenceId, { rrule: rruleString });
        } else {
          // Create new rule
          await createRecurrenceRule({
            itemType: 'task',
            itemId: taskId,
            rrule: rruleString,
          });
        }
      }

      onSuccess?.();
    } catch (err) {
      console.error('[TaskForm] Submit failed:', err);
      setError(tCommon('unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="title">{t('title')}</FieldLabel>
          <Input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder={t('titlePlaceholder')}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="description">{t('description')}</FieldLabel>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('descriptionPlaceholder')}
            rows={3}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="location">{t('location')}</FieldLabel>
          <Input
            type="text"
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={t('locationPlaceholder')}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="dueDate">{t('dueDate')}</FieldLabel>
          <Input
            type="date"
            id="dueDate"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="dueTime">{t('dueTime')}</FieldLabel>
          <Input
            type="time"
            id="dueTime"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="hasTime">{t('hasTime')}</FieldLabel>
          <Select value={hasTime.toString()} onValueChange={(v) => setHasTime(v === 'true')}>
            <SelectTrigger id="hasTime">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="false">{t('no')}</SelectItem>
                <SelectItem value="true">{t('yes')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        {hasTime && (
          <>
            <Field>
              <FieldLabel htmlFor="startTime">{t('startTime')}</FieldLabel>
              <Input
                type="time"
                id="startTime"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="duration">{t('duration')}</FieldLabel>
              <Input
                type="number"
                id="duration"
                value={duration}
                onChange={(e) => {
                  const parsed = parseInt(e.target.value);
                  if (!isNaN(parsed) && parsed >= 15) {
                    setDuration(parsed);
                  }
                }}
                min={15}
                step={15}
                required
              />
            </Field>
          </>
        )}

        <Field>
          <FieldLabel htmlFor="priority">{t('priority')}</FieldLabel>
          <Select
            value={priority}
            onValueChange={(v: 'low' | 'medium' | 'high' | 'critical') => setPriority(v)}
          >
            <SelectTrigger id="priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="low">{t('priorityLow')}</SelectItem>
                <SelectItem value="medium">{t('priorityMedium')}</SelectItem>
                <SelectItem value="high">{t('priorityHigh')}</SelectItem>
                <SelectItem value="critical">{t('priorityCritical')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="status">{t('status')}</FieldLabel>
          <Select
            value={status}
            onValueChange={(v: 'pending' | 'in_progress' | 'completed' | 'cancelled') => setStatus(v)}
          >
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="pending">{t('statusPending')}</SelectItem>
                <SelectItem value="in_progress">{t('statusInProgress')}</SelectItem>
                <SelectItem value="completed">{t('statusCompleted')}</SelectItem>
                <SelectItem value="cancelled">{t('statusCancelled')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <RecurrenceSelect
          repeat={repeat}
          onRepeatChange={setRepeat}
          endType={endType}
          onEndTypeChange={setEndType}
          endCount={endCount}
          onEndCountChange={setEndCount}
          endDate={endDate_}
          onEndDateChange={setEndDate_}
        />

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? tCommon('saving') : task ? tCommon('update') : tCommon('create')}
          </Button>
        </AlertDialogFooter>
      </FieldGroup>
    </form>
  );
}
