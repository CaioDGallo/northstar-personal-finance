import { getTranslations } from 'next-intl/server';
import { getCategories } from '@/lib/actions/categories';
import { AddCategoryButton } from '@/components/add-category-button';
import { CategoryCard } from '@/components/category-card';
import { OnboardingTooltip } from '@/components/onboarding/onboarding-tooltip';

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

      <div className="space-y-8">
        {/* Expense Categories */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500">{t('expenseCategories')}</h2>
            <AddCategoryButton type="expense">{t('add')}</AddCategoryButton>
          </div>
          {expenseCategories.length === 0 ? (
            <p className="text-sm text-gray-500">{t('noExpenseCategoriesYet')}</p>
          ) : (
            <div className="space-y-3">
              {expenseCategories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          )}
        </div>

        {/* Income Categories */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500">{t('incomeCategories')}</h2>
            <AddCategoryButton type="income">{t('add')}</AddCategoryButton>
          </div>
          {incomeCategories.length === 0 ? (
            <p className="text-sm text-gray-500">{t('noIncomeCategoriesYet')}</p>
          ) : (
            <div className="space-y-3">
              {incomeCategories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
