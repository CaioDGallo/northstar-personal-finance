import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ThemeToggleRow } from '@/components/theme-toggle-row';
import { HeroTitle } from '@/components/hero-title';
import { PwaInstallBanner } from '@/components/pwa-install-banner';

export const metadata: Metadata = {
  title: 'Fluxo.sh | Financas pessoais no Brasil',
  description: 'Fluxo.sh organiza gastos, receitas e faturas com parcelas. Feito para o Brasil.',
  openGraph: {
    title: 'Fluxo.sh',
    description: 'Controle financeiro pessoal com parcelas e faturas.',
    type: 'website',
  },
};

export default async function Home() {
  const t = await getTranslations('landing');

  return (
    <div className="bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur text-foreground">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-foreground bg-background text-xs font-bold">FX$H</div>
            <div className="leading-tight">
              <p className="text-sm font-semibold">Fluxo</p>
              <p className="text-xs text-foreground/80">fluxo.sh</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-xs font-medium uppercase tracking-[0.2em] md:flex">
            <Link href="#recursos" className="hover:text-foreground/70">{t('navFeatures')}</Link>
            <Link href="#como" className="hover:text-foreground/70">{t('navHow')}</Link>
            <Link href="#faq" className="hover:text-foreground/70">{t('navFaq')}</Link>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggleRow
              showLabel={false}
              iconOnly
              className="h-9 w-auto border border-foreground px-3 py-0"
              labelClassName="text-[11px]"
            />
            <Button variant="hollow" asChild>
              <a href="#espera">{t('ctaPrimary')}</a>
            </Button>
          </div>
          <div className="flex items-center gap-3 md:hidden">
            <ThemeToggleRow
              showLabel={false}
              iconOnly
              className="h-9 w-auto border border-foreground px-3 py-0"
              labelClassName="text-[11px]"
            />
            <Button variant="hollow" asChild>
              <a href="#espera">{t('ctaPrimary')}</a>
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border/80">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,#f5f5f5_0%,#ffffff_45%,#e9e9e9_100%)] dark:bg-[linear-gradient(120deg,#0d0d0d_0%,#171717_45%,#101010_100%)]" />
          <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 py-16 md:grid-cols-[1.1fr_0.9fr] md:px-6 md:py-24">
            <div className="space-y-6">
              <Badge variant="outline" className="border-foreground text-foreground bg-background/80 dark:bg-background/10">
                {t('heroBadge')}
              </Badge>
              <HeroTitle className="text-4xl font-black leading-tight md:text-5xl" />
              <p className="text-base text-foreground/80 md:text-lg">
                {t('subtitle')}
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="popout" asChild>
                  <a href="#espera">{t('ctaPrimary')}</a>
                </Button>
                <Button variant="hollow" asChild>
                  <a href="#recursos">{t('ctaSecondary')}</a>
                </Button>
              </div>
              <p className="text-xs uppercase tracking-[0.25em] text-foreground/80">
                {t('tagline')}
              </p>
            </div>

            <div className="space-y-4">
              <Card className="border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader className="border-b border-border">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{t('footerTitle')}</CardTitle>
                    <Badge variant="outline" className="border-foreground text-foreground">BR</Badge>
                  </div>
                  <CardDescription>{t('statsTitle')}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="flex items-center justify-between border border-border px-3 py-3 text-xs">
                    <span className="font-medium">{t('statsOneLabel')}</span>
                    <span className="font-semibold">{t('statsOneValue')}</span>
                  </div>
                  <div className="flex items-center justify-between border border-border px-3 py-3 text-xs">
                    <span className="font-medium">{t('statsTwoLabel')}</span>
                    <span className="font-semibold">{t('statsTwoValue')}</span>
                  </div>
                  <div className="flex items-center justify-between border border-border px-3 py-3 text-xs">
                    <span className="font-medium">{t('statsThreeLabel')}</span>
                    <span className="font-semibold">{t('statsThreeValue')}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: t('featureOneTitle'), value: '01' },
                  { label: t('featureTwoTitle'), value: '02' },
                  { label: t('featureThreeTitle'), value: '03' },
                  { label: t('featureFourTitle'), value: '04' },
                ].map((item) => (
                  <div
                    key={item.value}
                    className="flex items-center justify-between border-2 border-foreground bg-background px-4 py-4 text-xs font-semibold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <span>{item.label}</span>
                    <span className="text-sm">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="recursos" className="border-b border-border/80 bg-muted dark:bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
            <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="max-w-xl space-y-3">
                <h2 className="text-2xl font-bold md:text-3xl">{t('featureTitle')}</h2>
                <p className="text-sm text-foreground/80 md:text-base">{t('featureSubtitle')}</p>
              </div>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              <Card className="border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader className="border-b border-border">
                  <CardTitle>{t('featureOneTitle')}</CardTitle>
                  <CardDescription>{t('featureOneText')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 text-xs text-foreground/80">
                    <span>• {t('featureOneBulletOne')}</span>
                    <span>• {t('featureOneBulletTwo')}</span>
                    <span>• {t('featureOneBulletThree')}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader className="border-b border-border">
                  <CardTitle>{t('featureTwoTitle')}</CardTitle>
                  <CardDescription>{t('featureTwoText')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 text-xs text-foreground/80">
                    <span>• {t('featureTwoBulletOne')}</span>
                    <span>• {t('featureTwoBulletTwo')}</span>
                    <span>• {t('featureTwoBulletThree')}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader className="border-b border-border">
                  <CardTitle>{t('featureThreeTitle')}</CardTitle>
                  <CardDescription>{t('featureThreeText')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 text-xs text-foreground/80">
                    <span>• {t('featureThreeBulletOne')}</span>
                    <span>• {t('featureThreeBulletTwo')}</span>
                    <span>• {t('featureThreeBulletThree')}</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader className="border-b border-border">
                  <CardTitle>{t('featureFourTitle')}</CardTitle>
                  <CardDescription>{t('featureFourText')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 text-xs text-foreground/80">
                    <span>• {t('featureFourBulletOne')}</span>
                    <span>• {t('featureFourBulletTwo')}</span>
                    <span>• {t('featureFourBulletThree')}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section id="como" className="border-b border-border/80">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
            <div className="mb-10 max-w-xl space-y-3">
              <h2 className="text-2xl font-bold md:text-3xl">{t('howTitle')}</h2>
              <p className="text-sm text-foreground/80 md:text-base">{t('howSubtitle')}</p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  title: t('howStepOneTitle'),
                  text: t('howStepOneText'),
                  index: '01',
                },
                {
                  title: t('howStepTwoTitle'),
                  text: t('howStepTwoText'),
                  index: '02',
                },
                {
                  title: t('howStepThreeTitle'),
                  text: t('howStepThreeText'),
                  index: '03',
                },
              ].map((item) => (
                <div
                  key={item.index}
                  className="flex h-full flex-col justify-between border-2 border-foreground bg-background p-6 text-xs shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                >
                  <span className="text-sm font-semibold">{item.index}</span>
                  <div className="mt-6 space-y-3">
                    <h3 className="text-base font-semibold">{item.title}</h3>
                    <p className="text-foreground/80">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/80 bg-foreground text-background">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em]">{t('proofTitle')}</p>
                <h2 className="mt-3 text-3xl font-black md:text-4xl">{t('proofSubtitle')}</h2>
              </div>
              <Button
                variant="popout"
                className="border-2 border-background bg-background text-foreground hover:bg-background hover:text-foreground"
                asChild
              >
                <a href="#espera">{t('ctaPrimary')}</a>
              </Button>
            </div>
          </div>
        </section>

        <section id="faq" className="border-b border-border/80">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
            <div className="mb-10 max-w-xl space-y-3">
              <h2 className="text-2xl font-bold md:text-3xl">{t('faqTitle')}</h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <Card key={item} className="border-2 border-foreground shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                  <CardHeader className="border-b border-border">
                    <CardTitle>{t(`faq${item}Q` as const)}</CardTitle>
                    <CardDescription>{t(`faq${item}A` as const)}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="espera" className="border-b border-border/80 bg-muted dark:bg-muted/40">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 md:px-6">
            <Card className="border-2 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-2xl md:text-3xl">{t('ctaTitle')}</CardTitle>
                <CardDescription className="text-sm md:text-base">{t('ctaSubtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em]" htmlFor="waitlist-email">
                    {t('emailLabel')}
                  </label>
                  <Input id="waitlist-email" type="email" placeholder={t('emailPlaceholder')} />
                  <p className="text-xs text-foreground/80">{t('submitNote')}</p>
                </div>
                <div className="flex h-full flex-col justify-between gap-4">
                  <Button variant="popout" className="w-full" disabled>
                    {t('ctaDisabled')}
                  </Button>
                  <div className="border border-border p-4 text-xs">
                    <p className="font-semibold">{t('footerTitle')}</p>
                    <p className="text-foreground/80">{t('footerText')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-b border-border/80 bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 text-xs md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            <p className="font-semibold">{t('footerTitle')}</p>
            <p className="text-foreground/80">{t('footerText')}</p>
          </div>
          <div className="flex flex-wrap gap-4 uppercase tracking-[0.2em] text-[10px] text-foreground/80">
            <span>{t('footerMadeIn')}</span>
            <span>•</span>
            <span>{t('footerInstallments')}</span>
            <span>•</span>
            <span>{t('footerDomain')}</span>
          </div>
        </div>
      </footer>

      <PwaInstallBanner />
    </div>
  );
}
