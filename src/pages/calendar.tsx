import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { type GridDay, getMonthGrid, todayHijri } from '@/lib/hijri';
import { cn } from '@/lib/utils';

interface Cursor {
  year: number;
  month: number;
}

/** Moves to the previous (−1) or next (+1) Hijri month, carrying the year. */
function shiftMonth(cursor: Cursor, delta: -1 | 1): Cursor {
  const month = cursor.month + delta;
  if (month === 0) return { year: cursor.year - 1, month: 12 };
  if (month === 13) return { year: cursor.year + 1, month: 1 };
  return { year: cursor.year, month };
}

function CalendarCell({
  day,
  showGregMonth,
  gregMonths,
}: {
  day: GridDay;
  showGregMonth: boolean;
  gregMonths: string[];
}) {
  return (
    <div
      aria-current={day.is_today ? 'date' : undefined}
      className={cn(
        'flex flex-col items-center rounded-lg border px-1 py-2',
        day.is_today
          ? 'border-gold-500/60 bg-gold-500/10 ring-1 ring-gold-500/40'
          : 'border-border bg-background',
      )}
    >
      <span
        className={cn(
          'text-base font-semibold tabular-nums',
          day.is_today && 'text-gold-700 dark:text-gold-300',
        )}
      >
        {day.hijri_day}
      </span>
      <span className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
        {day.gregorian_day}
        {showGregMonth && (
          <span className="ml-0.5 font-medium text-foreground/70">
            {gregMonths[day.gregorian_month - 1]}
          </span>
        )}
      </span>
    </div>
  );
}

export function CalendarPage() {
  const { t } = useTranslation();
  const [cursor, setCursor] = useState<Cursor | null>(null);

  const todayQuery = useQuery({
    queryKey: ['hijri-today'],
    queryFn: todayHijri,
    staleTime: 1000 * 60 * 5,
  });

  const today = todayQuery.data ?? null;
  const effective: Cursor | null =
    cursor ?? (today ? { year: today.year, month: today.month } : null);

  const gridQuery = useQuery({
    queryKey: ['hijri-grid', effective?.year ?? -1, effective?.month ?? -1],
    queryFn: () => {
      if (!effective) throw new Error('month grid requested before today resolved');
      return getMonthGrid(effective.year, effective.month);
    },
    enabled: effective !== null,
  });

  const grid = gridQuery.data ?? null;
  const weekdays = t('calendar.weekdays') as unknown as string[];
  const gregMonths = t('calendar.gregMonths') as unknown as string[];

  const isLoading = todayQuery.isLoading || gridQuery.isLoading;
  const isError = gridQuery.isError;
  const errorMessage = (gridQuery.error as Error | undefined)?.message ?? null;

  return (
    <section aria-labelledby="page-calendar" className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle id="page-calendar" className="font-heading text-2xl">
                {t('calendar.title')}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{t('calendar.subtitle')}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label={t('calendar.prevMonth')}
                disabled={!effective}
                onClick={() => effective && setCursor(shiftMonth(effective, -1))}
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!today}
                onClick={() => today && setCursor({ year: today.year, month: today.month })}
              >
                {t('calendar.todayButton')}
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={t('calendar.nextMonth')}
                disabled={!effective}
                onClick={() => effective && setCursor(shiftMonth(effective, 1))}
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {today && (
            <p className="text-sm text-muted-foreground">
              {t('calendar.todayDate', {
                day: today.day,
                monthName: t(`calendar.months.${today.month}`),
                year: today.year,
              })}
            </p>
          )}

          {isLoading && (
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              {t('calendar.loading')}
            </p>
          )}
          {isError && errorMessage && (
            <p className="text-sm text-destructive" role="alert">
              {t('calendar.error', { message: errorMessage })}
            </p>
          )}

          {effective && grid && (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-heading text-xl">
                  {t(`calendar.months.${effective.month}`)} {effective.year}
                </h2>
                <span
                  dir="rtl"
                  lang="ar"
                  className="shrink-0 font-arabic text-xl leading-none text-ink-800 dark:text-ink-100"
                >
                  {t(`calendar.monthsArabic.${effective.month}`)}
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {weekdays.map((label) => (
                  <div
                    key={label}
                    className="pb-1 text-center text-xs font-medium tracking-wide text-muted-foreground"
                  >
                    {label}
                  </div>
                ))}
                {grid.days.map((d, i) => {
                  const prev = i === 0 ? null : grid.days[i - 1];
                  return (
                    <CalendarCell
                      key={d.hijri_day}
                      day={d}
                      gregMonths={gregMonths}
                      showGregMonth={prev === null || d.gregorian_month !== prev.gregorian_month}
                    />
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">{t('calendar.footnote')}</p>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
