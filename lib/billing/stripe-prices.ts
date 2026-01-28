import { type PlanInterval, type PlanKey } from '@/lib/plans';

export type PaidPlanKey = Exclude<PlanKey, 'free'>;

const STRIPE_PRICE_IDS: Record<PaidPlanKey, Record<PlanInterval, string | undefined>> = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
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
