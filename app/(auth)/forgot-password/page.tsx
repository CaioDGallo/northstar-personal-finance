'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { forgotPassword } from '@/lib/actions/auth';

function ForgotPasswordForm() {
  const t = useTranslations('forgotPassword');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    setLoading(true);

    try {
      const result = await forgotPassword(email);

      if (result.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    } catch {
      setError(t('unexpectedError'));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <div className="mb-6">
              <h1 className="text-2xl font-bold">{t('checkYourEmail')}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('checkEmailDescription', { email })}
              </p>
            </div>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                {t('backToLogin')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/50 p-4">
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

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('sending') : t('sendResetLink')}
            </Button>

            <div className="text-center text-sm">
              <Link href="/login" className="text-muted-foreground hover:underline">
                {t('backToLogin')}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<ForgotPasswordFallback />}>
      <ForgotPasswordForm />
    </Suspense>
  );
}

function ForgotPasswordFallback() {
  const t = useTranslations('forgotPassword');

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/50 p-4">
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
