import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { QueryError } from '@/components/query-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  deleteLogEntry,
  getLogAnalytics,
  getPrayerLog,
  type LoggablePrayer,
  logPrayer,
  logWindowDates,
  prayerStatus,
} from '@/lib/log';
import {
  getCalculationMethod,
  getPrayerTimes,
  getResolvedLocation,
  isPast,
  todayDateString,
} from '@/lib/prayer';

const PRAYERS: readonly LoggablePrayer[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/** Local weekday letter for a YYYY-MM-DD date (0=Sun). */
function weekdayLetter(date: string, locale: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(locale, { weekday: 'narrow' });
}

function dayLabel(date: string, locale: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}

export function LogPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const today = todayDateString();
  const windowDates = logWindowDates(7);

  const locationQuery = useQuery({
    queryKey: ['resolved-location'],
    queryFn: getResolvedLocation,
    staleTime: 5 * 60 * 1000,
  });
  const logQuery = useQuery({
    queryKey: ['prayer-log', windowDates[0], today],
    queryFn: () => getPrayerLog(windowDates[0], today),
  });
  const analyticsQuery = useQuery({
    queryKey: ['log-analytics', today],
    queryFn: getLogAnalytics,
  });
  const methodQuery = useQuery({
    queryKey: ['prayer-method'],
    queryFn: getCalculationMethod,
    staleTime: 1000 * 60 * 60,
  });
  const timesQuery = useQuery({
    queryKey: ['prayer-times', today, locationQuery.data, methodQuery.data],
    enabled: !!locationQuery.data && !!methodQuery.data,
    queryFn: async () => {
      if (!locationQuery.data) throw new Error('no location');
      return getPrayerTimes({
        date: today,
        coordinates: {
          latitude: locationQuery.data.latitude,
          longitude: locationQuery.data.longitude,
        },
        method: methodQuery.data ?? null,
      });
    },
    staleTime: 1000 * 60 * 60, // cache for an hour; recompute on date change
  });

  const entries = logQuery.data ?? [];
  const analytics = analyticsQuery.data;
  const locale = i18n.language;

  function fail(message: string) {
    setError(message);
    setBusy(null);
  }

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['prayer-log'] }),
      queryClient.invalidateQueries({ queryKey: ['log-analytics'] }),
    ]);
  }

  async function handleLog(date: string, prayer: LoggablePrayer) {
    const key = `${date}:${prayer}`;
    setBusy(key);
    setError(null);
    setConfirmDelete(null);
    try {
      await logPrayer(prayer, date);
      await refresh();
    } catch (e) {
      fail(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(date: string, prayer: LoggablePrayer) {
    const key = `${date}:${prayer}`;
    setBusy(key);
    setConfirmDelete(null);
    try {
      await deleteLogEntry(date, prayer);
      await refresh();
    } catch (e) {
      fail(String(e));
    } finally {
      setBusy(null);
    }
  }

  if (locationQuery.data === null) {
    return (
      <section aria-labelledby="page-log-title" className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle id="page-log-title" className="font-heading text-2xl">
              {t('page.log.title')}
            </CardTitle>
            <CardDescription>{t('page.log.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-gold-200 bg-gold-50 p-4 text-sm text-gold-900 dark:border-gold-900 dark:bg-gold-950/30 dark:text-gold-100">
              {t('log.noLocation.hint')}{' '}
              <Link
                to="/settings"
                className="font-medium text-gold-700 underline-offset-4 hover:underline dark:text-gold-300"
              >
                {t('log.noLocation.openSettings')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  const todayComplete = PRAYERS.every((p) => prayerStatus(entries, today, p) !== 'missed');

  return (
    <section aria-labelledby="page-log-title" className="mx-auto max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle id="page-log-title" className="font-heading text-2xl">
            {t('page.log.title')}
          </CardTitle>
          <CardDescription>{t('page.log.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          {logQuery.isLoading && (
            <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
              {t('log.loading')}
            </p>
          )}
          {logQuery.isError && !error && (
            <p role="alert" className="text-sm text-destructive">
              {t('log.error')}
            </p>
          )}

          {!logQuery.isLoading && (
            <>
              <div>
                <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                  {t('log.today.title')}
                </h2>
                <ul className="divide-y divide-border rounded-lg border">
                  {PRAYERS.map((prayer) => {
                    const status = prayerStatus(entries, today, prayer);
                    const key = `${today}:${prayer}`;
                    const deleting = confirmDelete === key;
                    const time = timesQuery.data?.[prayer];
                    const windowOpen = !time || isPast(time);
                    return (
                      <li key={prayer} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-20">{t(`prayer.${prayer}`)}</span>
                          {status !== 'missed' && (
                            <span
                              className={
                                status === 'on_time'
                                  ? 'rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300'
                                  : 'rounded-full bg-gold-500/10 px-2 py-0.5 text-xs text-gold-700 ring-1 ring-gold-500/20 dark:text-gold-300'
                              }
                            >
                              {t(`log.status.${status}`)}
                            </span>
                          )}
                        </div>
                        {status === 'missed' ? (
                          <Button
                            size="sm"
                            onClick={() => void handleLog(today, prayer)}
                            disabled={busy !== null || !windowOpen}
                            aria-label={`${t('log.today.log')} ${t(`prayer.${prayer}`)}`}
                          >
                            {t('log.today.log')}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              deleting ? void handleDelete(today, prayer) : setConfirmDelete(key)
                            }
                            disabled={busy !== null}
                            aria-label={`${t('log.today.delete')} ${t(`prayer.${prayer}`)}`}
                          >
                            {deleting ? t('log.today.confirmDelete') : t('log.today.delete')}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {todayComplete && (
                  <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
                    {t('log.today.allLogged')}
                  </p>
                )}
              </div>

              <div>
                <h2 className="mb-2 text-sm font-medium text-muted-foreground">
                  {t('log.week.title')}
                </h2>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full border-collapse">
                    <caption className="sr-only">{t('log.week.title')}</caption>
                    <tbody>
                      {windowDates.map((date) => (
                        <tr key={date} className="border-b last:border-b-0">
                          <th
                            scope="row"
                            className="w-24 px-3 py-2 text-left text-xs font-normal text-muted-foreground"
                          >
                            {weekdayLetter(date, locale)} {dayLabel(date, locale)}
                            {date === today && (
                              <span className="sr-only"> ({t('log.week.today')})</span>
                            )}
                          </th>
                          {PRAYERS.map((prayer) => {
                            const status = prayerStatus(entries, date, prayer);
                            const time = date === today ? timesQuery.data?.[prayer] : undefined;
                            const windowOpen = !time || isPast(time);
                            return (
                              <td key={prayer} className="p-0">
                                <button
                                  type="button"
                                  aria-label={`${t(`prayer.${prayer}`)} — ${t(`log.status.${status}`)} (${dayLabel(date, locale)})`}
                                  onClick={
                                    status === 'missed'
                                      ? () => void handleLog(date, prayer)
                                      : undefined
                                  }
                                  disabled={
                                    status !== 'missed' ||
                                    busy !== null ||
                                    (date === today && !windowOpen)
                                  }
                                  className={`h-8 w-full ${
                                    status === 'on_time'
                                      ? 'bg-emerald-500/70'
                                      : status === 'qada'
                                        ? 'bg-gold-500/70'
                                        : 'bg-transparent hover:bg-muted'
                                  }`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">{t('log.week.legend')}</p>
              </div>

              {analytics ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-base">
                        {t('log.streaks.title')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-baseline justify-between">
                        <span className="text-muted-foreground">{t('log.streaks.current')}</span>
                        <span className="text-2xl font-semibold">{analytics.streaks.current}</span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <span className="text-muted-foreground">{t('log.streaks.best')}</span>
                        <span className="text-2xl font-semibold">{analytics.streaks.best}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('log.streaks.hint')}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-heading text-base">
                        {t('log.month.title')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5 text-sm">
                      {(
                        [
                          ['completion', 'log.month.completion', analytics.month.completion_pct],
                          ['on_time', 'log.month.onTime', analytics.month.on_time_pct],
                          ['qada', 'log.month.qada', analytics.month.qada_pct],
                          ['missed', 'log.month.missed', analytics.month.missed_pct],
                        ] as const
                      ).map(([label, key, pct]) => (
                        <div key={label} className="flex items-baseline justify-between">
                          <span className="text-muted-foreground">{t(key)}</span>
                          <span>{Math.round(pct)}%</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              ) : analyticsQuery.isError ? (
                <QueryError
                  message={t('log.analyticsError')}
                  onRetry={() => void analyticsQuery.refetch()}
                  retrying={analyticsQuery.isFetching}
                />
              ) : (
                !analyticsQuery.isLoading && (
                  <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                    {t('log.loading')}
                  </p>
                )
              )}

              {entries.length === 0 && (
                <p className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
                  {t('log.empty')}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
