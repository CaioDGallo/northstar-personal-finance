import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('stripe-prices', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns price ids for pro monthly/yearly', async () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_monthly';
    process.env.STRIPE_PRICE_PRO_YEARLY = 'price_yearly';

    const { getStripePriceId } = await import('@/lib/billing/stripe-prices');

    expect(getStripePriceId('pro', 'monthly')).toBe('price_monthly');
    expect(getStripePriceId('pro', 'yearly')).toBe('price_yearly');
  });

  it('throws when a price is missing', async () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_monthly';
    delete process.env.STRIPE_PRICE_PRO_YEARLY;

    const { getStripePriceId } = await import('@/lib/billing/stripe-prices');

    expect(() => getStripePriceId('pro', 'yearly')).toThrow('Missing Stripe price for pro (yearly)');
  });

  it('maps price ids back to plan and interval', async () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_monthly';
    process.env.STRIPE_PRICE_PRO_YEARLY = 'price_yearly';

    const { getPlanFromStripePrice } = await import('@/lib/billing/stripe-prices');

    expect(getPlanFromStripePrice('price_monthly')).toEqual({ planKey: 'pro', interval: 'monthly' });
    expect(getPlanFromStripePrice('price_yearly')).toEqual({ planKey: 'pro', interval: 'yearly' });
  });

  it('returns null for unknown prices', async () => {
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_monthly';
    process.env.STRIPE_PRICE_PRO_YEARLY = 'price_yearly';

    const { getPlanFromStripePrice } = await import('@/lib/billing/stripe-prices');

    expect(getPlanFromStripePrice('price_unknown')).toBeNull();
  });
});
