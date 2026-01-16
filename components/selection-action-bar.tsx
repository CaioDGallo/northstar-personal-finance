'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SelectionActionBarProps = {
  selectedCount: number;
  onChangeCategory: () => void;
  onCancel: () => void;
};

export function SelectionActionBar({
  selectedCount,
  onChangeCategory,
  onCancel,
}: SelectionActionBarProps) {
  return (
    <div
      className={cn(
        'fixed bottom-16 inset-x-0 z-40 md:hidden',
        'backdrop-blur-xl bg-background/95 border-t border-border',
        'pb-[env(safe-area-inset-bottom)]',
        'shadow-lg'
      )}
    >
      <div className="flex items-center justify-between gap-4 h-14 px-4">
        {/* Selected count */}
        <div className="text-sm font-medium">
          {selectedCount} selected
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="touch-manipulation">
            Cancel
          </Button>
          <Button size="sm" onClick={onChangeCategory} className="touch-manipulation">
            Change Category
          </Button>
        </div>
      </div>
    </div>
  );
}
