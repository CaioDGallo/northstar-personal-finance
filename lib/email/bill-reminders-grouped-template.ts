import { type Locale, defaultLocale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';
import { formatCurrencyWithLocale } from '@/lib/utils';

export interface GroupedBillRemindersEmailData {
  reminders: Array<{
    reminderName: string;
    amount: number | null;
    categoryName: string | null;
    categoryColor: string | null;
    dueDate: string;
    dueTime: string | null;
    daysUntilDue: number; // 0, 1, 2
  }>;
  scheduledDate: string; // formatted date for email subject
  appUrl: string;
  locale?: Locale;
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
};

function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateGroupedBillRemindersHtml(data: GroupedBillRemindersEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.billReminders.title');
  const count = data.reminders.length;
  const countText = t('emails.billReminders.count', { count });
  const viewAllRemindersLabel = t('emails.billReminders.viewAllReminders');
  const footerText = t('emails.billReminders.footer');
  const dueLabel = t('emails.billReminder.due');
  const categoryLabel = t('emails.billReminder.category');
  const atLabel = t('emails.billReminder.at');

  // Sort reminders by urgency (0 = today, 1 = tomorrow, 2 = 2 days)
  const sortedReminders = [...data.reminders].sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const getUrgencyColor = (daysUntilDue: number) =>
    daysUntilDue === 0 ? COLORS.critical : daysUntilDue === 1 ? COLORS.high : COLORS.medium;

  const getUrgencyText = (daysUntilDue: number) =>
    daysUntilDue === 0
      ? t('emails.billReminder.dueToday')
      : daysUntilDue === 1
        ? t('emails.billReminder.dueTomorrow')
        : t('emails.billReminder.dueInTwoDays');

  const reminderCards = sortedReminders
    .map((reminder) => {
      const urgencyColor = getUrgencyColor(reminder.daysUntilDue);
      const urgencyText = getUrgencyText(reminder.daysUntilDue);
      const amountDisplay = reminder.amount ? formatCurrencyWithLocale(reminder.amount, locale) : '';

      return `
    <div style="background: ${COLORS.card}; border: 2px solid ${COLORS.border}; padding: 16px; margin-bottom: 16px;">
      <div style="margin-bottom: 8px;">
        <span style="display: inline-block; background: ${urgencyColor}; color: white; padding: 4px 8px; font-size: 11px; font-weight: 700;">
          ${urgencyText}
        </span>
      </div>
      ${
        reminder.categoryName && reminder.categoryColor
          ? `<div style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${reminder.categoryColor}; margin-bottom: 6px;"></div>`
          : ''
      }
      <h3 style="margin: 0 0 6px 0; color: ${COLORS.fg}; font-size: 16px; font-weight: 500;">${escapeHtml(reminder.reminderName)}</h3>
      ${amountDisplay ? `<p style="font-size: 22px; margin: 6px 0; color: ${COLORS.fg}; font-weight: 700;">${amountDisplay}</p>` : ''}
      ${reminder.categoryName ? `<p style="color: ${COLORS.muted}; font-size: 11px; margin: 4px 0;">${categoryLabel}: ${escapeHtml(reminder.categoryName)}</p>` : ''}
      <p style="margin: 6px 0 0 0; color: ${COLORS.fg}; font-weight: 500; font-size: 13px;">
        ${dueLabel}: ${escapeHtml(reminder.dueDate)}${reminder.dueTime ? ` ${atLabel} ${escapeHtml(reminder.dueTime)}` : ''}
      </p>
    </div>
      `.trim();
    })
    .join('\n');

  return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'JetBrains Mono', monospace; background: ${COLORS.bg}; font-size: 14px; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="border-bottom: 2px solid ${COLORS.fg}; padding-bottom: 12px; margin-bottom: 24px;">
      <h1 style="margin: 0 0 8px 0; color: ${COLORS.fg}; font-size: 24px; font-weight: 700;">${title}</h1>
      <p style="margin: 0; color: ${COLORS.muted}; font-size: 14px;">${countText}</p>
    </div>

    <!-- Reminder Cards -->
    ${reminderCards}

    <!-- CTA Button -->
    <div style="text-align: center; margin: 24px 0;">
      <a href="${data.appUrl}/reminders" style="display: inline-block; background: ${COLORS.fg}; color: ${COLORS.bg}; padding: 12px 24px; text-decoration: none; font-weight: 700; border: 2px solid ${COLORS.fg};">
        ${viewAllRemindersLabel}
      </a>
    </div>

    <!-- Footer -->
    <div style="border-top: 1px solid ${COLORS.border}; padding-top: 16px; text-align: center;">
      <p style="color: ${COLORS.muted}; font-size: 12px; margin: 0;">
        ${footerText}
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export function generateGroupedBillRemindersText(data: GroupedBillRemindersEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const title = t('emails.billReminders.title').toUpperCase();
  const count = data.reminders.length;
  const countText = t('emails.billReminders.count', { count });
  const viewRemindersText = t('emails.billReminder.viewRemindersText');
  const footerText = t('emails.billReminders.footer');
  const dueLabel = t('emails.billReminder.due');
  const categoryLabel = t('emails.billReminder.category');
  const atLabel = t('emails.billReminder.at');

  // Sort reminders by urgency
  const sortedReminders = [...data.reminders].sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const getUrgencyText = (daysUntilDue: number) =>
    daysUntilDue === 0
      ? t('emails.billReminder.dueToday')
      : daysUntilDue === 1
        ? t('emails.billReminder.dueTomorrow')
        : t('emails.billReminder.dueInTwoDays');

  const remindersList = sortedReminders
    .map((reminder) => {
      const urgencyText = getUrgencyText(reminder.daysUntilDue);
      const amountDisplay = reminder.amount ? formatCurrencyWithLocale(reminder.amount, locale) : '';

      return `
[${urgencyText.toUpperCase()}] ${reminder.reminderName}
${amountDisplay ? `${t('emails.billReminder.amount')}: ${amountDisplay}` : ''}
${reminder.categoryName ? `${categoryLabel}: ${reminder.categoryName}` : ''}
${dueLabel}: ${reminder.dueDate}${reminder.dueTime ? ` ${atLabel} ${reminder.dueTime}` : ''}
      `.trim();
    })
    .join('\n\n---\n\n');

  return `
${title}

${countText}

${remindersList}

${viewRemindersText} ${data.appUrl}/reminders

---
${footerText}
  `.trim();
}
