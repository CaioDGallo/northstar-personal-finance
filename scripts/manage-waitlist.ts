#!/usr/bin/env tsx

import 'dotenv/config';
import { createInviteWithoutAuth } from '@/lib/actions/invite';
import { waitlist } from '@/lib/auth-schema';
import { db } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import {
  generateWaitlistApprovedHtml,
  generateWaitlistApprovedText,
} from '@/lib/email/waitlist-approved-template';
import { type Locale } from '@/lib/i18n/config';
import { translateWithLocale } from '@/lib/i18n/server-errors';
import { PLAN_INTERVALS, PLAN_KEYS, type PlanInterval, type PlanKey } from '@/lib/plans';
import { asc, eq } from 'drizzle-orm';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { parseArgs } from 'node:util';

const DEFAULT_PLAN_KEY: PlanKey = 'pro';
const DEFAULT_PLAN_INTERVAL: PlanInterval = 'monthly';
const DEFAULT_EXPIRES_DAYS = 7;
const DEFAULT_MAX_USES = 1;

type ApprovedInvite = {
  email: string;
  code: string;
  command: string;
};

function showHelp() {
  console.log(`
Usage: tsx scripts/manage-waitlist.ts [options]

Options:
  --limit <n>           Max pending entries to review
  --plan <plan>         Invite plan (${PLAN_KEYS.join(', ')}) (default: ${DEFAULT_PLAN_KEY})
  --interval <interval> Billing interval (${PLAN_INTERVALS.join(', ')}) (default: ${DEFAULT_PLAN_INTERVAL})
  --expires <days>      Invite expiration in days (default: ${DEFAULT_EXPIRES_DAYS})
  --max-uses <n>         Max invite uses (default: ${DEFAULT_MAX_USES})
  -h, --help            Show this help
`);
}

function parseNumber(value: string | undefined, fallback: number, label: string) {
  const parsed = parseInt(value ?? `${fallback}`, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
}

function buildInviteCommand(planKey: PlanKey, planInterval: PlanInterval, expiresInDays: number, maxUses: number) {
  const args = [
    'tsx',
    'scripts/create-invite.ts',
    '--expires',
    String(expiresInDays),
    '--max-uses',
    String(maxUses),
    '--plan',
    planKey,
    '--interval',
    planInterval,
  ];
  return args.join(' ');
}

function formatMetadata(metadata: string | null) {
  if (!metadata) return '-';
  try {
    const parsed = JSON.parse(metadata) as unknown;
    return JSON.stringify(parsed);
  } catch {
    return metadata;
  }
}

async function main() {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.includes('--help') || rawArgs.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  const { values } = parseArgs({
    args: rawArgs,
    options: {
      limit: { type: 'string' },
      plan: { type: 'string' },
      interval: { type: 'string' },
      expires: { type: 'string' },
      maxUses: { type: 'string' },
    },
  });

  const planKey = (values.plan?.toLowerCase() ?? DEFAULT_PLAN_KEY) as PlanKey;
  const planInterval = (values.interval?.toLowerCase() ?? DEFAULT_PLAN_INTERVAL) as PlanInterval;
  const expiresInDays = parseNumber(values.expires, DEFAULT_EXPIRES_DAYS, 'expires');
  const maxUses = parseNumber(values.maxUses, DEFAULT_MAX_USES, 'max-uses');
  const limit = values.limit ? parseNumber(values.limit, 0, 'limit') : undefined;

  if (!PLAN_KEYS.includes(planKey)) {
    console.error(`Error: Invalid plan. Use: ${PLAN_KEYS.join(', ')}`);
    process.exit(1);
  }

  if (!PLAN_INTERVALS.includes(planInterval)) {
    console.error(`Error: Invalid interval. Use: ${PLAN_INTERVALS.join(', ')}`);
    process.exit(1);
  }

  if (maxUses <= 0) {
    console.error('Error: --max-uses must be greater than 0');
    process.exit(1);
  }

  if (limit !== undefined && limit <= 0) {
    console.error('Error: --limit must be greater than 0');
    process.exit(1);
  }

  const pendingQuery = db
    .select({
      id: waitlist.id,
      email: waitlist.email,
      status: waitlist.status,
      createdAt: waitlist.createdAt,
      metadata: waitlist.metadata,
    })
    .from(waitlist)
    .where(eq(waitlist.status, 'pending'))
    .orderBy(asc(waitlist.createdAt));

  const pending = await (limit ? pendingQuery.limit(limit) : pendingQuery);

  if (pending.length === 0) {
    console.log('No pending waitlist entries.');
    return;
  }

  console.log(`Pending waitlist entries: ${pending.length}`);
  console.log('Invite defaults:');
  console.log(`  Plan: ${planKey}`);
  console.log(`  Interval: ${planInterval}`);
  console.log(`  Expires in days: ${expiresInDays}`);
  console.log(`  Max uses: ${maxUses}`);
  console.log('  Email restriction: none');
  console.log('');

  const rl = createInterface({ input, output });
  const approved: ApprovedInvite[] = [];
  let rejected = 0;
  let skipped = 0;
  let errors = 0;
  let emailFailures = 0;
  let quitEarly = false;
  const locale: Locale = 'pt-BR';
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://fluxo.sh';

  for (const entry of pending) {
    console.log('----------------------------------------');
    console.log(`ID: ${entry.id}`);
    console.log(`Email: ${entry.email}`);
    console.log(`Created: ${entry.createdAt?.toISOString() ?? 'unknown'}`);
    console.log(`Metadata: ${formatMetadata(entry.metadata)}`);
    console.log('');

    let action = '';
    while (!['a', 'r', 's', 'q'].includes(action)) {
      const answer = (await rl.question('Action [a=approve r=reject s=skip q=quit]: ')).trim().toLowerCase();
      action = answer || 's';
      if (!['a', 'r', 's', 'q'].includes(action)) {
        console.log('Invalid action. Use a, r, s, or q.');
      }
    }

    if (action === 'q') {
      quitEarly = true;
      break;
    }

    if (action === 's') {
      skipped += 1;
      continue;
    }

    if (action === 'r') {
      try {
        await db
          .update(waitlist)
          .set({ status: 'rejected', inviteCode: null, updatedAt: new Date() })
          .where(eq(waitlist.id, entry.id));
        rejected += 1;
        console.log(`Rejected: ${entry.email}`);
      } catch (error) {
        errors += 1;
        console.error(`Failed to reject ${entry.email}:`, error);
      }
      continue;
    }

    if (action === 'a') {
      try {
        const inviteResult = await createInviteWithoutAuth({
          expiresInDays,
          maxUses,
          planKey,
          planInterval,
          createdById: null,
        });

        if (!inviteResult.success || !inviteResult.code) {
          errors += 1;
          console.error(`Failed to create invite for ${entry.email}: ${inviteResult.error}`);
          continue;
        }

        try {
          await db
            .update(waitlist)
            .set({ status: 'approved', inviteCode: inviteResult.code, updatedAt: new Date() })
            .where(eq(waitlist.id, entry.id));
        } catch (updateError) {
          errors += 1;
          console.error(`Failed to update waitlist for ${entry.email}. Invite: ${inviteResult.code}`);
          console.error(updateError);
          continue;
        }

        const command = buildInviteCommand(planKey, planInterval, expiresInDays, maxUses);
        approved.push({ email: entry.email, code: inviteResult.code, command });
        console.log(`Approved: ${entry.email}`);
        console.log(`Invite code: ${inviteResult.code}`);

        const emailData = {
          inviteCode: inviteResult.code,
          appUrl,
          expiresInDays,
          locale,
        };
        const subject = translateWithLocale(locale, 'emails.waitlistApproved.subject');
        const html = generateWaitlistApprovedHtml(emailData);
        const text = generateWaitlistApprovedText(emailData);

        try {
          const emailResult = await sendEmail({
            to: entry.email,
            subject,
            html,
            text,
          });

          if (!emailResult.success) {
            emailFailures += 1;
            console.error(`Failed to send invite email to ${entry.email}: ${emailResult.error}`);
          }
        } catch (emailError) {
          emailFailures += 1;
          console.error(`Failed to send invite email to ${entry.email}:`, emailError);
        }
      } catch (error) {
        errors += 1;
        console.error(`Failed to approve ${entry.email}:`, error);
      }
    }
  }

  rl.close();

  console.log('');
  console.log('Summary');
  console.log(`  Approved: ${approved.length}`);
  console.log(`  Rejected: ${rejected}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Email failures: ${emailFailures}`);

  if (quitEarly) {
    console.log('Stopped early by request.');
  }

  if (approved.length > 0) {
    console.log('');
    console.log('Invite codes:');
    for (const item of approved) {
      console.log(`${item.email}: ${item.code}`);
    }
    console.log('');
    console.log('Invite commands (for reference):');
    for (const item of approved) {
      console.log(`${item.email}: ${item.command}`);
    }
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
