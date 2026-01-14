import { NextResponse } from 'next/server';
import { processPendingNotificationJobs } from '@/lib/actions/notification-jobs';
import { reconcileAllAccountBalances } from '@/lib/actions/accounts';
import { updatePastItemStatuses } from '@/lib/actions/status-updates';
import { syncAllUsersCalendars } from '@/lib/actions/calendar-sync';
import { sendAllDailyDigests } from '@/lib/actions/daily-digest';
import { scheduleBillReminderNotifications } from '@/lib/actions/bill-reminder-jobs';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  console.log('[cron:daily] Invoked');

  const authHeader = request.headers.get('authorization');

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[cron:daily] Auth failed - check CRON_SECRET env var');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[cron:daily] Auth passed, running jobs...');

  const url = new URL(request.url);
  const jobOverride = url.searchParams.get('job');

  // Determine which jobs to run
  const runNotifications = !jobOverride || jobOverride === 'notifications' || jobOverride === 'all';
  const runBillReminders = !jobOverride || jobOverride === 'bill-reminders' || jobOverride === 'all';
  const runBalanceReconciliation = !jobOverride || jobOverride === 'balance-reconciliation' || jobOverride === 'all';
  const runStatusUpdates = !jobOverride || jobOverride === 'status-updates' || jobOverride === 'all';
  const runCalendarSync = !jobOverride || jobOverride === 'calendar-sync' || jobOverride === 'all';
  const runDailyDigest = !jobOverride || jobOverride === 'daily-digest' || jobOverride === 'all';

  try {
    const [notificationResult, billReminderResult, balanceResult, statusResult, calendarSyncResult, dailyDigestResult] = await Promise.all([
      runNotifications ? processPendingNotificationJobs() : Promise.resolve(null),
      runBillReminders ? scheduleBillReminderNotifications() : Promise.resolve(null),
      runBalanceReconciliation ? reconcileAllAccountBalances() : Promise.resolve(null),
      runStatusUpdates ? updatePastItemStatuses() : Promise.resolve(null),
      runCalendarSync ? syncAllUsersCalendars() : Promise.resolve(null),
      runDailyDigest ? sendAllDailyDigests() : Promise.resolve(null),
    ]);

    console.log('[cron:daily] All jobs completed');

    return NextResponse.json({
      success: true,
      notifications: notificationResult,
      billReminders: billReminderResult,
      balanceReconciliation: balanceResult,
      statusUpdates: statusResult,
      calendarSync: calendarSyncResult,
      dailyDigest: dailyDigestResult,
    });
  } catch (error) {
    console.error('[cron:daily] Failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
