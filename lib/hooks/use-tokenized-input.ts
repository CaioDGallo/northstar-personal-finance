import { useState, useCallback, useMemo, KeyboardEvent, RefObject } from 'react';
import { parseInputWithTokens, type TokenMatch, type ParsedTask } from '@/lib/natural-language-parser';
import { useDeferredValue } from 'react';

export interface UseTokenizedInputOptions {
  /** Default type when no prefix detected */
  defaultType?: 'task' | 'event';
  /** Input ref for cursor management */
  inputRef: RefObject<HTMLInputElement | null>;
}

export interface UseTokenizedInputReturn {
  /** Current input value */
  value: string;
  /** Update input value */
  onChange: (value: string) => void;
  /** Detected tokens with positions */
  tokens: TokenMatch[];
  /** Set of dissolved token ranges ("start-end" format) */
  dissolvedRanges: Set<string>;
  /** Parsed result from natural language parser */
  parsedResult: ParsedTask | null;
  /** Inferred or explicit item type */
  itemType: 'task' | 'event';
  /** Handle keyboard events (backspace dissolve logic) */
  handleKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** Manually dissolve a token */
  dissolveToken: (tokenKey: string) => void;
}

/**
 * Hook for managing tokenized input state with badge highlighting
 * and dissolve-on-backspace behavior
 */
export function useTokenizedInput(
  options: UseTokenizedInputOptions
): UseTokenizedInputReturn {
  const { defaultType = 'task', inputRef } = options;

  const [value, setValue] = useState('');
  const [dissolvedRanges, setDissolvedRanges] = useState<Set<string>>(new Set());

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

  // Filter out dissolved tokens
  const visibleTokens = useMemo(() => {
    return parseResult.tokens.filter(token => {
      const key = `${token.start}-${token.end}`;
      return !dissolvedRanges.has(key);
    });
  }, [parseResult.tokens, dissolvedRanges]);

  const onChange = useCallback((newValue: string) => {
    setValue(newValue);

    // Clear dissolved ranges when text changes significantly
    // (allows re-highlighting of edited text)
    setDissolvedRanges(prev => {
      const newSet = new Set<string>();
      prev.forEach(range => {
        const [start, end] = range.split('-').map(Number);
        // Keep dissolved range if positions still valid
        if (start < newValue.length && end <= newValue.length) {
          newSet.add(range);
        }
      });
      return newSet;
    });
  }, []);

  const dissolveToken = useCallback((tokenKey: string) => {
    setDissolvedRanges(prev => new Set([...prev, tokenKey]));
  }, []);

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
      dissolveToken(`${tokenAtCursor.start}-${tokenAtCursor.end}`);
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
  };
}
