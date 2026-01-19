'use client';

import { useEffect, useState } from 'react';
import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    // SSR guard - default to 'system' on server
    if (typeof window === 'undefined') return 'system';

    return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
  });

  useEffect(() => {
    const updateTheme = () => {
      const newTheme = (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
      setTheme(newTheme);
    };

    // Listen for storage events (cross-tab sync)
    window.addEventListener('storage', updateTheme);

    // Listen for custom theme-change event (same-tab immediate update)
    window.addEventListener('theme-change', updateTheme);

    return () => {
      window.removeEventListener('storage', updateTheme);
      window.removeEventListener('theme-change', updateTheme);
    };
  }, []);

  return (
    <SonnerToaster
      position="top-center"
      richColors
      theme={theme}
    />
  );
}
