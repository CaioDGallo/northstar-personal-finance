'use server';

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { billingCustomers } from '@/lib/schema';
import { stripe } from '@/lib/stripe';
import { eq } from 'drizzle-orm';

function getAppUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL;
  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL is not set');
  }
  return baseUrl.replace(/\/$/, '');
}

export async function createBillingPortalSession() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error('Not authenticated');
  }

  const userId = session.user.id;

  // Get Stripe customer ID
  const customer = await db.query.billingCustomers.findFirst({
    where: eq(billingCustomers.userId, userId),
  });

  if (!customer?.stripeCustomerId) {
    throw new Error('No billing customer found');
  }

  const baseUrl = getAppUrl();

  // Create Stripe billing portal session
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customer.stripeCustomerId,
    return_url: `${baseUrl}/settings/plan`,
  });

  redirect(portalSession.url);
}
