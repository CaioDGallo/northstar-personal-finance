"use client";

import { useEffect, useState } from "react";

type InstallState =
  | "hidden"
  | "chromium"
  | "ios-safari"
  | "dismissed"
  | "unsupported";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface NavigatorStandalone {
  standalone?: boolean;
}

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Hook for detecting PWA install capability and managing install prompt
 * Supports Chromium browsers (Chrome, Edge, Opera) and iOS Safari
 */
export function usePwaInstall() {
  // Initialize state with detection logic
  const [installState, setInstallState] = useState<InstallState>(() => {
    if (typeof window === "undefined") return "hidden";

    // Check if already running as PWA
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as NavigatorStandalone).standalone === true;

    if (isStandalone) return "unsupported";

    // Check localStorage for dismiss
    const dismissedAt = localStorage.getItem(DISMISS_KEY);
    if (dismissedAt) {
      const timeSinceDismiss = Date.now() - parseInt(dismissedAt, 10);
      if (timeSinceDismiss < DISMISS_DURATION) {
        return "dismissed";
      }
      // Expired dismiss - clear it
      localStorage.removeItem(DISMISS_KEY);
    }

    // Detect iOS Safari
    const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent);
    const isWebView = /(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(
      navigator.userAgent
    );

    if (isIos && isSafari && !isWebView) {
      return "ios-safari";
    }

    return "hidden";
  });

  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Skip if already determined state
    if (installState !== "hidden") return;

    // Listen for beforeinstallprompt (Chromium)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const event = e as BeforeInstallPromptEvent;
      setDeferredPrompt(event);
      setInstallState("chromium");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Timeout fallback - use ref to capture current state
    const timeout = setTimeout(() => {
      setInstallState((current) => {
        // Only set to unsupported if still hidden
        return current === "hidden" ? "unsupported" : current;
      });
    }, 3000);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      clearTimeout(timeout);
    };
  }, [installState]);

  const triggerInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        setInstallState("unsupported"); // Hide after install
      }

      setDeferredPrompt(null);
    } catch (error) {
      console.error("Error triggering install prompt:", error);
    }
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setInstallState("dismissed");
  };

  return {
    installState,
    canInstall: installState === "chromium",
    isIos: installState === "ios-safari",
    triggerInstall,
    dismiss,
  };
}
