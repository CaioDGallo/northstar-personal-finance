"use client";

import { useTranslations } from "next-intl";
import { usePwaInstall } from "@/lib/hooks/use-pwa-install";
import { Button } from "./ui/button";
import Image from "next/image";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";

/**
 * PWA install prompt banner with platform-specific handling
 * Chromium: Native install prompt trigger
 * iOS Safari: Educational step-by-step instructions
 */
export function PwaInstallBanner() {
  const t = useTranslations("pwa");
  const { installState, canInstall, isIos, triggerInstall, dismiss } =
    usePwaInstall();

  // Don't render if hidden, dismissed, or unsupported
  if (
    installState === "hidden" ||
    installState === "dismissed" ||
    installState === "unsupported"
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:bottom-4 md:left-auto md:right-4 md:max-w-md">
      <div className="relative border-2 border-foreground bg-background shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute right-2 top-2 rounded-sm p-1 hover:bg-muted"
          aria-label={t("dismiss")}
        >
          <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
        </button>

        <div className="p-4">
          <div className="flex gap-4">
            {/* App icon */}
            <div className="flex-shrink-0">
              <div className="flex h-16 w-16 items-center justify-center border-2 border-foreground bg-background">
                <Image
                  src="/brand-kit/exports/icon-48-light.png"
                  alt="Fluxo.sh"
                  width={48}
                  height={48}
                  className="h-12 w-12"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 space-y-2">
              <h3 className="text-base font-bold">{t("title")}</h3>
              <p className="text-xs text-foreground/80">
                {isIos ? t("descriptionIos") : t("description")}
              </p>
            </div>
          </div>

          {/* Action buttons - Chromium */}
          {canInstall && (
            <div className="mt-4 flex gap-2">
              <Button
                onClick={triggerInstall}
                variant="popout"
                size="sm"
                className="flex-1"
              >
                {t("install")}
              </Button>
              <Button onClick={dismiss} variant="hollow" size="sm">
                {t("dismiss")}
              </Button>
            </div>
          )}

          {/* Instructions - iOS Safari */}
          {isIos && (
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium">1.</span>
                <span>{t("iosStep1")}</span>
                <div className="flex h-6 w-6 items-center justify-center rounded border border-foreground">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                    />
                  </svg>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium">2.</span>
                <span>{t("iosStep2")}</span>
              </div>
              <Button
                onClick={dismiss}
                variant="hollow"
                size="sm"
                className="mt-2 w-full"
              >
                {t("dismiss")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
