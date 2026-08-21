import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale, SUPPORTED_LOCALES } from '@/lib/locale';
import { detectSystemLocale } from '@/lib/onboarding';
import { loadPersistedLocale, setSetting } from '@/lib/tauri';

/**
 * Language step: EN/ID selection cards. Preselects the persisted locale,
 * falling back to the system language (`navigator.language`, purely local).
 * Applies the choice live via i18n and persists it immediately.
 */
export function LanguageStep() {
  const { t, i18n } = useTranslation();
  const [selected, setSelected] = useState<Locale>(DEFAULT_LOCALE);

  // Preselect: persisted locale if present, else system language.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const persisted = await loadPersistedLocale();
      if (!cancelled) {
        setSelected(
          isSupportedLocale(persisted) ? persisted : detectSystemLocale(navigator.language),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function select(locale: Locale) {
    setSelected(locale);
    await i18n.changeLanguage(locale);
    try {
      await setSetting('locale', locale);
    } catch {
      // Persistence unavailable (e.g. browser dev); in-app switch still applies.
    }
  }

  return (
    <div className="flex flex-1 flex-col space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-heading text-3xl font-semibold">{t('onboarding.language.title')}</h1>
        <p className="text-muted-foreground">{t('onboarding.language.subtitle')}</p>
      </div>

      <div className="grid flex-1 grid-cols-2 content-start gap-4">
        {SUPPORTED_LOCALES.map((locale) => {
          const active = selected === locale;
          return (
            <button
              key={locale}
              type="button"
              aria-pressed={active}
              onClick={() => void select(locale)}
              className={`rounded-lg border p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
                active
                  ? 'border-emerald-600 bg-emerald-600/5 dark:border-emerald-400 dark:bg-emerald-400/5'
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <span className="block text-lg font-medium">{t(`settings.languages.${locale}`)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
