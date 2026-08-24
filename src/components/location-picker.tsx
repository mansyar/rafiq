import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getResolvedLocation, searchCities, setLocation } from '@/lib/prayer';

/**
 * Shared location entry: debounced city search (~300ms) with a result list,
 * or manual latitude/longitude coordinates. Prefills the manual fields from
 * the resolved location when no city is set (e.g. when re-running setup).
 * Used by both the Settings page and the onboarding wizard.
 */
export function LocationPicker({ idPrefix }: { idPrefix: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Prefill manual fields from resolved when available (city is null → manual)
  const resolvedCity = resolvedQuery.data?.city ?? null;
  useEffect(() => {
    if (resolvedQuery.data && !resolvedCity) {
      setManualLat(String(resolvedQuery.data.latitude));
      setManualLon(String(resolvedQuery.data.longitude));
    }
  }, [resolvedQuery.data, resolvedCity]);

  async function handleSelectCity(cityId: string) {
    setError(null);
    setMessage(null);
    try {
      await locationMutation.mutateAsync({ city_id: cityId, latitude: null, longitude: null });
      setMessage(t('settings.locationSaved'));
      setCityQuery('');
      setDebouncedQuery('');
    } catch (e) {
      setError(t('settings.locationError', { message: String(e) }));
    }
  }

  async function handleSaveManual() {
    setError(null);
    setMessage(null);
    const lat = Number(manualLat.trim());
    const lon = Number(manualLon.trim());
    if (
      manualLat.trim() === '' ||
      manualLon.trim() === '' ||
      Number.isNaN(lat) ||
      Number.isNaN(lon) ||
      lat < -90 ||
      lat > 90 ||
      lon < -180 ||
      lon > 180
    ) {
      setError(t('settings.locationInvalidNumbers'));
      return;
    }
    try {
      await locationMutation.mutateAsync({ city_id: null, latitude: lat, longitude: lon });
      setMessage(t('settings.locationSaved'));
    } catch (e) {
      setError(t('settings.locationError', { message: String(e) }));
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t('settings.locationHint')}</p>

      {/* City search */}
      <div className="space-y-2">
        <label htmlFor={`${idPrefix}-city-search`} className="text-xs font-medium">
          {t('settings.location')}
        </label>
        <input
          id={`${idPrefix}-city-search`}
          value={cityQuery}
          onChange={(e) => setCityQuery(e.target.value)}
          placeholder={t('settings.citySearchPlaceholder')}
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-autocomplete="list"
          aria-controls={`${idPrefix}-city-results`}
        />
        {searchQuery.data && searchQuery.data.length > 0 && (
          <div
            id={`${idPrefix}-city-results`}
            className="max-h-48 overflow-y-auto rounded-md border bg-popover p-1 shadow"
          >
            {searchQuery.data.map((city) => (
              <div key={city.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => handleSelectCity(city.id)}
                  disabled={locationMutation.isPending}
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
        {debouncedQuery.length >= 2 && searchQuery.data?.length === 0 && !searchQuery.isLoading && (
          <p className="text-xs text-muted-foreground">{t('settings.noResults')}</p>
        )}
      </div>

      <div className="flex items-center gap-2 py-1">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">{t('settings.or')}</span>
        <Separator className="flex-1" />
      </div>

      {/* Manual coordinates */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-manual-lat`} className="text-xs font-medium">
            {t('settings.manualLat')}
          </label>
          <input
            id={`${idPrefix}-manual-lat`}
            value={manualLat}
            onChange={(e) => setManualLat(e.target.value)}
            placeholder="-6.2088"
            inputMode="decimal"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-manual-lon`} className="text-xs font-medium">
            {t('settings.manualLon')}
          </label>
          <input
            id={`${idPrefix}-manual-lon`}
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

      {message && <p className="text-xs text-emerald-600 dark:text-emerald-400">{message}</p>}
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
