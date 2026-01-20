'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { signIn } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { validateLoginAttempt } from '@/lib/actions/auth';
import { Turnstile } from '@marsidev/react-turnstile';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>("XXXX.DUMMY.TOKEN.XXXX");

  // Check for error parameter from OAuth callback
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam === 'auth_failed') {
      setError(t('authenticationFailed'));
    }
  }, [searchParams, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!captchaToken) {
      setError(t('captchaRequired'));
      return;
    }

    setLoading(true);

    try {
      // Step 1: Validate rate limit + CAPTCHA
      const validation = await validateLoginAttempt(email, captchaToken);
      if (!validation.allowed) {
        setError(validation.error || t('unexpectedError'));
        setCaptchaToken(null);
        return;
      }

      // Step 2: Authenticate with NextAuth
      const result = await signIn('credentials', {
        email,
        password,
        captchaToken,
        redirect: false,
      });

      if (result?.error) {
        setError(t('authenticationFailed'));
        setCaptchaToken(null);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError(t('unexpectedError'));
      setCaptchaToken(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('description')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs text-muted-foreground hover:underline"
                >
                  {t('forgotPassword')}
                </Link>
              </div>
            </div>

            <div>
              {/* <Turnstile */}
              {/*   siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} */}
              {/*   onSuccess={(token) => setCaptchaToken(token)} */}
              {/*   onError={() => setCaptchaToken(null)} */}
              {/*   onExpire={() => setCaptchaToken(null)} */}
              {/* /> */}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading || !captchaToken}>
              {loading ? t('signingIn') : t('signIn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  const t = useTranslations('login');

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{t('title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('loading')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
