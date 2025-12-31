import { getCategories } from '@/lib/actions/categories';
import { AddCategoryButton } from '@/components/add-category-button';
import { CategoryCard } from '@/components/category-card';

export default async function CategoriesPage() {
  const categories = await getCategories();

  const expenseCategories = categories.filter(cat => cat.type === 'expense');
  const incomeCategories = categories.filter(cat => cat.type === 'income');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Categories</h1>
      </div>

      <div className="space-y-8">
        {/* Expense Categories */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500">Expense Categories</h2>
            <AddCategoryButton type="expense">Add</AddCategoryButton>
          </div>
          {expenseCategories.length === 0 ? (
            <p className="text-sm text-gray-500">No expense categories yet.</p>
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
            <h2 className="text-sm font-medium text-gray-500">Income Categories</h2>
            <AddCategoryButton type="income">Add</AddCategoryButton>
          </div>
          {incomeCategories.length === 0 ? (
            <p className="text-sm text-gray-500">No income categories yet.</p>
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
