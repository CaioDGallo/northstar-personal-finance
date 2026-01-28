'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LandingCtaTracker } from '@/components/tracking/landing-cta-tracker';
import { LandingSectionObserver } from '@/components/tracking/landing-section-observer';
import { cn } from '@/lib/utils';

type PricingInterval = 'monthly' | 'yearly';

const MONTHLY_PRICE_CENTS = {
  saver: 990,
  pro: 2490,
};

const YEARLY_MULTIPLIER = 10;
const YEARLY_DISCOUNT_MONTHS = 12 - YEARLY_MULTIPLIER;

const FOUNDER_PRICE_CENTS = 4990;

const YEARLY_PRICE_CENTS = {
  saver: MONTHLY_PRICE_CENTS.saver * YEARLY_MULTIPLIER,
  pro: MONTHLY_PRICE_CENTS.pro * YEARLY_MULTIPLIER,
};

export function PricingSection() {
  const t = useTranslations('landing');
  const locale = useLocale();
  const [interval, setInterval] = useState<PricingInterval>('monthly');

  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
      }),
    [locale]
  );

  const prices = interval === 'monthly' ? MONTHLY_PRICE_CENTS : YEARLY_PRICE_CENTS;
  const intervalSuffix =
    interval === 'monthly' ? t('pricingIntervalSuffixMonthly') : t('pricingIntervalSuffixYearly');
  const yearlyDiscountLabel = t('pricingYearlyDiscountLabel');
  const yearlyDiscountValue = t('pricingYearlyDiscountValue', { months: YEARLY_DISCOUNT_MONTHS });
  const checkoutDestination = `/billing/checkout?plan=pro&interval=${interval}`;

  const formatPrice = (cents: number) => formatter.format(cents / 100);
  const founderPrice = formatPrice(FOUNDER_PRICE_CENTS);

  return (
    <LandingSectionObserver sectionId="planos">
      <section id="planos" className="border-b border-border/80 bg-background">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
          <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-xl space-y-3">
              <h2 className="text-2xl font-bold md:text-3xl">{t('pricingTitle')}</h2>
              <p className="text-sm text-foreground/80 md:text-base">{t('pricingSubtitle')}</p>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-foreground/70">
                {t('pricingBillingLabel')}
              </p>
              <div className="w-fit inline-flex border-2 border-foreground bg-background shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <button
                  type="button"
                  onClick={() => setInterval('monthly')}
                  className={cn(
                    'px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.25em] transition-colors',
                    interval === 'monthly'
                      ? 'bg-foreground text-background'
                      : 'text-foreground/70 hover:bg-muted'
                  )}
                  aria-pressed={interval === 'monthly'}
                >
                  {t('pricingIntervalMonthly')}
                </button>
                <button
                  type="button"
                  onClick={() => setInterval('yearly')}
                  className={cn(
                    'border-l-2 border-foreground px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.25em] transition-colors',
                    interval === 'yearly'
                      ? 'bg-foreground text-background'
                      : 'text-foreground/70 hover:bg-muted'
                  )}
                  aria-pressed={interval === 'yearly'}
                >
                  {t('pricingIntervalYearly')}
                </button>
              </div>
            </div>
          </div>
          <div className="grid gap-8">
            <div className="border border-amber-200/60 bg-background dark:border-amber-200/20 dark:bg-amber-950/20">
              <Card className="border-2 border-foreground bg-foreground text-background shadow-[8px_8px_0px_0px_rgba(100,100,100,1)]">
                <CardHeader className="border-b border-background/20">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge className="bg-background text-foreground">{t('pricingFounderTitle')}</Badge>
                  </div>
                  <CardTitle className="text-2xl md:text-3xl">{t('pricingFounderSubtitle')}</CardTitle>
                  <CardDescription className="text-background/80">{t('pricingFounderDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-2xl font-black md:text-3xl">{founderPrice}</p>
                      <span className="text-xs uppercase tracking-[0.2em] text-background/70">
                        {t('pricingIntervalSuffixYearly')}
                      </span>
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-background/70">
                      {t('pricingFounderPriceNote')}
                    </p>
                  </div>
                  <LandingCtaTracker
                    ctaType="primary"
                    ctaText={t('pricingFounderCta')}
                    ctaLocation="pricing"
                    destination="#espera"
                  >
                    <Button
                      variant="popout"
                      className="border-2 border-background bg-background text-foreground hover:bg-background hover:text-background"
                      asChild
                    >
                      <a href="#espera">{t('pricingFounderCta')}</a>
                    </Button>
                  </LandingCtaTracker>
                </CardContent>
              </Card>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="flex h-full flex-col border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader className="border-b border-border">
                  <div className="flex items-center justify-between">
                    <CardTitle>{t('pricingFreeName')}</CardTitle>
                    <Badge variant="outline" className="border-foreground text-foreground">
                      {t('pricingFreeLabel')}
                    </Badge>
                  </div>
                  <CardDescription>{t('pricingFreeDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-black">{t('pricingFreePrice')}</p>
                      <span className="text-xs uppercase tracking-[0.2em] text-foreground/70">
                        {t('pricingFreePriceNote')}
                      </span>
                    </div>
                  </div>
                  <div className="grid gap-2 text-xs text-foreground/80">
                    <span>• {t('pricingFreeBulletOne')}</span>
                    <span>• {t('pricingFreeBulletTwo')}</span>
                    <span>• {t('pricingFreeBulletThree')}</span>
                    <span>• {t('pricingFreeBulletFour')}</span>
                    <span>• {t('pricingFreeBulletFive')}</span>
                  </div>
                  <LandingCtaTracker
                    ctaType="secondary"
                    ctaText={t('pricingFreeCta')}
                    ctaLocation="pricing"
                    destination="#espera"
                  >
                    <Button variant="hollow" className="mt-auto" asChild>
                      <a href="#espera">{t('pricingFreeCta')}</a>
                    </Button>
                  </LandingCtaTracker>
                </CardContent>
              </Card>
              <Card className="flex h-full flex-col border-2 border-foreground bg-background shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader className="border-b border-border">
                  <div className="flex items-center justify-between">
                    <CardTitle>{t('pricingSaverName')}</CardTitle>
                    <Badge variant="outline" className="border-foreground text-foreground">
                      {t('pricingSaverLabel')}
                    </Badge>
                  </div>
                  <CardDescription>{t('pricingSaverDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-black md:text-3xl">{formatPrice(prices.saver)}</p>
                    <span className="text-xs uppercase tracking-[0.2em] text-foreground/70">{intervalSuffix}</span>
                  </div>
                  {interval === 'yearly' && (
                    <div className="border border-amber-200/60 bg-amber-50/40 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-foreground dark:border-amber-200/20 dark:bg-amber-950/40">
                      <span className="text-foreground/70">{yearlyDiscountLabel}</span>
                      <span className="ml-2 font-semibold">{yearlyDiscountValue}</span>
                    </div>
                  )}
                  <div className="grid gap-2 text-xs text-foreground/80">
                    <span>• {t('pricingSaverBulletOne')}</span>
                    <span>• {t('pricingSaverBulletTwo')}</span>
                    <span>• {t('pricingSaverBulletThree')}</span>
                    <span>• {t('pricingSaverBulletFour')}</span>
                    <span>• {t('pricingSaverBulletFive')}</span>
                  </div>
                  <LandingCtaTracker
                    ctaType="secondary"
                    ctaText={t('pricingSaverCta')}
                    ctaLocation="pricing"
                    destination={checkoutDestination}
                  >
                    <Button variant="hollow" className="mt-auto" asChild>
                      <a href={checkoutDestination}>{t('pricingSaverCta')}</a>
                    </Button>
                  </LandingCtaTracker>
                </CardContent>
              </Card>
              <Card className="flex h-full flex-col border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader className="border-b border-border">
                  <div className="flex items-center justify-between">
                    <CardTitle>{t('pricingProName')}</CardTitle>
                    <Badge variant="outline" className="border-foreground text-foreground">
                      {t('pricingProLabel')}
                    </Badge>
                  </div>
                  <CardDescription>{t('pricingProDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="flex items-baseline gap-2">
                    <p className="text-2xl font-black md:text-3xl">{formatPrice(prices.pro)}</p>
                    <span className="text-xs uppercase tracking-[0.2em] text-foreground/70">{intervalSuffix}</span>
                  </div>
                  {interval === 'yearly' && (
                    <div className="border border-amber-200/60 bg-amber-50/40 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-foreground dark:border-amber-200/20 dark:bg-amber-950/40">
                      <span className="text-foreground/70">{yearlyDiscountLabel}</span>
                      <span className="ml-2 font-semibold">{yearlyDiscountValue}</span>
                    </div>
                  )}
                  <div className="grid gap-2 text-xs text-foreground/80">
                    <span>• {t('pricingProBulletOne')}</span>
                    <span>• {t('pricingProBulletTwo')}</span>
                  </div>
                  <LandingCtaTracker
                    ctaType="secondary"
                    ctaText={t('pricingProCta')}
                    ctaLocation="pricing"
                    destination="#espera"
                  >
                    <Button variant="hollow" className="mt-auto" asChild>
                      <a href="#espera">{t('pricingProCta')}</a>
                    </Button>
                  </LandingCtaTracker>
                </CardContent>
              </Card>
            </div>
          </div>
          <p className="mt-6 text-xs text-foreground/70">{t('pricingFootnote')}</p>
        </div>
      </section>
    </LandingSectionObserver>
  );
}
