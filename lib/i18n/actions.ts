'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { type Locale, locales, LOCALE_COOKIE } from './config';

export async function setLocale(locale: Locale) {
  if (!locales.includes(locale)) {
    throw new Error('Invalid locale');
  }

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  });

  revalidatePath('/', 'layout');
}
