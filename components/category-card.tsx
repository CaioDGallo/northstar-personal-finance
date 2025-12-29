'use client';

import { useState } from 'react';
import { deleteCategory } from '@/lib/actions/categories';
import type { Category } from '@/lib/schema';
import { CategoryForm } from '@/components/category-form';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { CategoryIcon } from '@/components/icon-picker';

type CategoryCardProps = {
  category: Category;
};

export function CategoryCard({ category }: CategoryCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
      setDeleteError('An unexpected error occurred. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: category.color }}
        >
          <CategoryIcon icon={category.icon} />
        </div>
        <h3 className="font-medium">{category.name}</h3>
      </div>

      <div className="flex gap-2">
        <AlertDialog open={editOpen} onOpenChange={setEditOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">Edit</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Edit Category</AlertDialogTitle>
            </AlertDialogHeader>
            <CategoryForm
              category={category}
              onSuccess={() => setEditOpen(false)}
            />
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">Delete</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete category?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>

            {deleteError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {deleteError}
              </div>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
}
