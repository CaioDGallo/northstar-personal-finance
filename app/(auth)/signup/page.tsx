'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { signIn } from 'next-auth/react';
import posthog from 'posthog-js';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { validateInviteCode, signup, reserveInviteForOAuth } from '@/lib/actions/signup';
import { Turnstile } from '@marsidev/react-turnstile';

type Step = 'invite' | 'register';

export default function SignupPage() {
  const t = useTranslations('signup');
  const tAuth = useTranslations('auth');
  const tCommon = useTranslations('common');

  const [step, setStep] = useState<Step>('invite');
  const [inviteCode, setInviteCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await validateInviteCode(inviteCode);
      if (!result.valid) {
        setError(result.error);
      } else {
        setStep('register');
      }
    } catch {
      setError(t('unexpectedError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!captchaToken) {
      setError(t('captchaRequired'));
      return;
    }

    setLoading(true);

    try {
      // Create account (rate limiting handled in server action)
      const result = await signup({
        email,
        password,
        name,
        inviteCode,
        captchaToken,
      });

      if (!result.success) {
        setError(result.error);
        setCaptchaToken(null);
      } else {
        // Track signup
        posthog.identify(email, { email, name });
        posthog.capture('signup_success', { email, method: 'credentials' });

        // Sign in and redirect
        await signIn('credentials', {
          email,
          password,
          captchaToken,
          callbackUrl: '/dashboard',
        });
      }
    } catch {
      setError(t('unexpectedError'));
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuthClick(provider: 'google' | 'github') {
    setError('');
    setLoading(true);

    try {
      // Reserve invite for OAuth flow
      const result = await reserveInviteForOAuth(inviteCode);
      if (!result.success) {
        setError(result.error || t('unexpectedError'));
        setLoading(false);
        return;
      }

      // Track OAuth attempt
      posthog.capture('signup_oauth_attempt', { provider });

      // Redirect to OAuth
      await signIn(provider, { callbackUrl: '/dashboard' });
    } catch {
      setError(t('unexpectedError'));
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          {step === 'invite' ? (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold">{t('title')}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('inviteRequired')}
                </p>
              </div>

              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="inviteCode">{t('inviteCode')}</Label>
                  <Input
                    id="inviteCode"
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    required
                    disabled={loading}
                    placeholder="FLUXO-XXXXX"
                    className="font-mono"
                  />
                </div>

                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? tCommon('loading') : t('continue')}
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                  {t('alreadyHaveAccount')}{' '}
                  <Link href="/login" className="font-medium hover:underline">
                    {t('signIn')}
                  </Link>
                </div>
              </form>
            </>
          ) : (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold">{t('createAccount')}</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('fillDetailsBelow')}
                </p>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('name')}</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                    placeholder={t('namePlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    placeholder={t('emailPlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t('password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    placeholder={t('passwordPlaceholder')}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('passwordRequirements')}
                  </p>
                </div>

                <div>
                  <Turnstile
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                    onSuccess={(token) => setCaptchaToken(token)}
                    onError={() => setCaptchaToken(null)}
                    onExpire={() => setCaptchaToken(null)}
                  />
                </div>

                {error && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading || !captchaToken}>
                  {loading ? t('creatingAccount') : t('createAccount')}
                </Button>
              </form>

              <div className="mt-4">
                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      {tAuth('orContinueWith')}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOAuthClick('google')}
                    disabled={loading}
                    className="w-full"
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Google
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleOAuthClick('github')}
                    disabled={loading}
                    className="w-full"
                  >
                    <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <path
                        fillRule="evenodd"
                        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                        clipRule="evenodd"
                      />
                    </svg>
                    GitHub
                  </Button>
                </div>
              </div>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => setStep('invite')}
                  className="text-sm text-muted-foreground hover:underline"
                  disabled={loading}
                >
                  {t('backToInvite')}
                </button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
