"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Invoice01Icon,
  Calendar03Icon,
  Clock01Icon,
  Money01Icon,
  SparklesIcon,
  CircleIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { centsToDisplay } from "@/lib/utils"
import type { BillReminder } from "@/lib/schema"
import { useTranslations } from "next-intl"

interface BillReminderDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reminder: BillReminder | null
  occurrenceDate?: Date
  category?: { name: string; color: string }
}

// Helper: Format date/time
function formatDateTime(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// Helper: Get recurrence description
function getRecurrenceDescription(
  reminder: BillReminder,
  t: (key: string, values?: Record<string, string | number>) => string
): string {
  const { recurrenceType, dueDay, startMonth } = reminder
  const weekdays = [
    t('weekdays.sunday'),
    t('weekdays.monday'),
    t('weekdays.tuesday'),
    t('weekdays.wednesday'),
    t('weekdays.thursday'),
    t('weekdays.friday'),
    t('weekdays.saturday'),
  ]

  switch (recurrenceType) {
    case 'once':
      return t('recurrence.once', { startMonth })
    case 'weekly':
      return t('recurrence.weekly', { weekday: weekdays[dueDay] })
    case 'biweekly':
      return t('recurrence.biweekly')
    case 'monthly':
      return t('recurrence.monthly', { day: dueDay })
    case 'quarterly':
      return t('recurrence.quarterly', { day: dueDay })
    case 'yearly':
      return t('recurrence.yearly', { day: dueDay, month: startMonth.split('-')[1] })
    default:
      return recurrenceType
  }
}

// Helper: Get status badge config
function getStatusConfig(status: string) {
  const configs: Record<string, { variant: "default" | "outline" | "ghost", icon: typeof Clock01Icon }> = {
    active: { variant: "outline", icon: Clock01Icon },
    paused: { variant: "ghost", icon: CircleIcon },
    completed: { variant: "default", icon: Tick02Icon },
  }
  return configs[status] || { variant: "outline" as const, icon: Clock01Icon }
}

export function BillReminderDetailSheet({
  open,
  onOpenChange,
  reminder,
  occurrenceDate,
  category,
}: BillReminderDetailSheetProps) {
  const tDetail = useTranslations('billReminders.detail')

  if (!reminder) return null

  const statusConfig = getStatusConfig(reminder.status)
  const StatusIcon = statusConfig.icon
  const statusLabel = tDetail(`status.${reminder.status}`)
  const recurrenceDesc = getRecurrenceDescription(reminder, tDetail)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <HugeiconsIcon icon={Invoice01Icon} className="h-5 w-5 text-yellow-700 dark:text-yellow-400" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl break-words">{reminder.name}</SheetTitle>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={statusConfig.variant}>
                  <HugeiconsIcon icon={StatusIcon} className="mr-1 h-3 w-3" />
                  {statusLabel}
                </Badge>
              </div>
            </div>
          </div>
        </SheetHeader>

        <SheetDescription className="sr-only">
          {tDetail('sheetDescription', { name: reminder.name })}
        </SheetDescription>

        <div className="space-y-6">
          {/* Amount */}
          {reminder.amount && (
            <div className="flex items-start gap-3">
              <HugeiconsIcon icon={Money01Icon} className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{tDetail('amount')}</p>
                <p className="text-lg font-semibold">{centsToDisplay(reminder.amount)}</p>
              </div>
            </div>
          )}

          {/* Category */}
          {category && (
            <div className="flex items-start gap-3">
              <HugeiconsIcon icon={SparklesIcon} className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{tDetail('category')}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <p className="text-sm">{category.name}</p>
                </div>
              </div>
            </div>
          )}

          {/* Due Date */}
          <div className="flex items-start gap-3">
            <HugeiconsIcon icon={Calendar03Icon} className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {occurrenceDate ? tDetail('thisOccurrence') : tDetail('nextDueDate')}
              </p>
              <p className="text-sm">
                {occurrenceDate
                  ? formatDateTime(occurrenceDate)
                  : tDetail('dueDay', { day: reminder.dueDay })}
              </p>
              {reminder.dueTime && (
                <p className="text-sm text-muted-foreground mt-1">
                  {occurrenceDate
                    ? tDetail('atTime', { time: formatTime(occurrenceDate) })
                    : tDetail('atTime', { time: reminder.dueTime })}
                </p>
              )}
            </div>
          </div>

          {/* Recurrence */}
          <div className="flex items-start gap-3">
            <HugeiconsIcon icon={Clock01Icon} className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{tDetail('recurrenceLabel')}</p>
              <p className="text-sm">{recurrenceDesc}</p>
              {reminder.endMonth && (
                <p className="text-sm text-muted-foreground mt-1">
                  {tDetail('ends', { endMonth: reminder.endMonth })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Info note */}
        <div className="mt-6 rounded-lg bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground">
            {tDetail('infoNote')}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
