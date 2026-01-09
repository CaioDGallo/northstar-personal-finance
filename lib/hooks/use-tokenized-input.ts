import { useState, useCallback, useMemo, KeyboardEvent, RefObject } from 'react';
import { parseInputWithTokens, type TokenMatch, type ParsedTask } from '@/lib/natural-language-parser';
import { useDeferredValue } from 'react';

export interface UseTokenizedInputOptions {
  /** Default type when no prefix detected */
  defaultType?: 'task' | 'event';
  /** Input ref for cursor management */
  inputRef: RefObject<HTMLInputElement | null>;
  /** External controlled value - if provided, parsing uses this instead of internal state */
  value?: string;
}

export interface UseTokenizedInputReturn {
  /** Current input value */
  value: string;
  /** Update input value */
  onChange: (value: string) => void;
  /** Detected tokens with positions */
  tokens: TokenMatch[];
  /** Map of dissolved token ranges ("start-end" format) to original text */
  dissolvedRanges: Map<string, string>;
  /** Parsed result from natural language parser */
  parsedResult: ParsedTask | null;
  /** Inferred or explicit item type */
  itemType: 'task' | 'event';
  /** Handle keyboard events (backspace dissolve logic) */
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** Manually dissolve a token */
  dissolveToken: (tokenKey: string, tokenText: string) => void;
  /** Handle selection change (track cursor position) */
  handleSelectionChange: () => void;
}

/**
 * Hook for managing tokenized input state with badge highlighting
 * and dissolve-on-backspace behavior
 */
export function useTokenizedInput(
  options: UseTokenizedInputOptions
): UseTokenizedInputReturn {
  const { defaultType = 'task', inputRef, value: controlledValue } = options;

  const [internalValue, setInternalValue] = useState('');
  const [dissolvedRanges, setDissolvedRanges] = useState<Map<string, string>>(new Map());
  const [cursorPos, setCursorPos] = useState<number | null>(null);

  // Use controlled value if provided, otherwise internal value
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  // Defer parsing to not block typing
  const deferredValue = useDeferredValue(value);

  // Parse input with tokens
  const parseResult = useMemo(() => {
    if (!deferredValue.trim()) {
      return {
        tokens: [],
        parsed: { title: '' },
        inferredType: defaultType,
      };
    }
    return parseInputWithTokens(deferredValue);
  }, [deferredValue, defaultType]);

  // Filter out dissolved tokens and tokens being actively edited
  const visibleTokens = useMemo(() => {
    return parseResult.tokens.filter(token => {
      const key = `${token.start}-${token.end}`;

      // Hide if dissolved
      if (dissolvedRanges.has(key)) return false;

      // Hide if cursor is at end of token (user still typing)
      if (cursorPos !== null && token.end === cursorPos) {
        return false;
      }

      return true;
    });
  }, [parseResult.tokens, dissolvedRanges, cursorPos]);

  const onChange = useCallback((newValue: string) => {
    setInternalValue(newValue);

    // Clear dissolved ranges when text at those positions changes
    // (allows re-highlighting when user retypes same pattern)
    setDissolvedRanges(prev => {
      const newMap = new Map<string, string>();
      prev.forEach((originalText, range) => {
        const [start, end] = range.split('-').map(Number);
        // Keep dissolved range only if text at position is SAME
        if (end <= newValue.length) {
          const currentText = newValue.slice(start, end);
          if (currentText === originalText) {
            newMap.set(range, originalText);
          }
        }
      });
      return newMap;
    });
  }, []);

  const dissolveToken = useCallback((tokenKey: string, tokenText: string) => {
    setDissolvedRanges(prev => new Map([...prev, [tokenKey, tokenText]]));
  }, []);

  const handleSelectionChange = useCallback(() => {
    setCursorPos(inputRef.current?.selectionStart ?? null);
  }, [inputRef]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Backspace') return;

    const cursorPos = inputRef.current?.selectionStart ?? 0;
    const selectionEnd = inputRef.current?.selectionEnd ?? 0;

    // Only handle when cursor is at a single position (not a selection)
    if (cursorPos !== selectionEnd) return;

    // Find token that ends exactly at cursor position
    const tokenAtCursor = parseResult.tokens.find(
      t => t.end === cursorPos && !dissolvedRanges.has(`${t.start}-${t.end}`)
    );

    if (tokenAtCursor) {
      // Prevent default backspace behavior
      e.preventDefault();

      // Dissolve the token instead of deleting
      dissolveToken(`${tokenAtCursor.start}-${tokenAtCursor.end}`, tokenAtCursor.text);
    }
  }, [inputRef, parseResult.tokens, dissolvedRanges, dissolveToken]);

  return {
    value,
    onChange,
    tokens: visibleTokens,
    dissolvedRanges,
    parsedResult: parseResult.parsed,
    itemType: parseResult.inferredType,
    handleKeyDown,
    dissolveToken,
    handleSelectionChange,
  };
}
