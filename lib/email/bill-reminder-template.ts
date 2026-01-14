import { type Locale, defaultLocale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';
import { formatCurrencyWithLocale } from '@/lib/utils';

export interface BillReminderEmailData {
  reminderName: string;
  amount: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  dueDate: string; // formatted
  dueTime: string | null;
  daysUntilDue: number; // 0, 1, or 2
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

export function generateBillReminderHtml(data: BillReminderEmailData): string {
  const urgencyColor =
    data.daysUntilDue === 0
      ? COLORS.critical
      : data.daysUntilDue === 1
        ? COLORS.high
        : COLORS.medium;

  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const urgencyText =
    data.daysUntilDue === 0
      ? t('emails.billReminder.dueToday')
      : data.daysUntilDue === 1
        ? t('emails.billReminder.dueTomorrow')
        : t('emails.billReminder.dueInTwoDays');

  const amountDisplay = data.amount ? formatCurrencyWithLocale(data.amount, locale) : '';
  const dueLabel = t('emails.billReminder.due');
  const categoryLabel = t('emails.billReminder.category');
  const atLabel = t('emails.billReminder.at');
  const title = t('emails.billReminder.title');
  const viewRemindersLabel = t('emails.billReminder.viewReminders');
  const footerText = t('emails.billReminder.footer');

  return `
<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}: ${escapeHtml(data.reminderName)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
</head>
<body style="margin: 0; padding: 0; font-family: 'JetBrains Mono', monospace; background: ${COLORS.bg}; font-size: 14px; line-height: 1.6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="border-bottom: 2px solid ${COLORS.fg}; padding-bottom: 12px; margin-bottom: 24px;">
      <h1 style="margin: 0 0 8px 0; color: ${COLORS.fg}; font-size: 24px; font-weight: 700;">${title}</h1>
      <span style="display: inline-block; background: ${urgencyColor}; color: white; padding: 4px 8px; font-size: 12px; font-weight: 700;">
        ${urgencyText}
      </span>
    </div>

    <!-- Bill Details Card -->
    <div style="background: ${COLORS.card}; border: 2px solid ${COLORS.border}; padding: 16px; margin-bottom: 24px;">
      ${
        data.categoryName && data.categoryColor
          ? `<div style="display: inline-block; width: 16px; height: 16px; border-radius: 50%; background: ${data.categoryColor}; margin-bottom: 8px;"></div>`
          : ''
      }
      <h2 style="margin: 0 0 8px 0; color: ${COLORS.fg}; font-size: 18px; font-weight: 500;">${escapeHtml(data.reminderName)}</h2>
      ${amountDisplay ? `<p style="font-size: 28px; margin: 8px 0; color: ${COLORS.fg}; font-weight: 700;">${amountDisplay}</p>` : ''}
      ${data.categoryName ? `<p style="color: ${COLORS.muted}; font-size: 12px; margin: 4px 0;">${categoryLabel}: ${escapeHtml(data.categoryName)}</p>` : ''}
      <p style="margin: 8px 0 0 0; color: ${COLORS.fg}; font-weight: 500;">
        ${dueLabel}: ${escapeHtml(data.dueDate)}${data.dueTime ? ` ${atLabel} ${escapeHtml(data.dueTime)}` : ''}
      </p>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${data.appUrl}/reminders" style="display: inline-block; background: ${COLORS.fg}; color: ${COLORS.bg}; padding: 12px 24px; text-decoration: none; font-weight: 700; border: 2px solid ${COLORS.fg};">
        ${viewRemindersLabel}
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

export function generateBillReminderText(data: BillReminderEmailData): string {
  const locale = data.locale ?? defaultLocale;
  const t = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(locale, key, params);

  const urgencyText =
    data.daysUntilDue === 0
      ? t('emails.billReminder.dueToday')
      : data.daysUntilDue === 1
        ? t('emails.billReminder.dueTomorrow')
        : t('emails.billReminder.dueInTwoDays');

  const amountDisplay = data.amount ? formatCurrencyWithLocale(data.amount, locale) : '';
  const dueLabel = t('emails.billReminder.due');
  const categoryLabel = t('emails.billReminder.category');
  const atLabel = t('emails.billReminder.at');
  const heading = t('emails.billReminder.textHeading', { urgency: urgencyText });
  const viewRemindersText = t('emails.billReminder.viewRemindersText');
  const footerText = t('emails.billReminder.footer');

  return `
${heading}

${data.reminderName}
${amountDisplay ? `${t('emails.billReminder.amount')}: ${amountDisplay}` : ''}
${data.categoryName ? `${categoryLabel}: ${data.categoryName}` : ''}
${dueLabel}: ${data.dueDate}${data.dueTime ? ` ${atLabel} ${data.dueTime}` : ''}

${viewRemindersText} ${data.appUrl}/reminders

---
${footerText}
  `.trim();
}
