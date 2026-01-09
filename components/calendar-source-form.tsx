'use client';

import { useState } from 'react';
import { createCalendarSource, updateCalendarSource } from '@/lib/actions/calendar-sources';
import type { CalendarSource } from '@/lib/schema';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon } from '@hugeicons/core-free-icons';

type CalendarSourceFormProps = {
  source?: CalendarSource;
  onSuccess?: () => void;
};

const PRESET_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

export function CalendarSourceForm({ source, onSuccess }: CalendarSourceFormProps) {
  const [name, setName] = useState(source?.name || '');
  const [url, setUrl] = useState(source?.url || '');
  const [color, setColor] = useState(source?.color || PRESET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const t = useTranslations('calendarSourceForm');
  const tCommon = useTranslations('common');

  async function handleTest() {
    if (!url) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/calendar-sync/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const result = await response.json();

      if (result.success) {
        setTestResult({
          success: true,
          message: t('testSuccess', { name: result.calendarName, count: result.eventCount }),
        });
      } else {
        setTestResult({
          success: false,
          message: result.error || t('testFailed'),
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: t('testFailed'),
      });
    } finally {
      setIsTesting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const data = { name, url, color };

      const result = source
        ? await updateCalendarSource(source.id, data)
        : await createCalendarSource(data);

      if (result.success) {
        onSuccess?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">{t('name')}</FieldLabel>
          <Input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder={t('namePlaceholder')}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="url">{t('url')}</FieldLabel>
          <div className="flex gap-2">
            <Input
              type="url"
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              placeholder="https://calendar.google.com/..."
              className="flex-1"
            />
            <Button
              type="button"
              variant="popout"
              onClick={handleTest}
              disabled={!url || isTesting}
            >
              {isTesting ? t('testing') : t('test')}
            </Button>
          </div>
          {testResult && (
            <p className={`text-xs mt-1 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
              {testResult.message}
            </p>
          )}
        </Field>

        <Field className='pb-6'>
          <FieldLabel>{t('color')}</FieldLabel>
          <div className="flex gap-3">
            {PRESET_COLORS.map((presetColor) => {
              const isSelected = color === presetColor;
              return (
                <button
                  key={presetColor}
                  type="button"
                  className="relative size-8 rounded-full transition-all duration-200 hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
                  style={{
                    backgroundColor: presetColor,
                  }}
                  onClick={() => setColor(presetColor)}
                  aria-label={`Select color ${presetColor}`}
                  aria-pressed={isSelected}
                >
                  {/* Selection indicator */}
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        className="size-5 text-white drop-shadow-lg"
                        strokeWidth={3}
                      />
                    </div>
                  )}
                  {/* Ring overlay for selected state */}
                  {isSelected && (
                    <div
                      className="absolute -inset-1 rounded-full border-2 border-zinc-900 dark:border-zinc-100"
                      aria-hidden="true"
                    />
                  )}
                  {/* Hover ring */}
                  <div
                    className="absolute -inset-1 rounded-full border-2 border-zinc-400 opacity-0 transition-opacity hover:opacity-50"
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        </Field>
      </FieldGroup>

      <AlertDialogFooter>
        <AlertDialogCancel disabled={isSubmitting}>{tCommon('cancel')}</AlertDialogCancel>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? tCommon('saving') : tCommon('save')}
        </Button>
      </AlertDialogFooter>
    </form>
  );
}
