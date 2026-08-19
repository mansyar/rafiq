import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type Locale, SUPPORTED_LOCALES } from '@/lib/locale';
import { setSetting } from '@/lib/tauri';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage as Locale) ?? i18n.language;

  async function selectLocale(locale: Locale) {
    await i18n.changeLanguage(locale);
    await setSetting('locale', locale);
  }

  return (
    <section aria-labelledby="page-settings" className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle id="page-settings" className="font-heading text-2xl">
            {t('page.settings.title')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t('page.settings.subtitle')}</p>
        </CardHeader>
        <CardContent>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('settings.language')}</legend>
            <div className="flex gap-2">
              {SUPPORTED_LOCALES.map((locale) => (
                <Button
                  key={locale}
                  variant={current === locale ? 'default' : 'outline'}
                  aria-pressed={current === locale}
                  onClick={() => selectLocale(locale)}
                >
                  {t(`settings.languages.${locale}`)}
                </Button>
              ))}
            </div>
          </fieldset>
        </CardContent>
      </Card>
    </section>
  );
}
