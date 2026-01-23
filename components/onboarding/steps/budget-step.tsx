'use client';

import { useState, useEffect } from 'react';
import { WizardStep } from '../wizard-step';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOnboarding } from '../onboarding-provider';
import { useTranslations } from 'next-intl';
import { getCategories } from '@/lib/actions/categories';
import { upsertBudget } from '@/lib/actions/budgets';
import { toast } from 'sonner';
import { displayToCents } from '@/lib/utils';
import { getCurrentYearMonth } from '@/lib/utils';

export function BudgetStep() {
  const t = useTranslations('onboarding.budget');
  const { nextStep } = useOnboarding();
  const [categories, setCategories] = useState<Array<{ id: number; name: string; color: string }>>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCategories('expense').then((cats) => {
      setCategories(cats);
      if (cats.length > 0) {
        setSelectedCategoryId(cats[0].id.toString());
      }
      setIsLoading(false);
    });
  }, []);

  const handleCreate = async () => {
    if (!selectedCategoryId || !amount) {
      toast.error(t('fieldsRequired'));
      return;
    }

    const amountCents = displayToCents(amount);
    if (amountCents <= 0) {
      toast.error(t('invalidAmount'));
      return;
    }

    setIsCreating(true);
    try {
      await upsertBudget(
        parseInt(selectedCategoryId, 10),
        getCurrentYearMonth(),
        amountCents
      );
      toast.success(t('budgetCreated'));
      nextStep();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create budget');
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <WizardStep className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-bold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        </div>
      </WizardStep>
    );
  }

  if (categories.length === 0) {
    return (
      <WizardStep className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-xl font-bold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('noCategories')}</p>
        </div>
        <Button onClick={nextStep} className="w-full">
          {t('skip')}
        </Button>
      </WizardStep>
    );
  }

  return (
    <WizardStep className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-bold">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="budget-category">{t('categoryLabel')}</Label>
          <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
            <SelectTrigger id="budget-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id.toString()}>
                  <div className="flex items-center gap-2">
                    <div
                      className="size-3 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="budget-amount">{t('amountLabel')}</Label>
          <Input
            id="budget-amount"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t('amountPlaceholder')}
          />
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
