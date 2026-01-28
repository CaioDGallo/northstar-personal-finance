import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';
import { billingCustomers, billingSubscriptions } from '@/lib/schema';
import { getPlanFromStripePrice, type PaidPlanKey } from '@/lib/billing/stripe-prices';

export const runtime = 'nodejs';

function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
): string | null {
  if (!customer) return null;
  if (typeof customer === 'string') return customer;
  return customer.id;
}

function getProductId(
  product: string | Stripe.Product | Stripe.DeletedProduct | null | undefined
): string | null {
  if (!product) return null;
  return typeof product === 'string' ? product : product.id;
}

function toDate(seconds: number | null | undefined): Date | null {
  if (!seconds) return null;
  return new Date(seconds * 1000);
}

async function upsertBillingCustomer(userId: string, stripeCustomerId: string) {
  await db
    .insert(billingCustomers)
    .values({
      userId,
      stripeCustomerId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: billingCustomers.userId,
      set: {
        stripeCustomerId,
        updatedAt: new Date(),
      },
    });
}

export async function POST(req: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new NextResponse('STRIPE_WEBHOOK_SECRET not configured', { status: 500 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new NextResponse('Missing Stripe signature', { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    console.error('[stripe] webhook signature failed', error);
    return new NextResponse('Invalid signature', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.userId;
        const stripeCustomerId = getCustomerId(session.customer);

        if (userId && stripeCustomerId) {
          await upsertBillingCustomer(userId, stripeCustomerId);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const stripeCustomerId = getCustomerId(subscription.customer);
        const item = subscription.items.data[0];
        const stripePriceId = item?.price?.id || null;
        const stripeProductId = getProductId(item?.price?.product);
        const resolvedPlan = stripePriceId ? getPlanFromStripePrice(stripePriceId) : null;

        const planKey = (subscription.metadata?.planKey as PaidPlanKey | undefined) || resolvedPlan?.planKey;

        if (!planKey || planKey !== 'pro') {
          break;
        }

        let userId = subscription.metadata?.userId || null;
        if (!userId && stripeCustomerId) {
          const existingCustomer = await db.query.billingCustomers.findFirst({
            where: eq(billingCustomers.stripeCustomerId, stripeCustomerId),
          });
          userId = existingCustomer?.userId || null;
        }

        if (!userId || !stripeCustomerId) {
          break;
        }

        await upsertBillingCustomer(userId, stripeCustomerId);

        await db
          .insert(billingSubscriptions)
          .values({
            userId,
            planKey,
            status: subscription.status,
            currentPeriodStart: toDate(item?.current_period_start),
            currentPeriodEnd: toDate(item?.current_period_end),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            stripeSubscriptionId: subscription.id,
            stripePriceId,
            stripeProductId,
            trialEndsAt: toDate(subscription.trial_end),
            endedAt: toDate(subscription.ended_at),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: billingSubscriptions.stripeSubscriptionId,
            set: {
              userId,
              planKey,
              status: subscription.status,
              currentPeriodStart: toDate(item?.current_period_start),
              currentPeriodEnd: toDate(item?.current_period_end),
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              stripePriceId,
              stripeProductId,
              trialEndsAt: toDate(subscription.trial_end),
              endedAt: toDate(subscription.ended_at),
              updatedAt: new Date(),
            },
          });
        break;
      }

      default:
        break;
    }
  } catch (error) {
    console.error('[stripe] webhook handling failed', error);
    return new NextResponse('Webhook handler failed', { status: 500 });
  }

  return NextResponse.json({ received: true });
}
