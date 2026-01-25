'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowDown01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import type { Category } from '@/lib/schema';
import type { RecentCategory } from '@/lib/actions/categories';
import { CategoryIcon } from '@/components/icon-picker';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const RECENT_LIMIT = 3;

type CategoryPickerProps = {
  categories: Category[];
  recentCategories: RecentCategory[];
  value: number;
  onChange: (value: number) => void;
  triggerId?: string;
};

function resolveCategoryOptions(categories: Category[]) {
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
  }));
}

export function CategoryPicker({
  categories,
  recentCategories,
  value,
  onChange,
  triggerId,
}: CategoryPickerProps) {
  const t = useTranslations('form');
  const [open, setOpen] = useState(false);
  const categoryOptions = useMemo(() => resolveCategoryOptions(categories), [categories]);
  const selectedCategory = categoryOptions.find((category) => category.id === value) || null;

  const recentOptions = useMemo(() => {
    if (recentCategories.length === 0) return [];
    const used = new Set<number>();

    return recentCategories
      .filter((category) => categories.some((item) => item.id === category.id))
      .filter((category) => {
        if (used.has(category.id)) return false;
        used.add(category.id);
        return true;
      })
      .slice(0, RECENT_LIMIT)
      .map((category) => ({
        id: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
      }));
  }, [categories, recentCategories]);

  const handleSelect = (categoryId: number) => {
    onChange(categoryId);
    setOpen(false);
  };

  return (
    <>
      <button
        id={triggerId}
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2',
          'text-sm ring-offset-background transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'w-full'
        )}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {selectedCategory ? (
            <>
              <CategoryIconDisplay color={selectedCategory.color} icon={selectedCategory.icon} />
              <span className="truncate">{selectedCategory.name}</span>
            </>
          ) : (
            <span className="text-muted-foreground">{t('selectCategory')}</span>
          )}
        </div>
        <HugeiconsIcon icon={ArrowDown01Icon} className="size-4 opacity-50 shrink-0" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[70vh] flex flex-col">
          <SheetHeader>
            <SheetTitle>{t('selectCategory')}</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {recentOptions.length > 0 && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-muted-foreground px-4 py-2">
                  {t('recent')}
                </h3>
                <div className="flex flex-col">
                  {recentOptions.map((category) => {
                    const isSelected = category.id === value;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => handleSelect(category.id)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 transition-all',
                          'hover:bg-muted touch-manipulation',
                          isSelected && 'bg-muted'
                        )}
                      >
                        <div
                          className="size-10 rounded-full flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: category.color }}
                        >
                          <CategoryIcon icon={category.icon} />
                        </div>
                        <span className="flex-1 text-left text-sm">
                          {category.name}
                        </span>
                        {isSelected && (
                          <HugeiconsIcon
                            icon={Tick02Icon}
                            className="size-5 text-primary shrink-0"
                            strokeWidth={2}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium text-muted-foreground px-4 py-2">
                {t('all')}
              </h3>
              <div className="flex flex-col">
                {categoryOptions.length > 0 ? (
                  categoryOptions.map((category) => {
                    const isSelected = category.id === value;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => handleSelect(category.id)}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 transition-all',
                          'hover:bg-muted touch-manipulation',
                          isSelected && 'bg-muted'
                        )}
                      >
                        <div
                          className="size-10 rounded-full flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: category.color }}
                        >
                          <CategoryIcon icon={category.icon} />
                        </div>
                        <span className="flex-1 text-left text-sm">
                          {category.name}
                        </span>
                        {isSelected && (
                          <HugeiconsIcon
                            icon={Tick02Icon}
                            className="size-5 text-primary shrink-0"
                            strokeWidth={2}
                          />
                        )}
                      </button>
                    );
                  })
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    {t('noCategoriesFound')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function CategoryIconDisplay({ color, icon }: { color: string; icon: string | null }) {
  return (
    <div
      className="size-5 rounded-full flex items-center justify-center shrink-0"
      style={{ backgroundColor: color }}
    >
      <div className="text-white [&_svg]:size-3">
        <CategoryIcon icon={icon || 'default'} />
      </div>
    </div>
  );
}
