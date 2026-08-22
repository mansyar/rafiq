import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LocationPicker } from '@/components/location-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { DEFAULT_LOCALE, isSupportedLocale, type Locale, SUPPORTED_LOCALES } from '@/lib/locale';
import { useRecitationPlayer } from '@/lib/player-store';
import {
  CALCULATION_METHODS,
  type CalculationMethod,
  getAdhanEnabled,
  getCalculationMethod,
  getNotificationEnabled,
  setAdhanEnabled,
  setCalculationMethod,
  setNotificationEnabled,
} from '@/lib/prayer';
import {
  deleteRecitationCache,
  formatCacheSize,
  getRecitationCacheSummary,
} from '@/lib/recitation-cache';
import { setSetting } from '@/lib/tauri';
import { useUpdateStore } from '@/lib/update-store';

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

  // ── Updates ───────────────────────────────────────────────────────────
  const updateStatus = useUpdateStore((s) => s.status);
  const manualUpdateCheck = useUpdateStore((s) => s.manualCheck);

  // ── Recitation cache (FR-5) ───────────────────────────────────────────
  const [confirmClear, setConfirmClear] = useState(false);
  const cacheQuery = useQuery({
    queryKey: ['recitation-cache'],
    queryFn: getRecitationCacheSummary,
  });
  const cacheDelete = useMutation({
    mutationFn: (surahId: number | null) => deleteRecitationCache(surahId ?? undefined),
    onSuccess: async (_freed, surahId) => {
      // Stop playback gracefully when the file it is playing was just deleted.
      const player = useRecitationPlayer.getState();
      if (
        player.status !== 'idle' &&
        player.current &&
        (surahId === null || player.current.surahId === surahId)
      ) {
        player.stop();
      }
      setConfirmClear(false);
      await queryClient.invalidateQueries({ queryKey: ['recitation-cache'] });
    },
  });

  const updateStatusText =
    updateStatus.kind === 'available'
      ? t('settings.updateAvailable', { version: updateStatus.version })
      : updateStatus.kind === 'latest'
        ? t('settings.upToDate')
        : updateStatus.kind === 'checking'
          ? t('settings.checking')
          : updateStatus.kind === 'error'
            ? t('settings.updateError')
            : t('settings.updatesHint');

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
                {notifQuery.data ? t('settings.toggleOn') : t('settings.toggleOff')}
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
                {adhanQuery.data ? t('settings.toggleOn') : t('settings.toggleOff')}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Updates */}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">{t('settings.updates')}</p>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {updateStatusText}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={updateStatus.kind === 'checking'}
              onClick={() => void manualUpdateCheck()}
            >
              {updateStatus.kind === 'checking'
                ? t('settings.checking')
                : t('settings.checkForUpdates')}
            </Button>
          </div>

          <Separator />

          {/* Recitation downloads (FR-5) */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('settings.cacheTitle')}</legend>
            <p className="text-xs text-muted-foreground">{t('settings.cacheHint')}</p>
            {cacheQuery.isError && (
              <p className="text-xs text-destructive" role="alert">
                {String(cacheQuery.error)}
              </p>
            )}
            {cacheQuery.data && (
              <>
                {cacheQuery.data.surahs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('settings.cacheEmpty')}</p>
                ) : (
                  <div className="space-y-1" aria-live="polite">
                    <p className="text-sm font-medium tabular-nums">
                      {t('settings.cacheTotal', {
                        size: formatCacheSize(cacheQuery.data.total_bytes, currentLocale),
                      })}
                    </p>
                    {cacheQuery.data.surahs.map((s) => (
                      <div key={s.surah_id} className="flex items-center justify-between gap-2">
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {t('settings.cacheSurahRow', {
                            surah: s.surah_id,
                            ayahs: s.ayah_count,
                            size: formatCacheSize(s.size_bytes, currentLocale),
                          })}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t('settings.cacheDeleteSurah', { surah: s.surah_id })}
                          disabled={cacheDelete.isPending}
                          onClick={() => cacheDelete.mutate(s.surah_id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 pt-1">
                  {confirmClear ? (
                    <>
                      <span className="text-xs text-destructive" role="alert">
                        {t('settings.cacheConfirmClear')}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={cacheDelete.isPending}
                          onClick={() => cacheDelete.mutate(null)}
                        >
                          {t('settings.cacheYes')}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={cacheDelete.isPending}
                          onClick={() => setConfirmClear(false)}
                        >
                          {t('settings.cancel')}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          !cacheQuery.data ||
                          cacheQuery.data.total_bytes === 0 ||
                          cacheDelete.isPending
                        }
                        onClick={() => setConfirmClear(true)}
                      >
                        {t('settings.cacheClearAll')}
                      </Button>
                    </>
                  )}
                </div>
              </>
            )}
          </fieldset>
        </CardContent>
      </Card>
    </section>
  );
}
