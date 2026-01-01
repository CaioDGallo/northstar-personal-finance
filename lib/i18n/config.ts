export const locales = ['pt-BR', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'pt-BR';
export const LOCALE_COOKIE = 'NEXT_LOCALE';
