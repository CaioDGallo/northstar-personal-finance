'use client';

import { useState } from 'react';
import { WizardStep } from '../wizard-step';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOnboarding } from '../onboarding-provider';
import { useTranslations } from 'next-intl';
import { createCategory } from '@/lib/actions/categories';
import { toast } from 'sonner';

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
  '#6b7280', // gray
];

export function CategoryStep() {
  const t = useTranslations('onboarding.category');
  const { nextStep } = useOnboarding();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error(t('nameRequired'));
      return;
    }

    setIsCreating(true);
    const result = await createCategory({
      name: name.trim(),
      color,
      type: 'expense',
    });
    setIsCreating(false);

    if (result.success) {
      toast.success(t('categoryCreated'));
      nextStep();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <WizardStep className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="category-name">{t('nameLabel')}</Label>
          <Input
            id="category-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('colorLabel')}</Label>
          <div className="flex gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="size-8 rounded-full border-2 transition-all hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? 'currentColor' : 'transparent',
                }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" onClick={nextStep} className="flex-1">
          {t('skip')}
        </Button>
        <Button onClick={handleCreate} disabled={isCreating} className="flex-1">
          {isCreating ? t('creating') : t('create')}
        </Button>
      </div>
    </WizardStep>
  );
}
