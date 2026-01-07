'use client';

import { useState } from 'react';
import { createEvent, updateEvent } from '@/lib/actions/events';
import type { Event } from '@/lib/schema';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useTranslations } from 'next-intl';

type EventFormProps = {
  event?: Event;
  onSuccess?: () => void;
};

export function EventForm({ event, onSuccess }: EventFormProps) {
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [location, setLocation] = useState(event?.location || '');
  const [startDate, setStartDate] = useState(
    event?.startAt ? event.startAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [startTime, setStartTime] = useState(
    event?.startAt ? event.startAt.toTimeString().slice(0, 5) : '09:00'
  );
  const [endDate, setEndDate] = useState(
    event?.endAt ? event.endAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [endTime, setEndTime] = useState(
    event?.endAt ? event.endAt.toTimeString().slice(0, 5) : '10:00'
  );
  const [isAllDay, setIsAllDay] = useState(event?.isAllDay || false);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'critical'>(
    event?.priority || 'medium'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('eventForm');
  const tCommon = useTranslations('common');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const startDateTime = isAllDay
        ? new Date(`${startDate}T00:00:00`)
        : new Date(`${startDate}T${startTime}:00`);
      
      const endDateTime = isAllDay
        ? new Date(`${endDate}T23:59:59`)
        : new Date(`${endDate}T${endTime}:00`);

      if (endDateTime < startDateTime) {
        setError(t('invalidDateTime'));
        setIsSubmitting(false);
        return;
      }

      const data = {
        title,
        description: description || null,
        location: location || null,
        startAt: startDateTime,
        endAt: endDateTime,
        isAllDay,
        priority,
      };

      const result = event
        ? await updateEvent(event.id, data)
        : await createEvent(data);

      if (!result.success) {
        setError(result.error);
        return;
      }

      onSuccess?.();
    } catch (err) {
      console.error('[EventForm] Submit failed:', err);
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
          <FieldLabel htmlFor="allDay">{t('allDay')}</FieldLabel>
          <Select value={isAllDay.toString()} onValueChange={(v) => setIsAllDay(v === 'true')}>
            <SelectTrigger id="allDay">
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

        {!isAllDay && (
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
              <FieldLabel htmlFor="endTime">{t('endTime')}</FieldLabel>
              <Input
                type="time"
                id="endTime"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </Field>
          </>
        )}

        <Field>
          <FieldLabel htmlFor="startDate">{t('startDate')}</FieldLabel>
          <Input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="endDate">{t('endDate')}</FieldLabel>
          <Input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </Field>

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

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? tCommon('saving') : event ? tCommon('update') : tCommon('create')}
          </Button>
        </AlertDialogFooter>
      </FieldGroup>
    </form>
  );
}