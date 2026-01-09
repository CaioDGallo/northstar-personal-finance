'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { getCalendarSources } from '@/lib/actions/calendar-sources';
import type { CalendarSource } from '@/lib/schema';
import { CalendarSourceForm } from '@/components/calendar-source-form';
import { CalendarSourceCard } from '@/components/calendar-source-card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function CalendarsPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const t = useTranslations('calendarSources');

  async function loadSources() {
    setIsLoading(true);
    const data = await getCalendarSources();
    setSources(data);
    setIsLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSources();
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center flex-col md:flex-row space-y-4 md:space-y-0 justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('description')}</p>
        </div>
        <AlertDialog open={addOpen} onOpenChange={setAddOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="hollow">{t('addCalendar')}</Button>
          </AlertDialogTrigger>
          <AlertDialogContent closeOnBackdropClick>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('addCalendar')}</AlertDialogTitle>
            </AlertDialogHeader>
            <CalendarSourceForm onSuccess={() => setAddOpen(false)} />
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : sources.length > 0 ? (
          sources.map((source) => (
            <CalendarSourceCard key={source.id} source={source} />
          ))
        ) : (
          <p className="text-sm text-gray-500">{t('noCalendarsYet')}</p>
        )}
      </div>
    </div>
  );
}
