export type Locale = 'en' | 'id';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'id'] as const;

export const DEFAULT_LOCALE: Locale = 'en';

/** True when `value` is an exact supported locale tag (e.g. `'en'`, `'id'`). */
export function isSupportedLocale(value: unknown): value is Locale {
  if (typeof value !== 'string') {
    return false;
  }
  return SUPPORTED_LOCALES.some((locale) => locale === value);
}

/** Resolves a persisted (or otherwise untrusted) locale value to a supported locale. */
export function resolveLocale(value: unknown): Locale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}
