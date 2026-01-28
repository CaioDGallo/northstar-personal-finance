import { useTranslations } from 'next-intl';

export default function OfflinePage() {
  const t = useTranslations('offline');

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">
          {t('description')}
        </p>
      </div>
    </div>
  );
}
