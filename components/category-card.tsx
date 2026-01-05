'use client';

import { useState } from 'react';
import { deleteCategory } from '@/lib/actions/categories';
import type { Category } from '@/lib/schema';
import { CategoryForm } from '@/components/category-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CategoryIcon } from '@/components/icon-picker';
import { HugeiconsIcon } from '@hugeicons/react';
import { MoreVerticalIcon } from '@hugeicons/core-free-icons';
import { useTranslations } from 'next-intl';

type CategoryCardProps = {
  category: Category;
};

export function CategoryCard({ category }: CategoryCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const t = useTranslations('categories');
  const tCommon = useTranslations('common');

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await deleteCategory(category.id);

      if (!result.success) {
        setDeleteError(result.error);
        return;
      }

      setDeleteOpen(false);
    } catch (err) {
      console.error('[CategoryCard] Delete failed:', err);
      setDeleteError(tCommon('unexpectedError'));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card className="py-0">
      <CardContent className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-3">
        {/* Category icon */}
        <div
          className="size-10 shrink-0 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: category.color }}
        >
          <CategoryIcon icon={category.icon} />
        </div>

        {/* Category name */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{category.name}</h3>
        </div>

        {/* Actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8">
              <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <AlertDialog open={editOpen} onOpenChange={setEditOpen}>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  {tCommon('edit')} {t('title')}
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent closeOnBackdropClick>
                <AlertDialogHeader>
                  <AlertDialogTitle>{tCommon('edit')} {t('title')}</AlertDialogTitle>
                </AlertDialogHeader>
                <CategoryForm
                  category={category}
                  onSuccess={() => setEditOpen(false)}
                />
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  {tCommon('delete')} {t('title')}
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{tCommon('delete')} {t('title')}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {tCommon('actionCannotBeUndone')}
                  </AlertDialogDescription>
                </AlertDialogHeader>

                {deleteError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                    {deleteError}
                  </div>
                )}

                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isDeleting}>{tCommon('cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting ? tCommon('deleting') : tCommon('delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}
