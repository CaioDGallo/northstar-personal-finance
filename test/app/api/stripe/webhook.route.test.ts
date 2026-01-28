import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupTestDb, teardownTestDb, clearAllTables, getTestDb } from '@/test/db-utils';
import * as schema from '@/lib/schema';
import { eq } from 'drizzle-orm';

let db: ReturnType<typeof getTestDb>;
let POST: typeof import('@/app/api/stripe/webhook/route').POST;

const constructEventMock = vi.fn();
const webhookSecret = 'whsec_test';

const makeRequest = (body = 'payload', signature?: string) =>
  new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    body,
    headers: signature ? { 'stripe-signature': signature } : {},
  });

describe('POST /api/stripe/webhook', () => {
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    vi.resetModules();
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_monthly';
    process.env.STRIPE_PRICE_PRO_YEARLY = 'price_yearly';

    db = await setupTestDb();

    vi.doMock('@/lib/db', () => ({ db }));
    vi.doMock('@/lib/stripe', () => ({
      stripe: {
        webhooks: {
          constructEvent: constructEventMock,
        },
      },
    }));

    ({ POST } = await import('@/app/api/stripe/webhook/route'));
  });

  afterAll(async () => {
    process.env = { ...originalEnv };
    await teardownTestDb();
  });

  beforeEach(async () => {
    await clearAllTables();
    vi.clearAllMocks();
    constructEventMock.mockReset();
    process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
  });

  it('returns 500 when webhook secret is missing', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const response = await POST(makeRequest('payload', 'sig'));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe('STRIPE_WEBHOOK_SECRET not configured');
  });

  it('returns 400 when signature is missing', async () => {
    const response = await POST(makeRequest('payload'));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Missing Stripe signature');
  });

  it('returns 400 when signature validation fails', async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error('bad signature');
    });

    const response = await POST(makeRequest('payload', 'sig'));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Invalid signature');
    expect(constructEventMock).toHaveBeenCalledWith('payload', 'sig', webhookSecret);
  });

  it('upserts billing customer on checkout.session.completed', async () => {
    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: 'user-123',
          customer: 'cus_123',
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true });

    const customers = await db.select().from(schema.billingCustomers);
    expect(customers).toHaveLength(1);
    expect(customers[0]?.userId).toBe('user-123');
    expect(customers[0]?.stripeCustomerId).toBe('cus_123');
  });

  it('uses metadata userId when client_reference_id is missing', async () => {
    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_456',
          metadata: { userId: 'user-456' },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));

    expect(response.status).toBe(200);

    const customers = await db.select().from(schema.billingCustomers);
    expect(customers).toHaveLength(1);
    expect(customers[0]?.userId).toBe('user-456');
    expect(customers[0]?.stripeCustomerId).toBe('cus_456');
  });

  it('ignores checkout sessions without userId', async () => {
    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_missing',
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(200);

    const customers = await db.select().from(schema.billingCustomers);
    expect(customers).toHaveLength(0);
  });

  it('stores subscription details for pro plan', async () => {
    const periodStart = 1_700_000_000;
    const periodEnd = 1_702_592_000;

    constructEventMock.mockReturnValue({
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_123',
          status: 'active',
          customer: 'cus_123',
          cancel_at_period_end: false,
          trial_end: null,
          ended_at: null,
          metadata: { userId: 'user-123', planKey: 'pro', planInterval: 'monthly' },
          items: {
            data: [
              {
                current_period_start: periodStart,
                current_period_end: periodEnd,
                price: {
                  id: 'price_monthly',
                  product: { id: 'prod_123' },
                },
              },
            ],
          },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true });

    const customers = await db.select().from(schema.billingCustomers);
    expect(customers).toHaveLength(1);
    expect(customers[0]?.stripeCustomerId).toBe('cus_123');

    const subscriptions = await db.select().from(schema.billingSubscriptions);
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]?.userId).toBe('user-123');
    expect(subscriptions[0]?.planKey).toBe('pro');
    expect(subscriptions[0]?.status).toBe('active');
    expect(subscriptions[0]?.stripeSubscriptionId).toBe('sub_123');
    expect(subscriptions[0]?.stripePriceId).toBe('price_monthly');
    expect(subscriptions[0]?.stripeProductId).toBe('prod_123');
    expect(new Date(subscriptions[0]?.currentPeriodStart ?? 0).getTime()).toBe(periodStart * 1000);
    expect(new Date(subscriptions[0]?.currentPeriodEnd ?? 0).getTime()).toBe(periodEnd * 1000);
  });

  it('resolves userId from existing billing customer and price mapping', async () => {
    await db.insert(schema.billingCustomers).values({
      userId: 'user-999',
      stripeCustomerId: 'cus_999',
    });

    constructEventMock.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_999',
          status: 'past_due',
          customer: 'cus_999',
          cancel_at_period_end: true,
          trial_end: null,
          ended_at: null,
          metadata: {},
          items: {
            data: [
              {
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_592_000,
                price: {
                  id: 'price_monthly',
                  product: 'prod_999',
                },
              },
            ],
          },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(200);

    const subscriptions = await db
      .select()
      .from(schema.billingSubscriptions)
      .where(eq(schema.billingSubscriptions.stripeSubscriptionId, 'sub_999'));
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]?.userId).toBe('user-999');
    expect(subscriptions[0]?.planKey).toBe('pro');
    expect(subscriptions[0]?.stripeProductId).toBe('prod_999');
  });

  it('updates existing subscriptions on repeat events', async () => {
    constructEventMock
      .mockReturnValueOnce({
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_repeat',
            status: 'active',
            customer: 'cus_repeat',
            cancel_at_period_end: false,
            trial_end: null,
            ended_at: null,
            metadata: { userId: 'user-repeat', planKey: 'pro' },
            items: {
              data: [
                {
                  current_period_start: 1_700_000_000,
                  current_period_end: 1_702_592_000,
                  price: {
                    id: 'price_monthly',
                    product: 'prod_repeat',
                  },
                },
              ],
            },
          },
        },
      })
      .mockReturnValueOnce({
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_repeat',
            status: 'past_due',
            customer: 'cus_repeat',
            cancel_at_period_end: true,
            trial_end: null,
            ended_at: null,
            metadata: { userId: 'user-repeat', planKey: 'pro' },
            items: {
              data: [
                {
                  current_period_start: 1_700_000_000,
                  current_period_end: 1_702_592_000,
                  price: {
                    id: 'price_monthly',
                    product: 'prod_repeat',
                  },
                },
              ],
            },
          },
        },
      });

    await POST(makeRequest('payload', 'sig'));
    await POST(makeRequest('payload', 'sig'));

    const subscriptions = await db
      .select()
      .from(schema.billingSubscriptions)
      .where(eq(schema.billingSubscriptions.stripeSubscriptionId, 'sub_repeat'));
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]?.status).toBe('past_due');
    expect(subscriptions[0]?.cancelAtPeriodEnd).toBe(true);
  });

  it('skips subscriptions without a matching plan', async () => {
    constructEventMock.mockReturnValue({
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_404',
          status: 'active',
          customer: 'cus_404',
          cancel_at_period_end: false,
          trial_end: null,
          ended_at: null,
          metadata: {},
          items: {
            data: [
              {
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_592_000,
                price: {
                  id: 'price_unknown',
                  product: 'prod_404',
                },
              },
            ],
          },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(200);

    const subscriptions = await db.select().from(schema.billingSubscriptions);
    expect(subscriptions).toHaveLength(0);
  });

  it('skips non-pro subscriptions', async () => {
    constructEventMock.mockReturnValue({
      type: 'customer.subscription.created',
      data: {
        object: {
          id: 'sub_free',
          status: 'active',
          customer: 'cus_free',
          cancel_at_period_end: false,
          trial_end: null,
          ended_at: null,
          metadata: { userId: 'user-free', planKey: 'free' },
          items: {
            data: [
              {
                current_period_start: 1_700_000_000,
                current_period_end: 1_702_592_000,
                price: {
                  id: 'price_monthly',
                  product: 'prod_free',
                },
              },
            ],
          },
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(200);

    const subscriptions = await db.select().from(schema.billingSubscriptions);
    expect(subscriptions).toHaveLength(0);
  });

  it('returns 500 when handler throws', async () => {
    const insertSpy = vi.spyOn(db, 'insert').mockImplementation(() => {
      throw new Error('boom');
    });

    constructEventMock.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          client_reference_id: 'user-500',
          customer: 'cus_500',
        },
      },
    });

    const response = await POST(makeRequest('payload', 'sig'));
    expect(response.status).toBe(500);
    expect(await response.text()).toBe('Webhook handler failed');

    insertSpy.mockRestore();
  });
});
