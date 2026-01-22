"use client";

import { useTranslations } from "next-intl";
import { TypingText } from "./typing-text";

interface HeroTitleProps {
  className?: string;
}

/**
 * Client component wrapper for hero title with typing animation
 * Server pages can't use hooks, so this wrapper handles translations client-side
 */
export function HeroTitle({ className }: HeroTitleProps) {
  const t = useTranslations("landing");

  return (
    <h1 className={className}>
      <TypingText text={t("title")} speed={40} startDelay={500} />
    </h1>
  );
}
