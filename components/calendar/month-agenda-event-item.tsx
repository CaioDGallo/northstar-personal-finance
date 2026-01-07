"use client"

import * as React from "react"
import { CalendarEvent } from "@schedule-x/calendar"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CircleIcon,
  Flag01Icon,
  Alert01Icon,
  Clock01Icon,
  Loading03Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu"

interface ExtendedCalendarEvent extends CalendarEvent {
  priority?: 'low' | 'medium' | 'high' | 'critical'
  status?: string
  itemType?: 'event' | 'task'
  itemId?: number
  isAllDay?: boolean
}

interface MonthAgendaEventItemProps {
  calendarEvent: ExtendedCalendarEvent
  onEdit?: (id: number, type: 'event' | 'task') => void
  onDelete?: (id: number, type: 'event' | 'task') => void
}

// Helper: Get priority icon component
function getPriorityIcon(priority: string) {
  const icons = {
    low: CircleIcon,
    medium: Flag01Icon,
    high: Flag01Icon,
    critical: Alert01Icon,
  }
  return icons[priority as keyof typeof icons] || CircleIcon
}

// Helper: Get priority color
function getPriorityColor(priority: string): string {
  const colors = {
    low: 'text-muted-foreground',
    medium: 'text-blue-600 dark:text-blue-400',
    high: 'text-orange-600 dark:text-orange-400',
    critical: 'text-red-600 dark:text-red-400',
  }
  return colors[priority as keyof typeof colors] || 'text-muted-foreground'
}

// Helper: Get status badge config
function getStatusConfig(status: string, itemType: string) {
  const eventStatuses: Record<string, { variant: "default" | "secondary" | "outline" | "ghost" | "destructive", icon: typeof Clock01Icon }> = {
    scheduled: { variant: "outline", icon: Clock01Icon },
    completed: { variant: "default", icon: Tick02Icon },
    cancelled: { variant: "ghost", icon: CircleIcon },
  }

  const taskStatuses: Record<string, { variant: "default" | "secondary" | "outline" | "ghost" | "destructive", icon: typeof Clock01Icon }> = {
    pending: { variant: "outline", icon: Clock01Icon },
    in_progress: { variant: "secondary", icon: Loading03Icon },
    completed: { variant: "default", icon: Tick02Icon },
    cancelled: { variant: "ghost", icon: CircleIcon },
  }

  const configs = itemType === 'event' ? eventStatuses : taskStatuses
  return configs[status] || { variant: "outline" as const, icon: Clock01Icon }
}

// Helper: Format time from Temporal.ZonedDateTime
function formatTime(zdt: unknown): string {
  if (!zdt || !zdt.toLocaleString) return ''

  try {
    return zdt.toLocaleString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return ''
  }
}

// Helper: Get border color for event type
function getEventTypeBorderColor(itemType: string): string {
  return itemType === 'event'
    ? 'border-l-[oklch(0.60_0.20_250)]' // Blue for events
    : 'border-l-[oklch(0.65_0.15_145)]'  // Green for tasks
}

export function MonthAgendaEventItem({
  calendarEvent,
  onEdit,
  onDelete,
}: MonthAgendaEventItemProps) {
  const {
    title = 'Untitled',
    start,
    end,
    priority = 'low',
    status = 'scheduled',
    itemType = 'event',
    itemId,
    isAllDay = false,
  } = calendarEvent

  // Format time range
  const timeDisplay = React.useMemo(() => {
    if (isAllDay) {
      return 'All day'
    }

    if (!start || !end) {
      return ''
    }

    const startTime = formatTime(start)
    const endTime = formatTime(end)

    if (!startTime || !endTime) {
      return ''
    }

    return `${startTime} - ${endTime}`
  }, [start, end, isAllDay])

  // Get priority icon and color
  const PriorityIcon = getPriorityIcon(priority)
  const priorityColor = getPriorityColor(priority)

  // Get status badge config
  const statusConfig = getStatusConfig(status, itemType)
  const StatusIcon = statusConfig.icon

  // Event type border color
  const borderColor = getEventTypeBorderColor(itemType)

  // Create accessible label
  const ariaLabel = `${title}${timeDisplay ? ` - ${timeDisplay}` : ''}${priority ? ` - Priority: ${priority}` : ''}${status ? ` - Status: ${status}` : ''}`

  // Handle context menu actions
  const handleEdit = () => {
    if (onEdit && itemId !== undefined) {
      onEdit(itemId, itemType)
    }
  }

  const handleDelete = () => {
    if (onDelete && itemId !== undefined) {
      onDelete(itemId, itemType)
    }
  }

  const eventContent = (
    <div
      className={cn(
        "group/event-item",
        "flex items-center gap-2",
        "px-2 py-4",
        "bg-background hover:bg-muted/50",
        "border border-border",
        "border-l-[3px]",
        borderColor,
        "rounded-none",
        "shadow-gray-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]",
        "dark:shadow-gray-400",
        "transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "cursor-pointer",
      )}
      aria-label={ariaLabel}
      title={title}
    >
      {/* Time display */}
      {timeDisplay && (
        <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
          {timeDisplay}
        </span>
      )}

      {/* Priority indicator */}
      <HugeiconsIcon
        icon={PriorityIcon}
        className={cn("size-3 shrink-0", priorityColor)}
        aria-label={`Priority: ${priority}`}
      />

      {/* Title */}
      <span
        className={cn(
          "flex-1 text-xs font-medium truncate",
          status === 'cancelled' && "line-through opacity-60"
        )}
      >
        {title}
      </span>

      {/* Status badge */}
      <Badge
        variant={statusConfig.variant}
        className="text-[10px] p-2 h-auto gap-1 shrink-0"
        aria-label={`Status: ${status}`}
      >
        <HugeiconsIcon icon={StatusIcon} className="size-2.5" />
        <span className="hidden sm:inline">{status.replace('_', ' ')}</span>
      </Badge>
    </div>
  )

  // If no handlers provided, return without context menu
  if (!onEdit && !onDelete) {
    return eventContent
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {eventContent}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {onEdit && (
          <ContextMenuItem onClick={handleEdit}>
            <span>Edit {itemType}</span>
          </ContextMenuItem>
        )}
        {onDelete && (
          <ContextMenuItem variant="destructive" onClick={handleDelete}>
            <span>Delete {itemType}</span>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  )
}
