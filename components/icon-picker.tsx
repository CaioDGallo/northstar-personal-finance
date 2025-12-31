'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import {
  ShoppingBag01Icon,
  Restaurant01Icon,
  Car01Icon,
  Home01Icon,
  HealthIcon,
  PlaneIcon,
  GameController01Icon,
  Book01Icon,
  Wallet01Icon,
  ClothesIcon,
  Wifi01Icon,
  Activity01Icon,
  GiftIcon,
  SparklesIcon,
  Settings01Icon,
  Briefcase01Icon,
} from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

export const CATEGORY_ICONS = {
  ShoppingBag01Icon,
  Restaurant01Icon,
  Car01Icon,
  Home01Icon,
  HealthIcon,
  PlaneIcon,
  GameController01Icon,
  Book01Icon,
  Wallet01Icon,
  ClothesIcon,
  Wifi01Icon,
  Activity01Icon,
  GiftIcon,
  SparklesIcon,
  Settings01Icon,
  Briefcase01Icon,
} as const;

export type IconName = keyof typeof CATEGORY_ICONS;

export function isValidIconName(icon: string | null): icon is IconName {
  return icon !== null && icon in CATEGORY_ICONS;
}

type IconPickerProps = {
  value: IconName | null;
  onChange: (icon: IconName) => void;
};

export function IconPicker({ value, onChange }: IconPickerProps) {
  return (
    <div className="grid grid-cols-8 gap-2">
      {Object.entries(CATEGORY_ICONS).map(([name, Icon]) => (
        <button
          key={name}
          type="button"
          onClick={() => onChange(name as IconName)}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-md border dark:hover:bg-neutral-700 hover:bg-neutral-100',
            value === name && 'border-blue-500 bg-blue-50 ring-2 ring-blue-500'
          )}
        >
          <HugeiconsIcon icon={Icon} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}

export function CategoryIcon({ icon }: { icon: string | null }) {
  if (!isValidIconName(icon)) return null;
  const IconComponent = CATEGORY_ICONS[icon];
  return <HugeiconsIcon icon={IconComponent} strokeWidth={2} />;
}
