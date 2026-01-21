'use client';

import { BANK_LOGOS, type BankLogoKey } from '@/lib/bank-logos';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { BankLogo } from '@/components/bank-logo';
import { cn } from '@/lib/utils';
import { HugeiconsIcon } from '@hugeicons/react';
import { Tick02Icon, Cancel01Icon } from '@hugeicons/core-free-icons';

type BankLogoPickerProps = {
  currentLogo: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (logo: string | null) => void;
};

export function BankLogoPicker({
  currentLogo,
  open,
  onOpenChange,
  onSelect,
}: BankLogoPickerProps) {
  const bankLogos = Object.entries(BANK_LOGOS) as [BankLogoKey, typeof BANK_LOGOS[BankLogoKey]][];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[70vh] flex flex-col"
      >
        <SheetHeader>
          <SheetTitle>Selecionar logo do banco</SheetTitle>
        </SheetHeader>

        {/* Scrollable list container */}
        <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <div className="flex flex-col">
            {/* None option */}
            <button
              type="button"
              onClick={() => onSelect(null)}
              aria-label="Sem logo"
              className={cn(
                'flex items-center gap-3 px-4 py-3 transition-all',
                'hover:bg-muted touch-manipulation',
                currentLogo === null && 'bg-muted'
              )}
            >
              {/* Icon placeholder */}
              <div className="size-10 rounded-full flex items-center justify-center bg-muted shrink-0">
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  className="size-5 text-muted-foreground"
                  strokeWidth={2}
                />
              </div>

              {/* Label */}
              <span className="flex-1 text-left text-sm">
                Sem logo
              </span>

              {/* Checkmark for selected */}
              {currentLogo === null && (
                <HugeiconsIcon
                  icon={Tick02Icon}
                  className="size-5 text-primary shrink-0"
                  strokeWidth={2}
                />
              )}
            </button>

            {/* Bank logos */}
            {bankLogos.map(([key, bank]) => {
              const isSelected = key === currentLogo;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelect(key)}
                  aria-label={`Selecionar ${bank.name}`}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-all',
                    'hover:bg-muted touch-manipulation',
                    isSelected && 'bg-muted'
                  )}
                >
                  {/* Bank logo */}
                  <div className="size-10 rounded-full flex items-center justify-center bg-white shrink-0 p-1.5">
                    <BankLogo logo={key} size={32} />
                  </div>

                  {/* Bank name */}
                  <span className="flex-1 text-left text-sm">
                    {bank.name}
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
