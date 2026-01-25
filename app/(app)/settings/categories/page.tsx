import { getTranslations } from 'next-intl/server';
import { getCategories } from '@/lib/actions/categories';
import { OnboardingTooltip } from '@/components/onboarding/onboarding-tooltip';
import { CategoriesTabs } from '@/components/categories-tabs';

export default async function CategoriesPage() {
  const t = await getTranslations('categories');
  const tOnboarding = await getTranslations('onboarding.hints');
  const categories = await getCategories();

  const expenseCategories = categories.filter(cat => cat.type === 'expense');
  const incomeCategories = categories.filter(cat => cat.type === 'income');

  return (
    <div>
      <OnboardingTooltip hintKey="categories" className="mb-4">
        {tOnboarding('categories')}
      </OnboardingTooltip>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
      </div>

      <CategoriesTabs
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
      />
    </div>
  );
}
