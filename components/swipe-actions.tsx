'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { Delete02Icon, Tick02Icon, Clock01Icon, ViewOffSlashIcon, ViewIcon } from '@hugeicons/core-free-icons';
import { triggerHaptic, HapticPatterns } from '@/lib/utils/haptics';
import { cn } from '@/lib/utils';

type SwipeActionsProps = {
  onDelete: () => void;
  onTogglePaid: () => void;
  onToggleIgnore: () => void;
  isPaid: boolean;
  isIgnored: boolean;
  isIncome?: boolean; // For income, use "Received" instead of "Paid"
};

export function SwipeActions({
  onDelete,
  onTogglePaid,
  onToggleIgnore,
  isPaid,
  isIgnored,
  isIncome = false,
}: SwipeActionsProps) {
  const handleAction = (action: () => void) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    triggerHaptic(HapticPatterns.light);
    action();
  };

  return (
    <div className="absolute inset-0 flex items-stretch justify-end pointer-events-none">
      {/* Delete button */}
      <button
        type="button"
        onPointerDown={handleAction(onDelete)}
        className="w-12 bg-red-600 flex items-center justify-center pointer-events-auto touch-manipulation"
        aria-label="Excluir"
      >
        <HugeiconsIcon icon={Delete02Icon} size={20} className="text-white" strokeWidth={2} />
      </button>

      {/* Paid/Pending toggle button */}
      <button
        type="button"
        onPointerDown={handleAction(onTogglePaid)}
        className={cn(
          'w-12 flex items-center justify-center pointer-events-auto touch-manipulation',
          isPaid ? 'bg-amber-600' : 'bg-green-600'
        )}
        aria-label={isPaid ? (isIncome ? 'Marcar como pendente' : 'Marcar como pendente') : (isIncome ? 'Marcar como recebido' : 'Marcar como pago')}
      >
        <HugeiconsIcon
          icon={isPaid ? Clock01Icon : Tick02Icon}
          size={20}
          className="text-white"
          strokeWidth={2}
        />
      </button>

      {/* Ignore/Include toggle button */}
      <button
        type="button"
        onPointerDown={handleAction(onToggleIgnore)}
        className={cn(
          'w-12 flex items-center justify-center pointer-events-auto touch-manipulation',
          isIgnored ? 'bg-blue-400' : 'bg-gray-500'
        )}
        aria-label={isIgnored ? 'Incluir nos cálculos' : 'Ignorar nos cálculos'}
      >
        <HugeiconsIcon
          icon={isIgnored ? ViewIcon : ViewOffSlashIcon}
          size={20}
          className="text-white"
          strokeWidth={2}
        />
      </button>
    </div>
  );
}
