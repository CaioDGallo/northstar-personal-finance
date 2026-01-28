import { redirect } from 'next/navigation';
import { and, eq, inArray } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { billingCustomers, billingSubscriptions } from '@/lib/schema';
import { stripe } from '@/lib/stripe';
import { DEFAULT_PLAN_INTERVAL, PLAN_INTERVALS, type PlanInterval } from '@/lib/plans';
import { getStripePriceId, type PaidPlanKey } from '@/lib/billing/stripe-prices';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ACTIVE_STATUSES = ['active', 'trialing', 'past_due'] as const;

type SearchParams = Record<string, string | string[] | undefined>;

function resolvePlan(value?: string): PaidPlanKey | null {
  // Only allow saver and founder - pro is waitlist only
  if (value === 'saver') return 'saver';
  if (value === 'founder') return 'founder';
  return null;
}

function resolveInterval(value?: string): PlanInterval {
  if (value && PLAN_INTERVALS.includes(value as PlanInterval)) {
    return value as PlanInterval;
  }
  return DEFAULT_PLAN_INTERVAL;
}

function getAppUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL is not set');
  }
  return baseUrl.replace(/\/$/, '');
}

export default async function BillingCheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const planParam = typeof params.plan === 'string' ? params.plan : undefined;
  const intervalParam = typeof params.interval === 'string' ? params.interval : undefined;

  const planKey = resolvePlan(planParam);
  if (!planKey) {
    redirect('/dashboard');
  }

  const planInterval = resolveInterval(intervalParam);

  const session = await getSession();
  if (!session?.user?.id) {
    const redirectUrl = `/billing/checkout?plan=${planKey}&interval=${planInterval}`;
    redirect(`/login?redirect=${encodeURIComponent(redirectUrl)}`);
  }

  const userId = session.user.id;

  const [activeSubscription] = await db
    .select({ id: billingSubscriptions.id })
    .from(billingSubscriptions)
    .where(
      and(
        eq(billingSubscriptions.userId, userId),
        inArray(billingSubscriptions.status, ACTIVE_STATUSES)
      )
    )
    .limit(1);

  if (activeSubscription) {
    redirect('/dashboard');
  }

  const existingCustomer = await db.query.billingCustomers.findFirst({
    where: eq(billingCustomers.userId, userId),
  });

  const priceId = getStripePriceId(planKey, planInterval);
  const baseUrl = getAppUrl();

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/dashboard`,
    client_reference_id: userId,
    customer: existingCustomer?.stripeCustomerId,
    customer_email: existingCustomer?.stripeCustomerId ? undefined : session.user.email || undefined,
    metadata: {
      userId,
      planKey,
      planInterval,
    },
    subscription_data: {
      metadata: {
        userId,
        planKey,
        planInterval,
      },
    },
  });

  if (!checkoutSession.url) {
    redirect('/dashboard');
  }

  redirect(checkoutSession.url);
}
