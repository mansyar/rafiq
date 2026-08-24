import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getUpcomingHijriEvents, type UpcomingEvent } from '@/lib/hijri';
import { cn } from '@/lib/utils';

/** Localized "12 June 2026"-style label; noon anchor avoids UTC shifts. */
function formatEventDate(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(`${iso}T12:00:00`));
  } catch {
    return iso;
  }
}

function EventItem({ event, locale }: { event: UpcomingEvent; locale: string }) {
  const { t } = useTranslation();
  const name = t(`hijriEvents.events.${event.id}.name`);
  const description = t(`hijriEvents.events.${event.id}.description`);
  const estimatedSuffix = event.estimated ? ` ${t('hijriEvents.strip.estimatedSuffix')}` : '';

  return (
    <li
      className={cn(
        'rounded-lg border p-3',
        event.is_today
          ? 'border-gold-400/70 bg-gold-50 ring-1 ring-gold-500/30 dark:border-gold-600/50 dark:bg-gold-950/30'
          : 'border-border bg-background',
      )}
    >
      <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold text-ink-900 dark:text-ink-50">
        {event.is_today && (
          <span
            data-testid="today-pill"
            className="rounded-full bg-gold-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
          >
            {t('hijriEvents.strip.todayPrefix')}
          </span>
        )}
        <span>
          {name}
          {estimatedSuffix}
        </span>
      </p>
      <p className="mt-1 text-xs leading-snug text-muted-foreground">{description}</p>
      <time
        dateTime={event.gregorian_date}
        className="mt-1.5 block text-xs font-medium tabular-nums text-gold-700 dark:text-gold-300"
      >
        {formatEventDate(event.gregorian_date, locale)}
      </time>
    </li>
  );
}

/**
 * "Upcoming observances" strip for the Today page (spec FR-3): the next three
 * bundled Hijri observances, leading with a distinct Today emphasis when one
 * falls on the current day. Ambient information — renders nothing while
 * loading or unavailable.
 */
export function UpcomingEventsStrip() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language?.startsWith('id') ? 'id' : 'en';

  const query = useQuery({
    queryKey: ['upcoming-hijri-events'],
    queryFn: () => getUpcomingHijriEvents(3),
    staleTime: 1000 * 60 * 30,
  });

  if (!query.data?.length) return null;

  return (
    <Card
      aria-labelledby="upcoming-events-title"
      data-testid="upcoming-events-strip"
      className="border-gold-200/60 dark:border-gold-900/40"
    >
      <CardHeader className="pb-3">
        <CardTitle id="upcoming-events-title" className="font-heading text-lg">
          {t('hijriEvents.strip.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ul aria-label={t('hijriEvents.strip.title')} className="grid gap-2 sm:grid-cols-3">
          {query.data.map((ev) => (
            <EventItem key={`${ev.id}-${ev.gregorian_date}`} event={ev} locale={locale} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
