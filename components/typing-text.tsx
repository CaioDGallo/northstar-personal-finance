"use client";

import { useTypingEffect } from "@/lib/hooks/use-typing-effect";

interface TypingTextProps {
  text: string;
  speed?: number;
  startDelay?: number;
  onComplete?: () => void;
  className?: string;
}

/**
 * Typing text component with blinking cursor
 * Provides terminal-style typewriter effect
 */
export function TypingText({
  text,
  speed = 10,
  startDelay = 1000,
  onComplete,
  className = "",
}: TypingTextProps) {
  const { displayText } = useTypingEffect({
    text,
    speed,
    startDelay,
    onComplete,
  });

  return (
    <span className={className}>
      <span>{displayText}</span>
      <span
        className="inline-block w-0.75 bg-foreground animate-cursor-blink ml-0.5"
        aria-hidden="true"
      >
        &nbsp;
      </span>
      {/* Full text for SEO + accessibility */}
      <span className="sr-only">{text}</span>
    </span>
  );
}
