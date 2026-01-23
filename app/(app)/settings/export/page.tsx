import { getTranslations } from 'next-intl/server';
import { ExportForm } from './export-form';

export default async function ExportPage() {
  const t = await getTranslations('export');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      <ExportForm />
    </div>
  );
}
