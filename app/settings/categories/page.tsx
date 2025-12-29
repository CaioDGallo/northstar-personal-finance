import { getCategories } from '@/lib/actions/categories';
import { AddCategoryButton } from '@/components/add-category-button';
import { CategoryCard } from '@/components/category-card';

export default async function CategoriesPage() {
  const categories = await getCategories();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <AddCategoryButton />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {categories.map((category) => (
          <CategoryCard key={category.id} category={category} />
        ))}
      </div>
    </div>
  );
}
