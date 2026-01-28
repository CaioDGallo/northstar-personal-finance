import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function SettingsPage() {
  const t = await getTranslations('settings');

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <div className="grid gap-4">
        <Link
          href="/settings/plan"
          className="block border border-gray-300 p-4 hover:border-gray-400"
        >
          <h2 className="font-semibold">{t('plan')}</h2>
          <p className="text-sm text-gray-600">{t('planDescription')}</p>
        </Link>
        <Link
          href="/settings/preferences"
          className="block border border-gray-300 p-4 hover:border-gray-400"
        >
          <h2 className="font-semibold">{t('preferences')}</h2>
          <p className="text-sm text-gray-600">{t('preferencesDescription')}</p>
        </Link>
        <Link
          href="/settings/calendars"
          className="block border border-gray-300 p-4 hover:border-gray-400"
        >
          <h2 className="font-semibold">{t('calendars')}</h2>
          <p className="text-sm text-gray-600">{t('calendarsDescription')}</p>
        </Link>
        <Link
          href="/settings/data"
          className="block border border-destructive/50 p-4 hover:border-destructive bg-destructive/5"
        >
          <h2 className="font-semibold text-destructive">{t('data')}</h2>
          <p className="text-sm text-muted-foreground">{t('dataDescription')}</p>
        </Link>
      </div>
    </div>
  );
}
