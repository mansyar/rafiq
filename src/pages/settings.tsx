import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LocationPicker } from '@/components/location-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale, SUPPORTED_LOCALES } from '@/lib/locale';
import {
  CALCULATION_METHODS,
  type CalculationMethod,
  getAdhanEnabled,
  getCalculationMethod,
  getNotificationEnabled,
  setAdhanEnabled,
  setCalculationMethod,
  setNotificationEnabled,
  triggerTestPrayer,
} from '@/lib/prayer';
import { setSetting } from '@/lib/tauri';

export function Settings() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const currentLocale = isSupportedLocale(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : DEFAULT_LOCALE;

  async function selectLocale(locale: Locale) {
    await i18n.changeLanguage(locale);
    try {
      await setSetting('locale', locale);
    } catch {
      // Persistence unavailable (e.g. browser dev); in-app switch still applies.
    }
  }

  // ── Calculation method ────────────────────────────────────────────────
  const methodQuery = useQuery({
    queryKey: ['prayer-method'],
    queryFn: getCalculationMethod,
  });

  const methodMutation = useMutation({
    mutationFn: (m: CalculationMethod) => setCalculationMethod(m),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['prayer-method'] });
      await queryClient.invalidateQueries({ queryKey: ['prayer-times'] });
    },
  });

  // ── Test trigger state ────────────────────────────────────────────────
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  // ── Toggles ───────────────────────────────────────────────────────────
  const notifQuery = useQuery({
    queryKey: ['notif-enabled'],
    queryFn: getNotificationEnabled,
  });
  const adhanQuery = useQuery({
    queryKey: ['adhan-enabled'],
    queryFn: getAdhanEnabled,
  });

  const notifMutation = useMutation({
    mutationFn: (v: boolean) => setNotificationEnabled(v),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['notif-enabled'] }),
  });
  const adhanMutation = useMutation({
    mutationFn: (v: boolean) => setAdhanEnabled(v),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['adhan-enabled'] }),
  });

  return (
    <section aria-labelledby="page-settings" className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle id="page-settings" className="font-heading text-2xl">
            {t('page.settings.title')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t('page.settings.subtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Re-run onboarding */}
          <div className="space-y-1">
            <Button
              variant="outline"
              className="w-full border-emerald-600/40 hover:bg-emerald-600/5 dark:border-emerald-400/40 dark:hover:bg-emerald-400/5"
              onClick={() => navigate('/onboarding')}
            >
              {t('settings.runSetupAgain')}
            </Button>
            <p className="text-xs text-muted-foreground">{t('settings.runSetupAgainHint')}</p>
          </div>

          <Separator />

          {/* Language */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('settings.language')}</legend>
            <div className="flex gap-2">
              {SUPPORTED_LOCALES.map((locale) => (
                <Button
                  key={locale}
                  variant={currentLocale === locale ? 'default' : 'outline'}
                  aria-pressed={currentLocale === locale}
                  onClick={() => selectLocale(locale)}
                >
                  {t(`settings.languages.${locale}`)}
                </Button>
              ))}
            </div>
          </fieldset>

          <Separator />

          {/* Method */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('settings.method')}</legend>
            <div className="flex flex-wrap gap-2">
              {CALCULATION_METHODS.map((m) => {
                const active = methodQuery.data === m;
                return (
                  <Button
                    key={m}
                    variant={active ? 'default' : 'outline'}
                    size="sm"
                    aria-pressed={active}
                    disabled={methodQuery.isLoading || methodMutation.isPending}
                    onClick={() => methodMutation.mutate(m)}
                  >
                    {t(`settings.methods.${m}` as const)}
                  </Button>
                );
              })}
            </div>
            {methodMutation.isError && (
              <p className="text-xs text-destructive" role="alert">
                {String(methodMutation.error)}
              </p>
            )}
          </fieldset>

          <Separator />

          {/* Location */}
          <LocationPicker idPrefix="settings" />

          <Separator />

          {/* Toggles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('settings.notifications')}</p>
                <p className="text-xs text-muted-foreground">{t('settings.notificationsHint')}</p>
              </div>
              <Button
                variant={notifQuery.data ? 'default' : 'outline'}
                size="sm"
                aria-pressed={!!notifQuery.data}
                disabled={notifQuery.isLoading || notifMutation.isPending}
                onClick={() => notifMutation.mutate(!notifQuery.data)}
              >
                {notifQuery.data ? 'On' : 'Off'}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('settings.adhan')}</p>
                <p className="text-xs text-muted-foreground">{t('settings.adhanHint')}</p>
              </div>
              <Button
                variant={adhanQuery.data ? 'default' : 'outline'}
                size="sm"
                aria-pressed={!!adhanQuery.data}
                disabled={adhanQuery.isLoading || adhanMutation.isPending}
                onClick={() => adhanMutation.mutate(!adhanQuery.data)}
              >
                {adhanQuery.data ? 'On' : 'Off'}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Test trigger — manual verification for Phase 4 */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Test prayer trigger</h3>
            <p className="text-xs text-muted-foreground">
              Fires a test notification and adhan sound via the scheduler (respects toggles above).
            </p>
            <div className="flex flex-wrap gap-2">
              {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    try {
                      setTestMessage(null);
                      setTestError(null);
                      await triggerTestPrayer(p);
                      setTestMessage(`Test trigger sent for ${p}`);
                    } catch (e) {
                      setTestError(String(e));
                    }
                  }}
                >
                  Test {p}
                </Button>
              ))}
            </div>
            {testMessage && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400" aria-live="polite">
                {testMessage}
              </p>
            )}
            {testError && (
              <p className="text-xs text-destructive" role="alert">
                {testError}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
