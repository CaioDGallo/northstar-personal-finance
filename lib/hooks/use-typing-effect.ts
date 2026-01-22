"use client";

import { useEffect, useState } from "react";

interface UseTypingEffectOptions {
  text: string;
  speed?: number;
  startDelay?: number;
  onComplete?: () => void;
}

interface UseTypingEffectReturn {
  displayText: string;
  isTyping: boolean;
  isComplete: boolean;
}

/**
 * Hook for typewriter effect - types text character by character
 * Resets when text changes (i18n safe)
 */
export function useTypingEffect({
  text,
  speed = 50,
  startDelay = 0,
  onComplete,
}: UseTypingEffectOptions): UseTypingEffectReturn {
  const [state, setState] = useState({
    displayText: "",
    currentIndex: 0,
    isTyping: false,
    isComplete: false,
    textKey: text, // Track text changes
  });

  // Reset when text changes
  useEffect(() => {
    if (state.textKey !== text) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({
        displayText: "",
        currentIndex: 0,
        isTyping: false,
        isComplete: false,
        textKey: text,
      });
    }
  }, [text, state.textKey]);

  // Start typing after delay
  useEffect(() => {
    if (!text || state.isTyping || state.textKey !== text) return;

    const startTimer = setTimeout(() => {
      setState((prev) => ({ ...prev, isTyping: true }));
    }, startDelay);

    return () => clearTimeout(startTimer);
  }, [text, startDelay, state.isTyping, state.textKey]);

  // Typing animation
  useEffect(() => {
    const { isTyping, currentIndex, isComplete, textKey } = state;

    if (!isTyping || currentIndex >= text.length || textKey !== text) {
      if (
        currentIndex >= text.length &&
        !isComplete &&
        text.length > 0 &&
        textKey === text
      ) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setState((prev) => ({ ...prev, isComplete: true, isTyping: false }));
        onComplete?.();
      }
      return;
    }

    const timer = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        displayText: prev.displayText + text[prev.currentIndex],
        currentIndex: prev.currentIndex + 1,
      }));
    }, speed);

    return () => clearTimeout(timer);
  }, [state, text, speed, onComplete]);

  return {
    displayText: state.displayText,
    isTyping: state.isTyping,
    isComplete: state.isComplete,
  };
}
