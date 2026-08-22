import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  RecitationAudio,
  RecitationFooter,
  RecitationPlayButton,
} from '@/components/recitation-player';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useRecitationPlayer } from '@/lib/player-store';
import {
  getQuranTranslation,
  getSurah,
  type QuranTranslation,
  setQuranTranslation,
  shouldShowBismillah,
} from '@/lib/quran';
import { cn } from '@/lib/utils';

const TRANSLATIONS: QuranTranslation[] = ['sahih', 'clear', 'kemenag'];

export function QuranReader() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const surahId = Number(id);
  const queryClient = useQueryClient();

  const surahQuery = useQuery({
    queryKey: ['quran-surah', surahId],
    queryFn: () => getSurah(surahId),
    enabled: Number.isInteger(surahId) && surahId >= 1 && surahId <= 114,
  });

  const translationQuery = useQuery({
    queryKey: ['quran-translation'],
    queryFn: getQuranTranslation,
  });

  const translationMutation = useMutation({
    mutationFn: setQuranTranslation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quran-translation'] });
    },
  });

  const translation = translationQuery.data ?? 'sahih';
  const surah = surahQuery.data;

  const playerCurrent = useRecitationPlayer((s) => s.current);
  const playerStatus = useRecitationPlayer((s) => s.status);
  const playerPlay = useRecitationPlayer((s) => s.play);
  const playerActive = playerStatus !== 'idle' && playerCurrent?.surahId === surahId;

  // FR-4: when playback auto-advances across a surah boundary, the reader
  // follows so audio and view stay in sync.
  const navigate = useNavigate();
  const pendingAutoNav = useRecitationPlayer((s) => s.pendingAutoNav);
  const consumeAutoNav = useRecitationPlayer((s) => s.consumeAutoNav);
  useEffect(() => {
    if (pendingAutoNav !== null) {
      navigate(`/quran/${pendingAutoNav}`);
      consumeAutoNav();
    }
  }, [pendingAutoNav, navigate, consumeAutoNav]);

  if (!id || !Number.isInteger(surahId) || surahId < 1 || surahId > 114) {
    return (
      <section className="mx-auto max-w-3xl">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-destructive" role="alert">
              {t('quran.error', { message: `Invalid surah id: ${id}` })}
            </p>
            <Link
              to="/quran"
              className="mt-4 inline-flex text-sm text-gold-700 underline-offset-4 hover:underline"
            >
              ← {t('quran.title')}
            </Link>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section aria-labelledby="quran-reader-title" className="mx-auto max-w-4xl space-y-4">
      {/* Mounted for the whole route so the <audio> element survives the
          cross-surah loading gap during auto-advance (FR-4). */}
      <RecitationAudio surahId={surahId} />

      <div className="flex items-center justify-between">
        <Link
          to="/quran"
          className="inline-flex items-center text-sm font-medium text-gold-700 hover:underline dark:text-gold-200"
        >
          ← {t('quran.title')}
        </Link>
        {surah && (
          <span className="text-xs text-muted-foreground">
            {t('quran.ayahs', { count: surah.ayah_count })} •{' '}
            {surah.revelation_type === 'Meccan'
              ? t('quran.revealedMeccan')
              : t('quran.revealedMedinan')}
          </span>
        )}
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            {surah ? (
              <CardTitle id="quran-reader-title" className="font-heading text-xl">
                {t('quran.readerTitle', {
                  name: surah.name_en,
                  transliteration: surah.name_transliteration,
                })}{' '}
                •{' '}
                <span dir="rtl" lang="ar" className="font-arabic text-2xl">
                  {surah.name_ar}
                </span>
              </CardTitle>
            ) : (
              <CardTitle id="quran-reader-title" className="font-heading text-xl">
                {t('quran.loading')}
              </CardTitle>
            )}
            {surah && <RecitationPlayButton surahId={surah.id} />}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{t('quran.translationLabel')}:</span>
            <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
              {TRANSLATIONS.map((tr) => {
                const active = translation === tr;
                return (
                  <button
                    key={tr}
                    type="button"
                    aria-pressed={active}
                    onClick={() => translationMutation.mutate(tr)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'bg-gold-500 text-white shadow-sm'
                        : 'text-muted-foreground hover:bg-background hover:text-foreground',
                    )}
                  >
                    {t(`quran.translations.${tr}` as const)}
                  </button>
                );
              })}
            </div>
          </div>

          {surahQuery.isLoading && (
            <p className="text-sm text-muted-foreground" role="status">
              {t('quran.loading')}
            </p>
          )}
          {surahQuery.isError && (
            <p className="text-sm text-destructive" role="alert">
              {t('quran.error', { message: String(surahQuery.error) })}
            </p>
          )}
        </CardHeader>

        {surah && (
          <CardContent className="space-y-6">
            {shouldShowBismillah(surah.id) && (
              <>
                <div className="rounded-lg border border-gold-200 bg-gold-50/70 px-4 py-6 text-center dark:border-gold-900 dark:bg-gold-950/20">
                  <p
                    dir="rtl"
                    lang="ar"
                    className="font-arabic text-2xl leading-relaxed tracking-wide text-ink-900 dark:text-ink-50"
                  >
                    {t('quran.bismillah')}
                  </p>
                </div>
                <Separator />
              </>
            )}

            <div className="space-y-5">
              {surah.ayahs.map((ayah) => {
                const translationText =
                  translation === 'clear'
                    ? ayah.clear
                    : translation === 'kemenag'
                      ? ayah.kemenag
                      : ayah.sahih;
                const isCurrent = playerActive && playerCurrent?.ayah === ayah.number;
                const startFromAyah = () => {
                  void playerPlay(surah.id, ayah.number);
                };
                return (
                  <button
                    key={ayah.number}
                    type="button"
                    onClick={startFromAyah}
                    aria-label={
                      isCurrent
                        ? `${t('quran.ayah')} ${ayah.number} — ${t('quran.audio.playingNow')}`
                        : `${t('quran.ayah')} ${ayah.number} — ${t('quran.audio.playFromAyah')}`
                    }
                    className={cn(
                      'w-full cursor-pointer overflow-hidden rounded-lg border bg-card text-left transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500',
                      isCurrent && 'border-gold-500 ring-1 ring-gold-500/40',
                    )}
                  >
                    <div className="grid gap-0 md:grid-cols-2">
                      {/* Arabic — sacred text high-contrast */}
                      <div
                        className={cn(
                          'relative bg-amber-50/20 p-5 dark:bg-ink-900/20 md:border-r',
                          isCurrent && 'bg-gold-50/40 dark:bg-gold-950/20',
                        )}
                      >
                        <p
                          dir="rtl"
                          lang="ar"
                          className="font-arabic text-[1.6rem] leading-loose text-ink-900 dark:text-ink-50"
                          style={{ lineHeight: '2.2' }}
                        >
                          {ayah.arabic}
                          <span className="mr-2 inline-flex size-7 items-center justify-center rounded-full bg-gold-500/15 align-middle text-sm font-sans font-semibold text-gold-700 tabular-nums ring-1 ring-gold-500/20 dark:text-gold-200">
                            {ayah.number}
                          </span>
                        </p>
                      </div>

                      {/* Translation */}
                      <div className="p-5">
                        <p className="text-[0.95rem] leading-relaxed text-ink-800 dark:text-ink-100">
                          {translationText}
                        </p>
                        <p className="mt-2 text-xs tabular-nums text-muted-foreground">
                          {t('quran.ayah')} {ayah.number}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <p className="text-center text-xs text-muted-foreground">
              {t('quran.continuousHint', { count: surah.ayahs.length })}
            </p>
          </CardContent>
        )}
      </Card>

      {surah && <RecitationFooter surahId={surah.id} />}

      {surah && (
        <div className="flex items-center justify-between pt-2">
          {surah.id > 1 ? (
            <Link
              to={`/quran/${surah.id - 1}`}
              className="rounded-md border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              ← {surah.id - 1}
            </Link>
          ) : (
            <span />
          )}
          {surah.id < 114 ? (
            <Link
              to={`/quran/${surah.id + 1}`}
              className="rounded-md border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              {surah.id + 1} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </section>
  );
}
