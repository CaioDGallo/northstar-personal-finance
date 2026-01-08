'use client';

import { Field, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';

export type RepeatFrequency = 'never' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export type EndType = 'never' | 'after' | 'on';

type RecurrenceSelectProps = {
  repeat: RepeatFrequency;
  onRepeatChange: (value: RepeatFrequency) => void;
  endType: EndType;
  onEndTypeChange: (value: EndType) => void;
  endCount: number;
  onEndCountChange: (value: number) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
};

export function RecurrenceSelect({
  repeat,
  onRepeatChange,
  endType,
  onEndTypeChange,
  endCount,
  onEndCountChange,
  endDate,
  onEndDateChange,
}: RecurrenceSelectProps) {
  const t = useTranslations('recurrence');

  return (
    <>
      <Field>
        <FieldLabel htmlFor="repeat">{t('repeat')}</FieldLabel>
        <Select value={repeat} onValueChange={onRepeatChange}>
          <SelectTrigger id="repeat">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="never">{t('never')}</SelectItem>
              <SelectItem value="DAILY">{t('daily')}</SelectItem>
              <SelectItem value="WEEKLY">{t('weekly')}</SelectItem>
              <SelectItem value="MONTHLY">{t('monthly')}</SelectItem>
              <SelectItem value="YEARLY">{t('yearly')}</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      {repeat !== 'never' && (
        <>
          <Field>
            <FieldLabel htmlFor="endType">{t('ends')}</FieldLabel>
            <Select value={endType} onValueChange={onEndTypeChange}>
              <SelectTrigger id="endType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="never">{t('endsNever')}</SelectItem>
                  <SelectItem value="after">{t('endsAfter')}</SelectItem>
                  <SelectItem value="on">{t('endsOn')}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          {endType === 'after' && (
            <Field>
              <FieldLabel htmlFor="endCount">{t('occurrences')}</FieldLabel>
              <Input
                type="number"
                id="endCount"
                value={endCount}
                onChange={(e) => {
                  const parsed = parseInt(e.target.value);
                  if (!isNaN(parsed) && parsed >= 1) {
                    onEndCountChange(parsed);
                  }
                }}
                min={1}
                required
              />
            </Field>
          )}

          {endType === 'on' && (
            <Field>
              <FieldLabel htmlFor="endDate">{t('endsOn')}</FieldLabel>
              <Input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => onEndDateChange(e.target.value)}
                required
              />
            </Field>
          )}
        </>
      )}
    </>
  );
}
