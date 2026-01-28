import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

type CheckoutModule = typeof import('@/app/billing/checkout/page');

const redirectMock = vi.fn();
const getSessionMock = vi.fn();
const checkoutCreateMock = vi.fn();
const selectMock = vi.fn();
const findFirstMock = vi.fn();

let activeSubscriptions: Array<{ id: number }> = [];
let existingCustomer: { stripeCustomerId: string } | null = null;

const baseUrl = 'https://app.example.com';
const checkoutUrl = 'https://checkout.stripe.test/session';

const loadPage = async (): Promise<CheckoutModule> => {
  vi.doMock('next/navigation', () => ({ redirect: redirectMock }));
  vi.doMock('@/lib/auth', () => ({ getSession: getSessionMock }));
  vi.doMock('@/lib/stripe', () => ({
    stripe: {
      checkout: {
        sessions: {
          create: checkoutCreateMock,
        },
      },
    },
  }));
  vi.doMock('@/lib/db', () => ({
    db: {
      select: selectMock,
      query: {
        billingCustomers: {
          findFirst: findFirstMock,
        },
      },
    },
  }));

  return await import('@/app/billing/checkout/page');
};

const expectRedirect = async (promise: Promise<unknown>, url: string) => {
  await expect(promise).rejects.toThrow(`REDIRECT:${url}`);
  expect(redirectMock).toHaveBeenCalledWith(url);
};

describe('Billing checkout page', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    process.env = { ...originalEnv };
    process.env.NEXT_PUBLIC_APP_URL = baseUrl;
    process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_monthly';
    process.env.STRIPE_PRICE_PRO_YEARLY = 'price_yearly';

    redirectMock.mockImplementation((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    });

    activeSubscriptions = [];
    existingCustomer = null;

    selectMock.mockImplementation(() => ({
      from: () => ({
        where: () => ({
          limit: async () => activeSubscriptions,
        }),
      }),
    }));
    findFirstMock.mockImplementation(async () => existingCustomer);

    checkoutCreateMock.mockResolvedValue({ url: checkoutUrl });
    getSessionMock.mockResolvedValue({
      user: { id: 'user-123', email: 'user@example.com' },
      expires: new Date(Date.now() + 86400000).toISOString(),
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('redirects to /#planos when plan is invalid', async () => {
    const { default: BillingCheckoutPage } = await loadPage();

    await expectRedirect(
      BillingCheckoutPage({ searchParams: Promise.resolve({ plan: 'free' }) }),
      '/#planos'
    );

    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it('redirects to login with redirect param when unauthenticated', async () => {
    getSessionMock.mockResolvedValue(null);

    const { default: BillingCheckoutPage } = await loadPage();
    const redirectUrl = '/billing/checkout?plan=pro&interval=yearly';
    const expectedRedirect = `/login?redirect=${encodeURIComponent(redirectUrl)}`;

    await expectRedirect(
      BillingCheckoutPage({ searchParams: Promise.resolve({ plan: 'pro', interval: 'yearly' }) }),
      expectedRedirect
    );

    expect(selectMock).not.toHaveBeenCalled();
  });

  it('redirects to dashboard when an active subscription exists', async () => {
    activeSubscriptions = [{ id: 1 }];

    const { default: BillingCheckoutPage } = await loadPage();

    await expectRedirect(
      BillingCheckoutPage({ searchParams: Promise.resolve({ plan: 'pro', interval: 'monthly' }) }),
      '/dashboard'
    );

    expect(checkoutCreateMock).not.toHaveBeenCalled();
  });

  it('creates a checkout session for a new customer', async () => {
    const { default: BillingCheckoutPage } = await loadPage();

    await expectRedirect(
      BillingCheckoutPage({ searchParams: Promise.resolve({ plan: 'pro', interval: 'monthly' }) }),
      checkoutUrl
    );

    expect(checkoutCreateMock).toHaveBeenCalledTimes(1);
    const payload = checkoutCreateMock.mock.calls[0]?.[0];

    expect(payload).toEqual(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_monthly', quantity: 1 }],
        success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/#planos`,
        client_reference_id: 'user-123',
        customer_email: 'user@example.com',
        metadata: {
          userId: 'user-123',
          planKey: 'pro',
          planInterval: 'monthly',
        },
        subscription_data: {
          metadata: {
            userId: 'user-123',
            planKey: 'pro',
            planInterval: 'monthly',
          },
        },
      })
    );
    expect(payload.customer).toBeUndefined();
  });

  it('uses existing Stripe customer when available', async () => {
    existingCustomer = { stripeCustomerId: 'cus_123' };

    const { default: BillingCheckoutPage } = await loadPage();

    await expectRedirect(
      BillingCheckoutPage({ searchParams: Promise.resolve({ plan: 'pro', interval: 'yearly' }) }),
      checkoutUrl
    );

    const payload = checkoutCreateMock.mock.calls[0]?.[0];
    expect(payload.customer).toBe('cus_123');
    expect(payload.customer_email).toBeUndefined();
  });

  it('defaults interval to monthly when invalid', async () => {
    const { default: BillingCheckoutPage } = await loadPage();

    await expectRedirect(
      BillingCheckoutPage({ searchParams: Promise.resolve({ plan: 'pro', interval: 'weekly' }) }),
      checkoutUrl
    );

    const payload = checkoutCreateMock.mock.calls[0]?.[0];
    expect(payload.line_items[0].price).toBe('price_monthly');
    expect(payload.metadata.planInterval).toBe('monthly');
  });

  it('redirects back to pricing when checkout session has no url', async () => {
    checkoutCreateMock.mockResolvedValue({});

    const { default: BillingCheckoutPage } = await loadPage();

    await expectRedirect(
      BillingCheckoutPage({ searchParams: Promise.resolve({ plan: 'pro', interval: 'monthly' }) }),
      '/#planos'
    );
  });
});
