'use client';

import type { Category } from '@/lib/schema';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { CategoryIcon } from '@/components/icon-picker';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon } from '@hugeicons/core-free-icons';

type CategoryQuickPickerProps = {
  categories: Category[];
  currentCategoryId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (categoryId: number) => void;
  isUpdating?: boolean;
};

export function CategoryQuickPicker({
  categories,
  currentCategoryId,
  open,
  onOpenChange,
  onSelect,
  isUpdating = false,
}: CategoryQuickPickerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[70vh] flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>Change Category</SheetTitle>
        </SheetHeader>

        {/* Scrollable list container */}
        <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <div className="flex flex-col">
            {categories.map((category) => {
              const isSelected = category.id === currentCategoryId;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => onSelect(category.id)}
                  disabled={isUpdating}
                  aria-label={`Selecionar categoria ${category.name}`}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-all',
                    'hover:bg-muted touch-manipulation',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    isSelected && 'bg-muted'
                  )}
                >
                  {/* Category icon */}
                  <div
                    className="size-10 rounded-full flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: category.color }}
                  >
                    <CategoryIcon icon={category.icon} />
                  </div>

                  {/* Category name */}
                  <span className="flex-1 text-left text-sm">
                    {category.name}
                  </span>

                  {/* Checkmark for selected */}
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
      </SheetContent>
    </Sheet>
  );
}
