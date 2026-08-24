import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { DailyReflectionCard } from '@/components/daily-reflection-card';
import { QueryError } from '@/components/query-error';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { UpcomingEventsStrip } from '@/components/upcoming-events-strip';
import {
  formatPrayerTime,
  getCalculationMethod,
  getNextPrayer,
  getPrayerTimes,
  getResolvedLocation,
  type PrayerName,
  type PrayerTimes,
  todayDateString,
} from '@/lib/prayer';
import { cn } from '@/lib/utils';

const DISPLAY_ORDER: readonly PrayerName[] = [
  'fajr',
  'sunrise',
  'dhuhr',
  'asr',
  'maghrib',
  'isha',
] as const;

function useTodayQuery() {
  const { i18n } = useTranslation();

  const resolved = useQuery({
    queryKey: ['resolved-location'],
    queryFn: getResolvedLocation,
    staleTime: 1000 * 60 * 5,
  });

  const method = useQuery({
    queryKey: ['prayer-method'],
    queryFn: getCalculationMethod,
    staleTime: 1000 * 60 * 60,
  });

  const date = todayDateString();

  const times = useQuery({
    queryKey: ['prayer-times', date, resolved.data, method.data],
    enabled: !!resolved.data && !!method.data,
    queryFn: async () => {
      if (!resolved.data) throw new Error('no location');
      return getPrayerTimes({
        date,
        coordinates: { latitude: resolved.data.latitude, longitude: resolved.data.longitude },
        method: method.data ?? null,
      });
    },
    staleTime: 1000 * 60 * 60, // cache for an hour; recompute on date change
  });

  return { resolved, method, times, date, locale: i18n.language };
}

export function Today() {
  const { t } = useTranslation();
  const { resolved, method, times, locale } = useTodayQuery();

  const isLoading = resolved.isLoading || method.isLoading || times.isLoading;
  const isError = resolved.isError || method.isError || times.isError;
  const errorMessage =
    (times.error as Error | undefined)?.message ??
    (resolved.error as Error | undefined)?.message ??
    (method.error as Error | undefined)?.message ??
    null;

  // Next prayer computed only when times are available
  const next = times.data ? getNextPrayer(times.data as PrayerTimes) : null;

  // Location label
  let locationLabel: string | null = null;
  if (resolved.data) {
    if (resolved.data.city) {
      locationLabel = `${resolved.data.city.name}, ${resolved.data.city.country}`;
    } else {
      locationLabel = t('today.manualFallback', {
        lat: resolved.data.latitude.toFixed(4),
        lon: resolved.data.longitude.toFixed(4),
      });
    }
  }

  const methodLabel = method.data ? t(`settings.methods.${method.data}` as const) : null;

  return (
    <section aria-labelledby="page-today" className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle id="page-today" className="font-heading text-2xl">
            {t('page.today.title')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t('page.today.subtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Meta: location + method */}
          <div className="flex flex-col gap-1 text-sm">
            <p className="flex items-center gap-2">
              <span className="font-medium text-ink-700 dark:text-ink-100">
                {t('today.location')}:
              </span>
              {resolved.isLoading ? (
                <span className="text-muted-foreground">{t('today.loading')}</span>
              ) : locationLabel ? (
                <span>{locationLabel}</span>
              ) : (
                <span className="text-muted-foreground">{t('today.notSet')}</span>
              )}
            </p>
            <p className="flex items-center gap-2">
              <span className="font-medium text-ink-700 dark:text-ink-100">
                {t('today.method')}:
              </span>
              {method.isLoading ? (
                <span className="text-muted-foreground">…</span>
              ) : methodLabel ? (
                <span>{methodLabel}</span>
              ) : null}
            </p>
          </div>

          <Separator />

          {/* States */}
          {!resolved.data && !isLoading && !isError && (
            <div className="rounded-md border border-gold-200 bg-gold-50 p-4 text-sm dark:border-gold-900 dark:bg-gold-950/30">
              <p className="text-ink-800 dark:text-ink-100">{t('today.notSet')}</p>
              <Link
                to="/settings"
                className="mt-2 inline-flex text-sm font-medium text-gold-700 underline-offset-4 hover:underline dark:text-gold-300"
              >
                {t('settings.location')} →
              </Link>
            </div>
          )}

          {isLoading && (
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              {t('today.loading')}
            </p>
          )}

          {isError && (
            <QueryError
              message={t('today.error', { message: errorMessage ?? '' })}
              onRetry={() => {
                void resolved.refetch();
                void method.refetch();
                void times.refetch();
              }}
              retrying={resolved.isFetching || method.isFetching || times.isFetching}
            />
          )}

          {/* Prayer list */}
          {times.data && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-wide text-ink-600 dark:text-ink-200">
                  {t('today.prayerTimes')}
                </h2>
                {next ? (
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-400/10 dark:text-emerald-300">
                    {t('today.nextPrayer', {
                      name: t(`prayer.${next.name}` as const),
                      time: formatPrayerTime(next.time, locale),
                    })}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">{t('today.allCompleted')}</span>
                )}
              </div>

              <ul
                aria-label={t('today.prayerTimes')}
                className="divide-y divide-border overflow-hidden rounded-lg border"
              >
                {DISPLAY_ORDER.map((name) => {
                  const iso = (times.data as PrayerTimes)[name];
                  const isNext = next?.name === name;
                  const timeLabel = formatPrayerTime(iso, locale);
                  const prayerLabel = t(`prayer.${name}` as const);
                  return (
                    <li
                      key={name}
                      aria-current={isNext ? 'true' : undefined}
                      className={cn(
                        'flex items-center justify-between px-4 py-3 text-sm transition-colors',
                        isNext
                          ? 'bg-gold-50 font-medium text-ink-900 ring-inset dark:bg-gold-900/20 dark:text-ink-50'
                          : 'bg-card hover:bg-muted/50',
                      )}
                    >
                      <span
                        className={cn(
                          'flex items-center gap-2',
                          isNext && 'text-gold-700 dark:text-gold-200',
                        )}
                      >
                        {isNext && (
                          <span
                            aria-hidden="true"
                            className="size-1.5 shrink-0 rounded-full bg-gold-500 animate-pulse"
                          />
                        )}
                        {prayerLabel}
                      </span>
                      <time
                        dateTime={iso}
                        className={cn('tabular-nums', isNext && 'text-gold-700 dark:text-gold-200')}
                      >
                        {timeLabel}
                      </time>
                    </li>
                  );
                })}
              </ul>

              {/* Footnote: timezone when city */}
              {resolved.data?.city?.timezone && (
                <p className="text-xs text-muted-foreground">
                  {resolved.data.city.timezone} • {todayDateString()}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <UpcomingEventsStrip />

      <DailyReflectionCard />
    </section>
  );
}
