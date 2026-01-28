import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ThemeToggleRow } from '@/components/theme-toggle-row';
import { LandingCtaTracker } from '@/components/tracking/landing-cta-tracker';
import { getSession } from '@/lib/auth';

export async function LandingHeader() {
  const t = await getTranslations('landing');
  const session = await getSession();
  const isLoggedIn = !!session?.user;

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur text-foreground">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-background text-xs font-bold">
            FX$H
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Fluxo</p>
            <p className="text-xs text-foreground/80">fluxo.sh</p>
          </div>
        </div>
        <nav className="hidden items-center gap-6 text-xs font-medium uppercase tracking-[0.2em] md:flex">
          <Link href="#recursos" className="hover:text-foreground/70">
            {t('navFeatures')}
          </Link>
          <Link href="#como" className="hover:text-foreground/70">
            {t('navHow')}
          </Link>
          <Link href="#planos" className="hover:text-foreground/70">
            {t('navPricing')}
          </Link>
          <Link href="#faq" className="hover:text-foreground/70">
            {t('navFaq')}
          </Link>
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggleRow
            showLabel={false}
            iconOnly
            className="h-9 w-auto border border-foreground px-3 py-0"
            labelClassName="text-[11px]"
          />
          {isLoggedIn ? (
            <Button variant="hollow" asChild>
              <Link href="/dashboard">{t('ctaDashboard')}</Link>
            </Button>
          ) : (
            <LandingCtaTracker
              ctaType="primary"
              ctaText={t('ctaPrimary')}
              ctaLocation="header"
              destination="#espera"
            >
              <Button variant="hollow" asChild>
                <a href="#espera">{t('ctaPrimary')}</a>
              </Button>
            </LandingCtaTracker>
          )}
        </div>
        <div className="flex items-center gap-3 md:hidden">
          <ThemeToggleRow
            showLabel={false}
            iconOnly
            asButton
            className="h-9 w-auto border border-foreground px-3 py-0"
            labelClassName="text-[11px]"
          />
          {isLoggedIn ? (
            <Button variant="hollow" asChild>
              <Link href="/dashboard">{t('ctaDashboard')}</Link>
            </Button>
          ) : (
            <LandingCtaTracker
              ctaType="primary"
              ctaText={t('ctaPrimary')}
              ctaLocation="header"
              destination="#espera"
            >
              <Button variant="hollow" asChild>
                <a href="#espera">{t('ctaPrimary')}</a>
              </Button>
            </LandingCtaTracker>
          )}
        </div>
      </div>
    </header>
  );
}
