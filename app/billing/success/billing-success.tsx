'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function BillingSuccess() {
  const router = useRouter();
  const t = useTranslations('billing');

  useEffect(() => {
    const timeout = setTimeout(() => {
      router.replace('/dashboard');
      router.refresh();
    }, 1200);

    return () => clearTimeout(timeout);
  }, [router]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{t('successTitle')}</CardTitle>
          <CardDescription>{t('successDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('successNote')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
