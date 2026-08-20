import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listSurahs, searchSurahs } from '@/lib/quran';

export function QuranList() {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const listQuery = useQuery({
    queryKey: ['quran-list'],
    queryFn: listSurahs,
    staleTime: 1000 * 60 * 60,
    enabled: debounced.length < 2,
  });

  const searchQuery = useQuery({
    queryKey: ['quran-search', debounced],
    queryFn: () => searchSurahs(debounced, 20),
    enabled: debounced.length >= 2,
  });

  const surahs = useMemo(() => {
    if (debounced.length >= 2) return searchQuery.data ?? [];
    return listQuery.data ?? [];
  }, [debounced.length, listQuery.data, searchQuery.data]);

  const isLoading = debounced.length >= 2 ? searchQuery.isLoading : listQuery.isLoading;
  const isError = debounced.length >= 2 ? searchQuery.isError : listQuery.isError;
  const errorMessage =
    (searchQuery.error as Error | undefined)?.message ??
    (listQuery.error as Error | undefined)?.message ??
    null;

  const locale = i18n.language === 'id' ? 'id' : 'en';

  return (
    <section aria-labelledby="page-quran" className="mx-auto max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle id="page-quran" className="font-heading text-2xl">
            {t('quran.title')}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t('quran.subtitle')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <label htmlFor="quran-search" className="text-sm font-medium">
            {t('settings.language') === 'Bahasa'
              ? t('quran.searchPlaceholder')
              : t('quran.searchPlaceholder')}
          </label>
          <input
            id="quran-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('quran.searchPlaceholder')}
            aria-label={t('quran.searchPlaceholder')}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />

          {isLoading && (
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              {t('quran.loading')}
            </p>
          )}
          {isError && errorMessage && (
            <p className="text-sm text-destructive" role="alert">
              {t('quran.error', { message: errorMessage })}
            </p>
          )}
          {!isLoading && !isError && debounced.length >= 2 && surahs.length === 0 && (
            <p className="text-sm text-muted-foreground" role="status">
              {t('quran.noResults')}
            </p>
          )}

          <ul
            aria-label={t('quran.title')}
            className="divide-y divide-border overflow-hidden rounded-lg border"
          >
            {surahs.map((s) => {
              const name = locale === 'id' ? s.name_id : s.name_en;
              return (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
                >
                  <Link to={`/quran/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gold-500/10 text-sm font-semibold tabular-nums text-gold-700 ring-1 ring-gold-500/20">
                      {s.id}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {s.id}. {s.name_transliteration} — {name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {t('quran.ayahs', { count: s.ayah_count })} •{' '}
                        {s.revelation_type === 'Meccan'
                          ? t('quran.revealedMeccan')
                          : t('quran.revealedMedinan')}
                      </span>
                    </span>
                  </Link>
                  <span
                    dir="rtl"
                    lang="ar"
                    className="shrink-0 font-arabic text-lg leading-none text-ink-800 dark:text-ink-100"
                  >
                    {s.name_ar}
                  </span>
                </li>
              );
            })}
          </ul>

          {!isLoading && surahs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t('quran.continuousHint', { count: surahs.length })} • {surahs.length} / 114
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
