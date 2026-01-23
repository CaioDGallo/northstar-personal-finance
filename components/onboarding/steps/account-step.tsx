'use client';

import { useState } from 'react';
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
import { createAccount } from '@/lib/actions/accounts';
import { toast } from 'sonner';

export function AccountStep() {
  const t = useTranslations('onboarding.account');
  const { nextStep } = useOnboarding();
  const [name, setName] = useState('');
  const [type, setType] = useState<'checking' | 'savings' | 'credit_card' | 'cash'>('checking');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error(t('nameRequired'));
      return;
    }

    setIsCreating(true);
    const result = await createAccount({
      name: name.trim(),
      type,
      currentBalance: 0,
    });
    setIsCreating(false);

    if (result.success) {
      toast.success(t('accountCreated'));
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
          <Label htmlFor="account-name">{t('nameLabel')}</Label>
          <Input
            id="account-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="account-type">{t('typeLabel')}</Label>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger id="account-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="checking">{t('types.checking')}</SelectItem>
              <SelectItem value="savings">{t('types.savings')}</SelectItem>
              <SelectItem value="credit_card">{t('types.creditCard')}</SelectItem>
              <SelectItem value="cash">{t('types.cash')}</SelectItem>
            </SelectContent>
          </Select>
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
