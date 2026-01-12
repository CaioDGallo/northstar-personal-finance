export interface DigestEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date | null;
  isAllDay: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface DigestTask {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  dueAt: Date | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'overdue';
}

export interface DigestData {
  userName?: string;
  date: string;
  events: DigestEvent[];
  tasks: DigestTask[];
  overdueTasks: DigestTask[];
  appUrl: string;
  timezone: string;
}

const COLORS = {
  bg: '#f0f0f0',
  fg: '#1a1a1a',
  card: '#ffffff',
  border: '#666666',
  muted: '#888888',
  critical: '#dc2626',
  high: '#f97316',
  medium: '#eab308',
  low: '#888888',
};

function formatTime(date: Date, timezone: string, isAllDay: boolean): string {
  if (isAllDay) {
    return 'All day';
  }

  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    }).format(date);
  } catch {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
}

function formatDateTime(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone,
    }).format(date);
  } catch {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'critical':
      return COLORS.critical;
    case 'high':
      return COLORS.high;
    case 'medium':
      return COLORS.medium;
    default:
      return COLORS.low;
  }
}

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateDigestHtml(data: DigestData): string {
  const { events, tasks, overdueTasks, date, appUrl, timezone } = data;

  const eventsHtml = events.map(event => {
    const time = formatTime(event.startAt, timezone, event.isAllDay);
    const priorityColor = getPriorityColor(event.priority);

    return `
      <div style="background: ${COLORS.card}; border: 1px solid ${COLORS.border}; padding: 12px; margin: 8px 0;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <strong style="color: ${COLORS.fg}; font-size: 14px;">${escapeHtml(event.title)}</strong>
          <span style="color: ${COLORS.muted}; font-size: 12px; white-space: nowrap; margin-left: 8px;">${time}</span>
        </div>
        ${event.description ? `<p style="color: ${COLORS.muted}; font-size: 12px; margin: 4px 0 0 0;">${escapeHtml(event.description)}</p>` : ''}
        ${event.location ? `<p style="color: ${COLORS.muted}; font-size: 12px; margin: 4px 0 0 0;">📍 ${escapeHtml(event.location)}</p>` : ''}
        <div style="margin-top: 4px;">
          <span style="display: inline-block; background: ${priorityColor}; color: white; font-size: 10px; padding: 2px 6px; font-weight: bold;">${event.priority.toUpperCase()}</span>
        </div>
      </div>
    `;
  }).join('');

  const tasksHtml = tasks.map(task => {
    const dueTime = task.dueAt ? formatTime(task.dueAt, timezone, false) : 'No time set';
    const priorityColor = getPriorityColor(task.priority);

    return `
      <div style="background: ${COLORS.card}; border: 1px solid ${COLORS.border}; padding: 12px; margin: 8px 0;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <strong style="color: ${COLORS.fg}; font-size: 14px;">${escapeHtml(task.title)}</strong>
          <span style="color: ${COLORS.muted}; font-size: 12px; white-space: nowrap; margin-left: 8px;">Due: ${dueTime}</span>
        </div>
        ${task.description ? `<p style="color: ${COLORS.muted}; font-size: 12px; margin: 4px 0 0 0;">${escapeHtml(task.description)}</p>` : ''}
        ${task.location ? `<p style="color: ${COLORS.muted}; font-size: 12px; margin: 4px 0 0 0;">📍 ${escapeHtml(task.location)}</p>` : ''}
        <div style="margin-top: 4px;">
          <span style="display: inline-block; background: ${priorityColor}; color: white; font-size: 10px; padding: 2px 6px; font-weight: bold;">${task.priority.toUpperCase()}</span>
          ${task.status === 'in_progress' ? '<span style="display: inline-block; background: #3b82f6; color: white; font-size: 10px; padding: 2px 6px; font-weight: bold; margin-left: 4px;">IN PROGRESS</span>' : ''}
        </div>
      </div>
    `;
  }).join('');

  const overdueHtml = overdueTasks.map(task => {
    const dueDate = task.dueAt ? formatDateTime(task.dueAt, timezone) : 'No date set';
    const priorityColor = getPriorityColor(task.priority);

    return `
      <div style="background: ${COLORS.card}; border: 1px solid ${COLORS.border}; padding: 12px; margin: 8px 0;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
          <strong style="color: ${COLORS.fg}; font-size: 14px;">${escapeHtml(task.title)}</strong>
          <span style="color: ${COLORS.critical}; font-size: 12px; white-space: nowrap; margin-left: 8px;">Was due: ${dueDate}</span>
        </div>
        ${task.description ? `<p style="color: ${COLORS.muted}; font-size: 12px; margin: 4px 0 0 0;">${escapeHtml(task.description)}</p>` : ''}
        <div style="margin-top: 4px;">
          <span style="display: inline-block; background: ${priorityColor}; color: white; font-size: 10px; padding: 2px 6px; font-weight: bold;">${task.priority.toUpperCase()}</span>
        </div>
      </div>
    `;
  }).join('');

  const hasEvents = events.length > 0;
  const hasTasks = tasks.length > 0;
  const hasOverdue = overdueTasks.length > 0;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Daily Digest - Northstar</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'JetBrains Mono', 'Courier New', Courier, monospace; background: ${COLORS.bg};">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="border-bottom: 2px solid ${COLORS.fg}; padding-bottom: 12px; margin-bottom: 24px;">
      <h1 style="margin: 0 0 8px 0; color: ${COLORS.fg}; font-size: 24px; font-weight: bold;">Your Daily Digest</h1>
      <p style="margin: 0; color: ${COLORS.muted}; font-size: 14px;">${escapeHtml(date)}</p>
    </div>

    ${hasEvents ? `
    <!-- Events Section -->
    <div style="margin-bottom: 32px;">
      <h2 style="margin: 0 0 12px 0; color: ${COLORS.fg}; font-size: 18px; font-weight: bold;">Today's Events (${events.length})</h2>
      ${eventsHtml}
    </div>
    ` : ''}

    ${hasTasks ? `
    <!-- Tasks Section -->
    <div style="margin-bottom: 32px;">
      <h2 style="margin: 0 0 12px 0; color: ${COLORS.fg}; font-size: 18px; font-weight: bold;">Tasks Due Today (${tasks.length})</h2>
      ${tasksHtml}
    </div>
    ` : ''}

    ${hasOverdue ? `
    <!-- Overdue Section -->
    <div style="margin-bottom: 32px; border-left: 4px solid ${COLORS.critical}; padding-left: 16px;">
      <h2 style="margin: 0 0 12px 0; color: ${COLORS.critical}; font-size: 18px; font-weight: bold;">Overdue (${overdueTasks.length})</h2>
      ${overdueHtml}
    </div>
    ` : ''}

    <!-- CTA Button -->
    <div style="margin-top: 32px; text-align: center;">
      <a href="${appUrl}/calendar" style="display: inline-block; background: ${COLORS.fg}; color: ${COLORS.bg}; padding: 12px 24px; text-decoration: none; font-weight: bold; font-size: 14px; box-shadow: 4px 4px 0 ${COLORS.border};">
        View Calendar
      </a>
    </div>

    <!-- Footer -->
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid ${COLORS.border}; text-align: center;">
      <p style="margin: 0; color: ${COLORS.muted}; font-size: 12px;">
        Northstar - Your Personal Finance & Calendar
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function generateDigestText(data: DigestData): string {
  const { events, tasks, overdueTasks, date, appUrl, timezone } = data;

  let text = `YOUR DAILY DIGEST\n${date}\n\n`;

  if (events.length > 0) {
    text += `TODAY'S EVENTS (${events.length})\n${'='.repeat(40)}\n\n`;
    events.forEach(event => {
      const time = formatTime(event.startAt, timezone, event.isAllDay);
      text += `${event.title}\n`;
      text += `Time: ${time}\n`;
      if (event.description) text += `${event.description}\n`;
      if (event.location) text += `Location: ${event.location}\n`;
      text += `Priority: ${event.priority.toUpperCase()}\n\n`;
    });
  }

  if (tasks.length > 0) {
    text += `TASKS DUE TODAY (${tasks.length})\n${'='.repeat(40)}\n\n`;
    tasks.forEach(task => {
      const dueTime = task.dueAt ? formatTime(task.dueAt, timezone, false) : 'No time set';
      text += `${task.title}\n`;
      text += `Due: ${dueTime}\n`;
      if (task.description) text += `${task.description}\n`;
      if (task.location) text += `Location: ${task.location}\n`;
      text += `Priority: ${task.priority.toUpperCase()}\n`;
      if (task.status === 'in_progress') text += `Status: IN PROGRESS\n`;
      text += `\n`;
    });
  }

  if (overdueTasks.length > 0) {
    text += `OVERDUE (${overdueTasks.length})\n${'='.repeat(40)}\n\n`;
    overdueTasks.forEach(task => {
      const dueDate = task.dueAt ? formatDateTime(task.dueAt, timezone) : 'No date set';
      text += `${task.title}\n`;
      text += `Was due: ${dueDate}\n`;
      if (task.description) text += `${task.description}\n`;
      text += `Priority: ${task.priority.toUpperCase()}\n\n`;
    });
  }

  text += `\nView your calendar at: ${appUrl}/calendar\n`;
  text += `\nNorthstar - Your Personal Finance & Calendar`;

  return text;
}
