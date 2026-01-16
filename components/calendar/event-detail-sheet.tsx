"use client"

import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon,
  Clock01Icon,
  Location01Icon,
} from "@hugeicons/core-free-icons"

import { useTranslations } from "next-intl"

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  getPriorityIcon,
  getPriorityColor,
  getStatusConfig,
} from "./calendar-helpers"

interface EventDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: {
    id: number
    title: string
    description?: string | null
    location?: string | null
    startAt: Date
    endAt: Date
    isAllDay?: boolean
    priority: 'low' | 'medium' | 'high' | 'critical'
    status: string
    type: 'event' | 'task'
    durationMinutes?: number | null
  } | null
  timeZone?: string
  onEdit?: () => void
  onDelete?: () => void
}

// Helper: Format date/time
function formatDateTime(date: Date, isAllDay?: boolean, timeZone?: string): string {
  const options: Intl.DateTimeFormatOptions = timeZone ? { timeZone } : {}
  if (isAllDay) {
    return date.toLocaleDateString(undefined, {
      ...options,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return date.toLocaleString(undefined, {
    ...options,
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// Helper: Format duration
function formatDuration(
  start: Date,
  end: Date,
  isAllDay?: boolean,
  tDetail?: (key: string, values?: Record<string, string | number>) => string
): string {
  if (isAllDay) {
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    if (tDetail) {
      return days === 1
        ? tDetail('allDayLabel')
        : tDetail('daysLabel', { count: days })
    }
    return days === 1 ? 'All day' : `${days} days`
  }

  const minutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function getStatusTranslationKey(status: string): string {
  if (status === 'in_progress') return 'inProgress'
  return status
}

export function EventDetailSheet({
  open,
  onOpenChange,
  event,
  timeZone,
  onEdit,
  onDelete,
}: EventDetailSheetProps) {
  const tCalendar = useTranslations('calendar')
  const tCommon = useTranslations('common')

  if (!event) return null

  const tDetail = (
    key: string,
    values?: Record<string, string | number>
  ) => tCalendar(`detail.${key}`, values)
  const PriorityIcon = getPriorityIcon(event.priority)
  const priorityColor = getPriorityColor(event.priority)
  const statusConfig = getStatusConfig(event.status, event.type)
  const StatusIcon = statusConfig.icon

  const duration = formatDuration(
    event.startAt,
    event.endAt,
    event.isAllDay,
    tDetail
  )
  const priorityLabel = tCalendar(`priority.${event.priority}`)
  const eventTypeLabel = tDetail(`typeNames.${event.type}`)
  const statusLabel = tCalendar(
    `status.${getStatusTranslationKey(event.status)}`
  )
  const toLabel = tDetail('toLabel')

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          {/* Type indicator bar */}
          <div className={cn(
            "h-1 w-3/5 mb-4 rounded-none",
            event.type === 'event'
              ? "bg-[oklch(0.60_0.20_250)]" // Blue
              : "bg-[oklch(0.65_0.15_145)]"  // Green
          )} />

          <SheetTitle className={`text-base font-bold`}>
            {event.title}
          </SheetTitle>

          {event.description ? (
            <SheetDescription className="text-xs text-foreground/80 pt-2">
              {event.description}
            </SheetDescription>
          ) : (
            <SheetDescription className="sr-only">
              {tDetail('sheetDescription', { type: eventTypeLabel })}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex flex-col gap-4 p-4">
          {/* Date/Time Section */}
          <div className="flex flex-col gap-3 p-3 border border-border rounded-none shadow-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-gray-400 bg-background">
            <div className="flex items-start gap-3">
              <HugeiconsIcon
                icon={Calendar03Icon}
                className="size-4 text-muted-foreground mt-0.5"
              />
              <div className="flex-1">
                <div className="text-xs font-medium">
                  {formatDateTime(event.startAt, event.isAllDay, timeZone)}
                </div>
                {!event.isAllDay && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {toLabel} {formatDateTime(event.endAt, event.isAllDay, timeZone)}
                  </div>
                )}

              </div>
            </div>

            <div className="flex items-center gap-3">
              <HugeiconsIcon
                icon={Clock01Icon}
                className="size-4 text-muted-foreground"
              />
              <div className="text-xs text-muted-foreground">
                {duration}
              </div>
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3 p-3 border border-border rounded-none shadow-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-gray-400 bg-background">
              <HugeiconsIcon
                icon={Location01Icon}
                className="size-4 text-muted-foreground mt-0.5"
              />
              <div className="flex-1 text-xs">
                {event.location}
              </div>
            </div>
          )}

          {/* Priority & Status Section */}
          <div className="flex flex-col gap-3 p-3 border border-border rounded-none shadow-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-gray-400 bg-background">
            {/* Priority */}
            <div className="flex items-center gap-3">
              <HugeiconsIcon
                icon={PriorityIcon}
                className={cn("size-4", priorityColor)}
              />
              <div className="flex-1 text-xs">
                <span className="text-muted-foreground">
                  {tCalendar('priorityLabel')}:
                </span>{' '}
                <span className="font-medium">{priorityLabel}</span>
              </div>
            </div>

            {/* Status */}
            <div className="flex items-center gap-3">
              <HugeiconsIcon
                icon={StatusIcon}
                className="size-4 text-muted-foreground"
              />
              <div className="flex-1">
                <Badge variant={statusConfig.variant} className="text-[10px]">
                  {statusLabel}
                </Badge>
              </div>
            </div>
          </div>

          {/* Task duration if applicable */}
          {event.type === 'task' && event.durationMinutes && (
            <div className="flex items-center gap-3 p-3 border border-border rounded-none shadow-gray-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-gray-400 bg-background">
              <HugeiconsIcon
                icon={Clock01Icon}
                className="size-4 text-muted-foreground"
              />
              <div className="text-xs">
                <span className="text-muted-foreground">
                  {tDetail('durationLabel')}:
                </span>{' '}
                <span className="font-medium">
                  {event.durationMinutes < 60
                    ? `${event.durationMinutes} min`
                    : `${Math.floor(event.durationMinutes / 60)}h ${event.durationMinutes % 60 > 0 ? `${event.durationMinutes % 60}m` : ''}`}
                </span>
              </div>
            </div>
          )}

          {/* Type Badge */}
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] capitalize">
              {eventTypeLabel}
            </Badge>
          </div>
        </div>

        {/* Footer with actions */}
        {(onEdit || onDelete) && (
          <SheetFooter className="flex-row gap-2">
            {onEdit && (
              <Button
                variant="popout"
                onClick={() => {
                  onEdit()
                  onOpenChange(false)
                }}
                className="flex-1"
              >
                {tCommon('edit')}
              </Button>

            )}
            {onDelete && (
              <Button
                variant="hollow"
                onClick={() => {
                  onDelete()
                  onOpenChange(false)
                }}
                className="flex-1 text-destructive hover:text-destructive"
              >
                {tCommon('delete')}
              </Button>

            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
