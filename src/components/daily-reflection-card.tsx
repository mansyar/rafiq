import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { QueryError } from '@/components/query-error';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { formatAyahReference, getHadithTranslation, useDailyContent } from '@/lib/daily';
import { cn } from '@/lib/utils';

export function DailyReflectionCard() {
  const { t, i18n } = useTranslation();
  const daily = useDailyContent();
  const [expanded, setExpanded] = useState(false);

  const locale = i18n.language?.startsWith('id') ? 'id' : 'en';

  // Localized date label for header (uses backend's date string)
  let formattedDate: string | null = null;
  if (daily.data?.date) {
    try {
      // daily.date YYYY-MM-DD is local; construct at noon local to avoid UTC-midnight shift.
      // T12:00:00 ensures the date doesn't shift across timezones/DST; alternative explicit parse
      // `new Date(y, m-1, d, 12,0,0)` yields the same local noon.
      const d = new Date(`${daily.data.date}T12:00:00`);
      formattedDate = new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(d);
    } catch {
      formattedDate = daily.data.date;
    }
  }

  if (daily.isLoading) {
    return (
      <Card aria-busy="true" aria-live="polite">
        <CardHeader>
          <CardTitle className="font-heading text-lg">{t('daily.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('daily.subtitle')}</p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground" role="status">
            {t('daily.loading')}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (daily.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-lg">{t('daily.title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('daily.subtitle')}</p>
        </CardHeader>
        <CardContent>
          <QueryError
            message={t('daily.errorGeneric')}
            onRetry={() => void daily.refetch()}
            retrying={daily.isFetching}
          />
        </CardContent>
      </Card>
    );
  }

  const content = daily.data;
  if (!content) return null;

  // Observance override (spec FR-5): when present, the themed ayah/hadith
  // replace the rotation and the event label is surfaced as a badge.
  const override = content.event;
  const { ayah, hadith } = override ?? content;
  const eventName = override ? t(`hijriEvents.events.${override.event_id}.name`) : null;
  const ayahRef = formatAyahReference(ayah);
  const surahLabel = ayah.surah_name_en;
  const hadithTranslation = getHadithTranslation(hadith, locale);
  const HADITH_CLAMP_EN = 220; // ~4 lines at max-w-2xl, 0.95rem — English
  const HADITH_CLAMP_AR = 280; // Arabic ~1.45rem denser
  const needsClamp =
    hadithTranslation.length > HADITH_CLAMP_EN || hadith.arabic.length > HADITH_CLAMP_AR;
  const ayahAriaLabel = t('daily.ayahAriaLabel', {
    surah: surahLabel,
    reference: `${ayah.surah_id}:${ayah.ayah_number}`,
  });
  const hadithAriaLabel = t('daily.hadithAriaLabel', {
    id: hadith.id,
    source: hadith.source,
  });

  return (
    <Card
      aria-labelledby="daily-reflection-title"
      className="overflow-hidden border-gold-200/60 dark:border-gold-900/40"
    >
      <CardHeader className="space-y-1.5 border-b border-gold-100 bg-gold-50/40 pb-4 dark:border-gold-900/30 dark:bg-gold-950/15">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle id="daily-reflection-title" className="font-heading text-lg">
            {t('daily.title')}
          </CardTitle>
          {formattedDate && (
            <span className="shrink-0 text-xs font-medium tracking-wide text-ink-600 dark:text-ink-300">
              {formattedDate}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{t('daily.subtitle')}</p>
        {eventName && (
          <p className="pt-0.5">
            <span
              data-testid="event-badge"
              className="rounded-full bg-gold-100 px-2.5 py-0.5 text-xs font-semibold text-gold-800 ring-1 ring-gold-500/30 dark:bg-gold-900/40 dark:text-gold-200"
            >
              {eventName}
            </span>
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-6 pt-5">
        {/* ── Ayah block — links to Quran reader ───────────────────── */}
        <section aria-label={t('daily.ayahLabel')}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gold-700 dark:text-gold-200">
            {t('daily.ayahLabel')}
          </h3>

          <Link
            to={`/quran/${ayah.surah_id}`}
            aria-label={ayahAriaLabel}
            className={cn(
              'group block overflow-hidden rounded-lg border border-gold-200 bg-card transition-colors',
              'hover:border-gold-300 hover:bg-gold-50/30 dark:border-gold-900/40 dark:hover:bg-gold-950/20',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
            )}
          >
            {/* Surah header */}
            <div className="flex items-center justify-between gap-2 border-b border-gold-100 bg-gold-50/60 px-4 py-2.5 dark:border-gold-900/30 dark:bg-gold-950/20">
              <span className="flex items-center gap-2 text-sm font-medium">
                <span className="text-ink-900 dark:text-ink-50">{surahLabel}</span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold tabular-nums text-gold-700 ring-1 ring-gold-500/20 dark:bg-ink-900 dark:text-gold-200">
                  {ayah.surah_id}:{ayah.ayah_number}
                </span>
              </span>
              <span
                dir="rtl"
                lang="ar"
                className="font-arabic text-base text-ink-700 dark:text-ink-200"
                aria-hidden="true"
              >
                {ayah.surah_name_ar}
              </span>
            </div>

            {/* Sacred Arabic — high contrast, unobstructed */}
            <div className="bg-amber-50/20 px-5 py-6 dark:bg-ink-900/20">
              <p
                dir="rtl"
                lang="ar"
                className="font-arabic text-[1.7rem] leading-loose text-ink-900 dark:text-ink-50"
                style={{ lineHeight: '2.3' }}
              >
                {ayah.arabic}
              </p>
            </div>

            <div className="border-t bg-card px-5 py-4">
              <p className="text-[0.96rem] leading-relaxed text-ink-800 dark:text-ink-100">
                {ayah.translation}
              </p>
              <p className="mt-2 flex items-center gap-1 text-xs font-medium text-gold-700 dark:text-gold-300">
                {t('daily.openInQuran')} <span aria-hidden="true">→</span>
              </p>
              <span className="sr-only">{ayahRef}</span>
            </div>
          </Link>
        </section>

        <Separator className="bg-gold-100 dark:bg-gold-900/30" />

        {/* ── Hadith block ─────────────────────────────────────────── */}
        <section aria-label={hadithAriaLabel}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
            {t('daily.hadithLabel')}
          </h3>

          <div className="overflow-hidden rounded-lg border border-emerald-100 bg-card dark:border-emerald-900/30">
            {/* Hadith Arabic */}
            <div className="bg-emerald-50/25 px-5 py-6 dark:bg-emerald-950/10">
              <p
                dir="rtl"
                lang="ar"
                className="font-arabic text-[1.45rem] leading-loose text-ink-900 dark:text-ink-50"
                style={{ lineHeight: '2.2' }}
              >
                {hadith.arabic}
              </p>
            </div>

            <div className="space-y-3 px-5 py-4">
              <p
                className={cn(
                  'text-[0.95rem] leading-relaxed text-ink-800 dark:text-ink-100',
                  !expanded && needsClamp && 'line-clamp-4',
                )}
                lang={locale}
              >
                {hadithTranslation}
              </p>

              {needsClamp && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                  className="text-xs font-medium text-emerald-700 underline-offset-4 hover:underline dark:text-emerald-300"
                >
                  {expanded ? t('daily.showLess') : t('daily.showMore')}
                </button>
              )}

              <p className="border-t border-emerald-100 pt-3 text-xs text-muted-foreground dark:border-emerald-900/20">
                {t('daily.sourceLabel', { source: hadith.source })}
              </p>
            </div>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
