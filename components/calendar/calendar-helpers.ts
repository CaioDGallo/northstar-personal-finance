import { CalendarEvent } from "@schedule-x/calendar"
import {
  CircleIcon,
  Flag01Icon,
  Alert01Icon,
  Clock01Icon,
  Loading03Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

export interface ExtendedCalendarEvent extends CalendarEvent {
  priority?: 'low' | 'medium' | 'high' | 'critical'
  status?: 'active' | 'paused' | 'completed' | 'done' | 'todo' | 'in_progress' | 'confirmed' | 'tentative' | 'cancelled'
  itemType?: 'event' | 'task' | 'bill_reminder'
  itemId?: number
  isAllDay?: boolean
  amount?: number
  categoryId?: number
}

export interface CalendarEventItemProps {
  calendarEvent: ExtendedCalendarEvent
  onEdit?: (id: number, type: 'event' | 'task' | 'bill_reminder') => void
  onDelete?: (id: number, type: 'event' | 'task' | 'bill_reminder') => void
  onBillReminderClick?: (id: number) => void
}

// Helper: Get priority icon component
export function getPriorityIcon(priority: string) {
  const icons = {
    low: CircleIcon,
    medium: Flag01Icon,
    high: Flag01Icon,
    critical: Alert01Icon,
  }
  return icons[priority as keyof typeof icons] || CircleIcon
}

// Helper: Get priority color
export function getPriorityColor(priority: string): string {
  const colors = {
    low: 'text-muted-foreground',
    medium: 'text-blue-600 dark:text-blue-400',
    high: 'text-orange-600 dark:text-orange-400',
    critical: 'text-red-600 dark:text-red-400',
  }
  return colors[priority as keyof typeof colors] || 'text-muted-foreground'
}

// Helper: Get status badge config
export function getStatusConfig(status: string, itemType: string) {
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

  const billReminderStatuses: Record<string, { variant: "default" | "secondary" | "outline" | "ghost" | "destructive", icon: typeof Clock01Icon }> = {
    active: { variant: "outline", icon: Clock01Icon },
    paused: { variant: "ghost", icon: CircleIcon },
    completed: { variant: "default", icon: Tick02Icon },
  }

  let configs = eventStatuses
  if (itemType === 'task') {
    configs = taskStatuses
  } else if (itemType === 'bill_reminder') {
    configs = billReminderStatuses
  }

  return configs[status] || { variant: "outline" as const, icon: Clock01Icon }
}

// Helper: Format time from Temporal.ZonedDateTime
export function formatTime(zdt: unknown): string {
  if (!zdt || typeof zdt !== 'object' || !('toLocaleString' in zdt)) return ''

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (zdt as any).toLocaleString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return ''
  }
}

// Helper: Get border color for event type
export function getEventTypeBorderColor(itemType: string): string {
  switch (itemType) {
    case 'event':
      return 'border-l-[oklch(0.60_0.20_250)]' // Blue for events
    case 'task':
      return 'border-l-[oklch(0.65_0.15_145)]'  // Green for tasks
    case 'bill_reminder':
      return 'border-l-[oklch(0.70_0.15_85)]'   // Yellow for bill reminders
    default:
      return 'border-l-[oklch(0.60_0.20_250)]'  // Default to blue
  }
}
