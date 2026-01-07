'use client';

import { useState } from 'react';
import { createTask, updateTask } from '@/lib/actions/tasks';
import type { Task } from '@/lib/schema';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('taskForm');
  const tCommon = useTranslations('common');

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
