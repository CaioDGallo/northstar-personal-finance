import { cookies } from 'next/headers';
import { locales, type Locale, LOCALE_COOKIE, defaultLocale } from './config';
import messagesEn from '@/messages/en.json';
import messagesPtBR from '@/messages/pt-BR.json';

const messages: Record<Locale, Record<string, unknown>> = {
  'pt-BR': messagesPtBR,
  en: messagesEn,
};

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.');
  let value: unknown = obj;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = (value as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }

  return typeof value === 'string' ? value : path;
}

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  return locales.includes(cookieLocale as Locale) ? (cookieLocale as Locale) : defaultLocale;
}

export function translateWithLocale(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>
): string {
  const message = getNestedValue(messages[locale], key);

  if (params) {
    return Object.entries(params).reduce(
      (str, [param, value]) => str.replace(new RegExp(`\\{\\{${param}\\}\\}`, 'g'), String(value)),
      message
    );
  }

  return message;
}

export async function translateError(key: string, params?: Record<string, string | number>): Promise<string> {
  const locale = await getLocale();
  return translateWithLocale(locale, key, params);
}

export async function t(key: string, params?: Record<string, string | number>): Promise<string> {
  return translateError(key, params);
}
