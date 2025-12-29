'use client';

import { useState } from 'react';
import { CategoryForm } from '@/components/category-form';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function AddCategoryButton() {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button>Add Category</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Add Category</AlertDialogTitle>
        </AlertDialogHeader>
        <CategoryForm onSuccess={() => setOpen(false)} />
      </AlertDialogContent>
    </AlertDialog>
  );
}
