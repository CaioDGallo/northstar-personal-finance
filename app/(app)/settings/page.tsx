import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { LanguageToggle } from '@/components/language-toggle';

export default async function SettingsPage() {
  const t = await getTranslations('settings');
  const currentLocale = await getLocale();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">{t('title')}</h1>
      <div className="grid gap-4">
        <Link
          href="/settings/preferences"
          className="block border border-gray-300 p-4 hover:border-gray-400"
        >
          <h2 className="font-semibold">{t('preferences')}</h2>
          <p className="text-sm text-gray-600">{t('preferencesDescription')}</p>
        </Link>
        <Link
          href="/settings/accounts"
          className="block border border-gray-300 p-4 hover:border-gray-400"
        >
          <h2 className="font-semibold">{t('accounts')}</h2>
          <p className="text-sm text-gray-600">{t('accountsDescription')}</p>
        </Link>
        <Link
          href="/settings/categories"
          className="block border border-gray-300 p-4 hover:border-gray-400"
        >
          <h2 className="font-semibold">{t('categories')}</h2>
          <p className="text-sm text-gray-600">{t('categoriesDescription')}</p>
        </Link>
        <Link
          href="/settings/budgets"
          className="block border border-gray-300 p-4 hover:border-gray-400"
        >
          <h2 className="font-semibold">{t('budgets')}</h2>
          <p className="text-sm text-gray-600">{t('budgetsDescription')}</p>
        </Link>
        <div className="block border border-gray-300 p-4">
          <h2 className="font-semibold">{t('language')}</h2>
          <p className="text-sm text-gray-600">{t('languageDescription')}</p>
          <LanguageToggle currentLocale={currentLocale} />
        </div>
      </div>
    </div>
  );
}
