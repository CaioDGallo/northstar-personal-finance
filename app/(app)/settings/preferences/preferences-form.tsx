'use client';

import { useState } from 'react';
import { updateUserSettings } from '@/lib/actions/user-settings';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';
import type { UserSettings } from '@/lib/schema';

const TIMEZONES = [
  'UTC',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
];

const OFFSET_OPTIONS = [
  { label: '0 minutes', value: 0 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '2 hours', value: 120 },
  { label: '4 hours', value: 240 },
  { label: '1 day', value: 1440 },
];

type PreferencesFormProps = {
  settings: UserSettings;
};

export function PreferencesForm({ settings }: PreferencesFormProps) {
  const [timezone, setTimezone] = useState(settings.timezone || 'UTC');
  const [notificationEmail, setNotificationEmail] = useState(settings.notificationEmail || '');
  const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notificationsEnabled ?? true);
  const [defaultEventOffset, setDefaultEventOffset] = useState(settings.defaultEventOffsetMinutes || 60);
  const [defaultTaskOffset, setDefaultTaskOffset] = useState(settings.defaultTaskOffsetMinutes || 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const t = useTranslations('preferences');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const result = await updateUserSettings({
        timezone,
        notificationEmail: notificationEmail || null,
        notificationsEnabled,
        defaultEventOffsetMinutes: defaultEventOffset,
        defaultTaskOffsetMinutes: defaultTaskOffset,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('[PreferencesForm] Submit failed:', err);
      setError(t('unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="timezone">{t('timezone')}</FieldLabel>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="notificationEmail">{t('notificationEmail')}</FieldLabel>
          <Input
            type="email"
            id="notificationEmail"
            value={notificationEmail}
            onChange={(e) => setNotificationEmail(e.target.value)}
            placeholder={t('notificationEmailPlaceholder')}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="notificationsEnabled">{t('notificationsEnabled')}</FieldLabel>
          <Select value={notificationsEnabled.toString()} onValueChange={(v) => setNotificationsEnabled(v === 'true')}>
            <SelectTrigger id="notificationsEnabled">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="true">{t('yes')}</SelectItem>
                <SelectItem value="false">{t('no')}</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="defaultEventOffset">{t('defaultEventOffset')}</FieldLabel>
          <Select value={defaultEventOffset.toString()} onValueChange={(v) => setDefaultEventOffset(Number(v))}>
            <SelectTrigger id="defaultEventOffset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {OFFSET_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="defaultTaskOffset">{t('defaultTaskOffset')}</FieldLabel>
          <Select value={defaultTaskOffset.toString()} onValueChange={(v) => setDefaultTaskOffset(Number(v))}>
            <SelectTrigger id="defaultTaskOffset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {OFFSET_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-800">
            {t('savedSuccessfully')}
          </div>
        )}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('saving') : t('save')}
        </Button>
      </FieldGroup>
    </form>
  );
}