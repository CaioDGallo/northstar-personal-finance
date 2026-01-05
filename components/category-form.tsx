'use client';

import { useState } from 'react';
import { createCategory, updateCategory } from '@/lib/actions/categories';
import type { Category } from '@/lib/schema';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertDialogCancel, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { IconPicker, isValidIconName, type IconName } from '@/components/icon-picker';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#0ea5e9', // sky
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
];

type CategoryFormProps = {
  category?: Category;
  type?: 'expense' | 'income';
  onSuccess?: () => void;
};

export function CategoryForm({ category, type = 'expense', onSuccess }: CategoryFormProps) {
  const [name, setName] = useState(category?.name || '');
  const [color, setColor] = useState(category?.color || COLORS[0]);
  const [icon, setIcon] = useState<IconName | null>(() => {
    const iconValue = category?.icon ?? null;
    return isValidIconName(iconValue) ? iconValue : null;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('categoryForm');
  const tCommon = useTranslations('common');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = category
        ? await updateCategory(category.id, { name, color, icon })
        : await createCategory({ name, color, icon, type });

      if (!result.success) {
        setError(result.error);
        return;
      }

      onSuccess?.();
    } catch (err) {
      console.error('[CategoryForm] Submit failed:', err);
      setError(tCommon('unexpectedError'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">{t('name')}</FieldLabel>
          <Input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Food & Dining"
          />
        </Field>

        <Field>
          <FieldLabel>{t('color')}</FieldLabel>
          <div className="grid grid-cols-8 gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  'h-8 w-8 rounded-full',
                  color === c && 'ring-2 ring-blue-500 ring-offset-2'
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </Field>

        <Field>
          <FieldLabel>{t('icon')}</FieldLabel>
          <IconPicker value={icon} onChange={setIcon} />
        </Field>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? t('saving') : category ? t('update') : t('create')}
          </Button>
        </AlertDialogFooter>
      </FieldGroup>
    </form>
  );
}
