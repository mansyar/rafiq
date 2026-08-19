import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DEFAULT_LOCALE, resolveLocale } from '@/lib/locale';
import en from './locales/en.json';
import id from './locales/id.json';

const resources = {
  en: { translation: en },
  id: { translation: id },
} as const;

/** Initialises i18next with bundled en/id catalogs and a persisted locale (default `en`). */
export async function initI18n(persistedLocale?: unknown): Promise<typeof i18n> {
  await i18n.use(initReactI18next).init({
    resources,
    lng: resolveLocale(persistedLocale),
    fallbackLng: DEFAULT_LOCALE,
    interpolation: { escapeValue: false },
  });
  return i18n;
}

export { i18n };
