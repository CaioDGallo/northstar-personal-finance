import { getTranslations } from 'next-intl/server';
import { getBillReminders } from '@/lib/actions/bill-reminders';
import { getCategories } from '@/lib/actions/categories';
import { AddReminderButton } from '@/components/add-reminder-button';
import { BillReminderCard } from '@/components/bill-reminder-card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ArrowDown01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

export default async function RemindersPage() {
  const t = await getTranslations('billReminders');
  const reminders = await getBillReminders();
  const categories = await getCategories();

  const activeReminders = reminders.filter(r => r.status === 'active');
  const inactiveReminders = reminders.filter(r => r.status !== 'active');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <AddReminderButton categories={categories} />
      </div>

      {/* Active reminders */}
      <div className="space-y-8">
        <div>
          <div className="mb-3">
            <h2 className="text-sm font-medium text-gray-500">{t('activeReminders')}</h2>
          </div>
          {activeReminders.length === 0 ? (
            <p className="text-sm text-gray-500">{t('noActiveRemindersYet')}</p>
          ) : (
            <div className="space-y-3">
              {activeReminders.map((reminder) => (
                <BillReminderCard
                  key={reminder.id}
                  reminder={reminder}
                  categories={categories}
                />
              ))}
            </div>
          )}
        </div>

        {/* Paused/Completed reminders */}
        {inactiveReminders.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700">
              {t('pausedAndCompleted')}
              <HugeiconsIcon icon={ArrowDown01Icon} className="size-4 transition-transform [[data-state=open]_&]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <div className="space-y-3">
                {inactiveReminders.map((reminder) => (
                  <BillReminderCard
                    key={reminder.id}
                    reminder={reminder}
                    categories={categories}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </div>
  );
}
