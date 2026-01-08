'use client';

import { useState, useEffect } from 'react';
import { createEvent, updateEvent } from '@/lib/actions/events';
import { createRecurrenceRule, deleteRecurrenceRule, getRecurrenceRuleByItem, updateRecurrenceRule } from '@/lib/actions/recurrence';
import { createSimpleRRule } from '@/lib/recurrence';
import type { Event } from '@/lib/schema';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useTranslations } from 'next-intl';
import { RecurrenceSelect, type RepeatFrequency, type EndType } from '@/components/recurrence-select';

type EventFormProps = {
  event?: Event;
  onSuccess?: () => void;
};

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function EventForm({ event, onSuccess }: EventFormProps) {
  const [title, setTitle] = useState(event?.title || '');
  const [description, setDescription] = useState(event?.description || '');
  const [location, setLocation] = useState(event?.location || '');
  const [startDate, setStartDate] = useState(
    event?.startAt ? formatDateInput(event.startAt) : formatDateInput(new Date())
  );
  const [startTime, setStartTime] = useState(
    event?.startAt ? event.startAt.toTimeString().slice(0, 5) : '09:00'
  );
  const [endDate, setEndDate] = useState(
    event?.endAt ? formatDateInput(event.endAt) : formatDateInput(new Date())
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

  // Recurrence state
  const [repeat, setRepeat] = useState<RepeatFrequency>('never');
  const [endType, setEndType] = useState<EndType>('never');
  const [endCount, setEndCount] = useState(1);
  const [endDate_, setEndDate_] = useState(formatDateInput(new Date()));
  const [existingRecurrenceId, setExistingRecurrenceId] = useState<number | null>(null);

  const t = useTranslations('eventForm');
  const tCommon = useTranslations('common');

  // Fetch existing recurrence rule on edit
  useEffect(() => {
    if (!event?.id) return;

    async function fetchRecurrence() {
      const rule = await getRecurrenceRuleByItem('event', event!.id);
      if (rule) {
        setExistingRecurrenceId(rule.id);

        // Parse RRULE string to populate state
        // Format: FREQ=WEEKLY;INTERVAL=1;COUNT=10 or FREQ=DAILY;INTERVAL=1;UNTIL=20250115T000000Z
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
  }, [event?.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Parse dates using Date constructor for explicit local timezone handling
      const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
      const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

      const startDateTime = isAllDay
        ? new Date(startYear, startMonth - 1, startDay, 0, 0, 0)
        : (() => {
            const [hours, minutes] = startTime.split(':').map(Number);
            return new Date(startYear, startMonth - 1, startDay, hours, minutes, 0);
          })();

      const endDateTime = isAllDay
        ? new Date(endYear, endMonth - 1, endDay, 23, 59, 59)
        : (() => {
            const [hours, minutes] = endTime.split(':').map(Number);
            return new Date(endYear, endMonth - 1, endDay, hours, minutes, 0);
          })();

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

      // Handle recurrence rule
      const eventId = event?.id || result.data?.id;
      if (!eventId) {
        console.error('[EventForm] No event ID after create/update');
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
          endType === 'on' ? new Date(endDate_) : undefined
        );

        if (existingRecurrenceId) {
          // Update existing rule
          await updateRecurrenceRule(existingRecurrenceId, { rrule: rruleString });
        } else {
          // Create new rule
          await createRecurrenceRule({
            itemType: 'event',
            itemId: eventId,
            rrule: rruleString,
          });
        }
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
            {isSubmitting ? tCommon('saving') : event ? tCommon('update') : tCommon('create')}
          </Button>
        </AlertDialogFooter>
      </FieldGroup>
    </form>
  );
}
