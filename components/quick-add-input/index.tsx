'use client';

import { forwardRef, useCallback, useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { useTokenizedInput, type UseTokenizedInputOptions } from '@/lib/hooks/use-tokenized-input';
import { TokenOverlay } from './token-overlay';
import type { ParsedTask } from '@/lib/natural-language-parser';

export interface QuickAddInputProps
  extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'onSubmit'> {
  value?: string;
  onChange?: (value: string) => void;
  onParsedSubmit?: (parsed: ParsedTask, itemType: 'task' | 'event') => void;
  defaultType?: 'task' | 'event';
  className?: string;
}

/**
 * Smart input with tokenized badge highlighting for quick-add
 * Supports natural language parsing with visual feedback
 */
export const QuickAddInput = forwardRef<HTMLInputElement, QuickAddInputProps>(
  ({ value: controlledValue, onChange: controlledOnChange, onParsedSubmit, defaultType = 'task', className, onKeyDown: userOnKeyDown, ...props }, forwardedRef) => {
    const internalInputRef = useRef<HTMLInputElement>(null);

    const {
      value,
      onChange,
      tokens,
      parsedResult,
      itemType,
      handleKeyDown: handleTokenKeyDown,
    } = useTokenizedInput({ defaultType, inputRef: internalInputRef });

    // Support controlled mode
    const effectiveValue = controlledValue !== undefined ? controlledValue : value;
    const effectiveOnChange = controlledOnChange || onChange;

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      // Handle token dissolve logic
      handleTokenKeyDown(e);

      // Handle Enter key for submission
      if (e.key === 'Enter' && effectiveValue.trim()) {
        e.preventDefault();
        onParsedSubmit?.(parsedResult || { title: effectiveValue }, itemType);
      }

      // Call user's onKeyDown if provided
      userOnKeyDown?.(e);
    };

    // Merge refs using callback ref pattern
    const setRefs = useCallback((element: HTMLInputElement | null) => {
      // Set internal ref
      internalInputRef.current = element;
      // Set forwarded ref
      if (typeof forwardedRef === 'function') {
        forwardedRef(element);
      } else if (forwardedRef) {
        forwardedRef.current = element;
      }
    }, [forwardedRef]);

    return (
      <div className="relative inline-block w-full max-w-md">
        {/* Hidden input with transparent text */}
        <input
          {...props}
          ref={setRefs}
          type="text"
          value={effectiveValue}
          onChange={(e) => effectiveOnChange(e.target.value)}
          onKeyDown={handleKeyDown}
          data-slot="input"
          className={cn(
            // Base input styles (from Input component)
            'dark:bg-input/30 border-input focus-visible:border-ring focus-visible:ring-ring/50 disabled:bg-input/50 dark:disabled:bg-input/80 h-8 rounded-none border bg-transparent px-2.5 py-1 text-base sm:text-xs transition-colors placeholder:text-muted-foreground w-full min-w-0 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
            // Make text transparent so overlay shows through
            'text-transparent caret-black dark:caret-white',
            className
          )}
          style={{
            caretColor: 'inherit',
          }}
        />

        {/* Overlay with token badges */}
        <TokenOverlay
          value={effectiveValue}
          tokens={tokens}
          className={cn(
            // Match input padding and styling exactly
            'px-2.5 py-1 text-base sm:text-xs',
            // Prevent pointer events so input stays interactive
            'pointer-events-none'
          )}
        />
      </div>
    );
  }
);

QuickAddInput.displayName = 'QuickAddInput';

export { useTokenizedInput } from '@/lib/hooks/use-tokenized-input';
export type { UseTokenizedInputOptions };
