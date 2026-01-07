"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon,
  Clock01Icon,
  Location01Icon,
  Tick02Icon,
  Flag01Icon,
  Alert01Icon,
  CircleIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"

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
  onEdit?: () => void
  onDelete?: () => void
}

// Helper: Get priority icon
function getPriorityIcon(priority: string) {
  const icons = {
    low: CircleIcon,
    medium: Flag01Icon,
    high: Flag01Icon,
    critical: Alert01Icon,
  }
  return icons[priority as keyof typeof icons] || CircleIcon
}

// Helper: Get priority color and label
function getPriorityInfo(priority: string) {
  const info = {
    low: { color: 'text-muted-foreground', label: 'Low' },
    medium: { color: 'text-blue-600 dark:text-blue-400', label: 'Medium' },
    high: { color: 'text-orange-600 dark:text-orange-400', label: 'High' },
    critical: { color: 'text-red-600 dark:text-red-400', label: 'Critical' },
  }
  return info[priority as keyof typeof info] || info.low
}

// Helper: Get status badge config
function getStatusConfig(status: string, type: string) {
  const eventStatuses: Record<string, { variant: "default" | "secondary" | "outline" | "ghost", icon: typeof Clock01Icon }> = {
    scheduled: { variant: "outline", icon: Clock01Icon },
    completed: { variant: "default", icon: Tick02Icon },
    cancelled: { variant: "ghost", icon: CircleIcon },
  }

  const taskStatuses: Record<string, { variant: "default" | "secondary" | "outline" | "ghost", icon: typeof Clock01Icon }> = {
    pending: { variant: "outline", icon: Clock01Icon },
    in_progress: { variant: "secondary", icon: Loading03Icon },
    completed: { variant: "default", icon: Tick02Icon },
    cancelled: { variant: "ghost", icon: CircleIcon },
  }

  const configs = type === 'event' ? eventStatuses : taskStatuses
  return configs[status] || { variant: "outline" as const, icon: Clock01Icon }
}

// Helper: Format date/time
function formatDateTime(date: Date, isAllDay?: boolean): string {
  if (isAllDay) {
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return date.toLocaleString(undefined, {
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
function formatDuration(start: Date, end: Date, isAllDay?: boolean): string {
  if (isAllDay) {
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    return days === 1 ? 'All day' : `${days} days`
  }

  const minutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

export function EventDetailSheet({
  open,
  onOpenChange,
  event,
  onEdit,
  onDelete,
}: EventDetailSheetProps) {
  if (!event) return null

  const priorityInfo = getPriorityInfo(event.priority)
  const PriorityIcon = getPriorityIcon(event.priority)
  const statusConfig = getStatusConfig(event.status, event.type)
  const StatusIcon = statusConfig.icon

  const duration = formatDuration(event.startAt, event.endAt, event.isAllDay)

  // Type indicator color
  const typeColor = event.type === 'event'
    ? 'bg-[oklch(0.60_0.20_250)]' // Blue
    : 'bg-[oklch(0.65_0.15_145)]'  // Green

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          {/* Type indicator bar */}
          <div className={cn("h-1 w-full mb-4 rounded-none", typeColor)} />

          <SheetTitle className="text-base font-bold">
            {event.title}
          </SheetTitle>

          {event.description && (
            <SheetDescription className="text-xs text-foreground/80 pt-2">
              {event.description}
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
                  {formatDateTime(event.startAt, event.isAllDay)}
                </div>
                {!event.isAllDay && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    to {formatDateTime(event.endAt, event.isAllDay)}
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
                className={cn("size-4", priorityInfo.color)}
              />
              <div className="flex-1 text-xs">
                <span className="text-muted-foreground">Priority:</span>{' '}
                <span className="font-medium">{priorityInfo.label}</span>
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
                  {event.status.replace('_', ' ')}
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
                <span className="text-muted-foreground">Duration:</span>{' '}
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
              {event.type}
            </Badge>
          </div>
        </div>

        {/* Footer with actions */}
        {(onEdit || onDelete) && (
          <SheetFooter className="flex-row gap-2">
            {onEdit && (
              <Button
                variant="hollow"
                onClick={() => {
                  onEdit()
                  onOpenChange(false)
                }}
                className="flex-1"
              >
                Edit
              </Button>
            )}
            {onDelete && (
              <Button
                variant="outline"
                onClick={() => {
                  onDelete()
                  onOpenChange(false)
                }}
                className="flex-1 text-destructive hover:text-destructive"
              >
                Delete
              </Button>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}
