import { type PlanInterval, type PlanKey } from '@/lib/plans';

export type PaidPlanKey = Exclude<PlanKey, 'free'>;

const STRIPE_PRICE_IDS: Record<PaidPlanKey, Record<PlanInterval, string | undefined>> = {
  saver: {
    monthly: process.env.STRIPE_PRICE_SAVER_MONTHLY,
    yearly: process.env.STRIPE_PRICE_SAVER_YEARLY,
  },
  founder: {
    monthly: undefined, // Founder only available yearly
    yearly: process.env.STRIPE_PRICE_FOUNDER_YEARLY,
  },
  pro: {
    // Pro (Liberdade) plan not available yet - still in waitlist
    monthly: undefined,
    yearly: undefined,
  },
};

export function getStripePriceId(planKey: PaidPlanKey, interval: PlanInterval): string {
  const priceId = STRIPE_PRICE_IDS[planKey]?.[interval];
  if (!priceId) {
    throw new Error(`Missing Stripe price for ${planKey} (${interval})`);
  }
  return priceId;
}

export function getPlanFromStripePrice(priceId: string): {
  planKey: PaidPlanKey;
  interval: PlanInterval;
} | null {
  for (const [planKey, intervals] of Object.entries(STRIPE_PRICE_IDS) as [
    PaidPlanKey,
    Record<PlanInterval, string | undefined>
  ][]) {
    for (const [interval, configuredPriceId] of Object.entries(intervals) as [
      PlanInterval,
      string | undefined
    ][]) {
      if (configuredPriceId && configuredPriceId === priceId) {
        return { planKey, interval };
      }
    }
  }

  return null;
}
