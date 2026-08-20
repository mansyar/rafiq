import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  getResolvedLocation,
  searchCities,
  setAdhanEnabled,
  setCalculationMethod,
  setLocation,
  setNotificationEnabled,
  triggerTestPrayer,
} from '@/lib/prayer';
import { setSetting } from '@/lib/tauri';

export function Settings() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
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

  // ── Location ──────────────────────────────────────────────────────────
  const resolvedQuery = useQuery({
    queryKey: ['resolved-location'],
    queryFn: getResolvedLocation,
  });

  const [cityQuery, setCityQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(cityQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [cityQuery]);

  const searchQuery = useQuery({
    queryKey: ['city-search', debouncedQuery],
    enabled: debouncedQuery.length >= 2,
    queryFn: () => searchCities(debouncedQuery, 8),
  });

  const locationMutation = useMutation({
    mutationFn: setLocation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['resolved-location'] });
      await queryClient.invalidateQueries({ queryKey: ['prayer-times'] });
    },
  });

  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Prefill manual fields from resolved when available (city is null → manual)
  const resolvedCity = resolvedQuery.data?.city ?? null;
  useEffect(() => {
    if (resolvedQuery.data && !resolvedCity) {
      setManualLat(String(resolvedQuery.data.latitude));
      setManualLon(String(resolvedQuery.data.longitude));
    }
  }, [resolvedQuery.data, resolvedCity]);

  async function handleSelectCity(cityId: string) {
    setLocationError(null);
    setLocationMessage(null);
    try {
      await locationMutation.mutateAsync({ city_id: cityId, latitude: null, longitude: null });
      setLocationMessage(t('settings.locationSaved'));
      setCityQuery('');
      setDebouncedQuery('');
    } catch (e) {
      setLocationError(t('settings.locationError', { message: String(e) }));
    }
  }

  async function handleSaveManual() {
    setLocationError(null);
    setLocationMessage(null);
    const lat = Number(manualLat.trim());
    const lon = Number(manualLon.trim());
    if (
      manualLat.trim() === '' ||
      manualLon.trim() === '' ||
      Number.isNaN(lat) ||
      Number.isNaN(lon)
    ) {
      setLocationError(t('settings.locationError', { message: 'Enter valid numbers' }));
      return;
    }
    try {
      await locationMutation.mutateAsync({ city_id: null, latitude: lat, longitude: lon });
      setLocationMessage(t('settings.locationSaved'));
    } catch (e) {
      setLocationError(t('settings.locationError', { message: String(e) }));
    }
  }

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

  const locationLabel = useMemo(() => {
    if (!resolvedQuery.data) return null;
    if (resolvedQuery.data.city)
      return `${resolvedQuery.data.city.name}, ${resolvedQuery.data.city.country}`;
    return t('today.manualFallback', {
      lat: resolvedQuery.data.latitude.toFixed(4),
      lon: resolvedQuery.data.longitude.toFixed(4),
    });
  }, [resolvedQuery.data, t]);

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
          <div className="space-y-3">
            <h3 className="text-sm font-medium">{t('settings.location')}</h3>
            <p className="text-xs text-muted-foreground">{t('settings.locationHint')}</p>
            {locationLabel && (
              <p className="text-sm">
                <span className="font-medium">{t('today.location')}:</span> {locationLabel}
                {resolvedQuery.data?.city?.timezone && (
                  <span className="text-muted-foreground">
                    {' '}
                    • {resolvedQuery.data.city.timezone}
                  </span>
                )}
              </p>
            )}

            {/* City search */}
            <div className="space-y-2">
              <label htmlFor="city-search" className="text-xs font-medium">
                {t('settings.location')}
              </label>
              <input
                id="city-search"
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                placeholder={t('settings.citySearchPlaceholder')}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-autocomplete="list"
                aria-controls="city-results"
              />
              {searchQuery.data && searchQuery.data.length > 0 && (
                <div
                  id="city-results"
                  className="max-h-48 overflow-y-auto rounded-md border bg-popover p-1 shadow"
                >
                  {searchQuery.data.map((city) => (
                    <div key={city.id}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                        onClick={() => handleSelectCity(city.id)}
                      >
                        <span>
                          {city.name}, {city.country}
                        </span>
                        <span className="text-xs text-muted-foreground">{city.country_code}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {debouncedQuery.length >= 2 &&
                searchQuery.data?.length === 0 &&
                !searchQuery.isLoading && (
                  <p className="text-xs text-muted-foreground">No results</p>
                )}
            </div>

            <div className="flex items-center gap-2 py-1">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

            {/* Manual coordinates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="manual-lat" className="text-xs font-medium">
                  {t('settings.manualLat')}
                </label>
                <input
                  id="manual-lat"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  placeholder="-6.2088"
                  inputMode="decimal"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="manual-lon" className="text-xs font-medium">
                  {t('settings.manualLon')}
                </label>
                <input
                  id="manual-lon"
                  value={manualLon}
                  onChange={(e) => setManualLon(e.target.value)}
                  placeholder="106.8456"
                  inputMode="decimal"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleSaveManual}
              disabled={locationMutation.isPending}
              aria-busy={locationMutation.isPending}
            >
              {t('settings.saveLocation')}
            </Button>

            {locationMessage && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">{locationMessage}</p>
            )}
            {locationError && (
              <p className="text-xs text-destructive" role="alert">
                {locationError}
              </p>
            )}
          </div>

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
                      setLocationMessage(null);
                      setLocationError(null);
                      await triggerTestPrayer(p);
                      setLocationMessage(`Test trigger sent for ${p}`);
                    } catch (e) {
                      setLocationError(String(e));
                    }
                  }}
                >
                  Test {p}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
