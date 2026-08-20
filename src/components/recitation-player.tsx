import { Pause, Play, Square } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useRecitationPlayer, useRecitationState } from '@/lib/player-store';
import { availabilityForStart } from '@/lib/recitation';
import { cn } from '@/lib/utils';

/**
 * Hidden `<audio>` element driving the recitation player store.
 * Mount once per reader view; pauses itself on unmount (FR-4.2).
 */
export function RecitationAudio() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const status = useRecitationPlayer((s) => s.status);
  const audioUrl = useRecitationPlayer((s) => s.audioUrl);
  const audioStarted = useRecitationPlayer((s) => s.audioStarted);
  const advance = useRecitationPlayer((s) => s.advance);
  const pause = useRecitationPlayer((s) => s.pause);

  // Play when the store says playing and a file is ready; pause on demand.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) {
      return;
    }
    if (status === 'playing' && audioUrl) {
      void el.play().catch(() => {});
    } else if (status === 'paused' && !el.paused) {
      el.pause();
    }
  }, [status, audioUrl]);

  // Leaving the reader pauses playback and keeps the position (FR-4.2).
  useEffect(() => () => pause(), [pause]);

  return (
    <audio
      ref={audioRef}
      src={audioUrl ?? undefined}
      preload="auto"
      style={{ display: 'none' }}
      onPlay={audioStarted}
      onEnded={advance}
      data-testid="recitation-audio"
    >
      <track kind="captions" />
    </audio>
  );
}

/**
 * Transport controls for one surah: play starts from the last-played ayah
 * (or ayah 1), toggles to pause/resume while active, and acts as retry when
 * a download has failed (FR-3.1, FR-5.2, FR-5.3).
 */
function useSurahTransport(surahId: number) {
  const status = useRecitationPlayer((s) => s.status);
  const current = useRecitationPlayer((s) => s.current);
  const play = useRecitationPlayer((s) => s.play);
  const pause = useRecitationPlayer((s) => s.pause);
  const resume = useRecitationPlayer((s) => s.resume);
  const stop = useRecitationPlayer((s) => s.stop);
  const { data: recitation } = useRecitationState(surahId);

  const active = status !== 'idle' && current?.surahId === surahId;
  const playing = active && status === 'playing';
  const startAyah = recitation?.last_played_ayah ?? 1;

  const toggle = () => {
    if (!active || status === 'fetching') {
      // Fresh start, or retry after a failed download.
      void play(surahId, startAyah);
    } else if (status === 'playing') {
      pause();
    } else {
      resume();
    }
  };

  return { active, playing, startAyah, ready: Boolean(recitation), toggle, stop };
}

/** Compact play/pause button for the surah header (FR-3.1). */
export function RecitationPlayButton({ surahId }: { surahId: number }) {
  const { t } = useTranslation();
  const { playing, startAyah, ready, toggle } = useSurahTransport(surahId);

  return (
    <button
      type="button"
      disabled={!ready}
      onClick={toggle}
      aria-label={playing ? t('quran.audio.pause') : t('quran.audio.playFrom', { ayah: startAyah })}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
        'bg-emerald-600 text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50',
      )}
    >
      {playing ? (
        <Pause className="size-3.5" aria-hidden />
      ) : (
        <Play className="size-3.5" aria-hidden />
      )}
      {playing ? t('quran.audio.pause') : t('quran.audio.play')}
    </button>
  );
}

/**
 * Compact player footer inside the reader (FR-3.4): transport, position,
 * download progress / calm retry, reciter name.
 */
export function RecitationFooter({ surahId }: { surahId: number }) {
  const { t } = useTranslation();
  const current = useRecitationPlayer((s) => s.current);
  const status = useRecitationPlayer((s) => s.status);
  const pendingCount = useRecitationPlayer((s) => s.pendingGlobals.length);
  const fetchingTarget = useRecitationPlayer((s) => s.fetchingTarget);
  const error = useRecitationPlayer((s) => s.error);
  const retry = useRecitationPlayer((s) => s.retry);
  const { data: recitation } = useRecitationState(surahId);
  const { active, playing, ready, startAyah, toggle, stop } = useSurahTransport(surahId);
  const availability = availabilityForStart(recitation, startAyah);

  const progress = error
    ? 'error'
    : status === 'fetching' && fetchingTarget
      ? 'downloading'
      : active && pendingCount > 0
        ? 'ahead'
        : 'none';

  return (
    <section
      aria-label={t('quran.audio.player')}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-card px-4 py-3"
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={!ready}
          onClick={toggle}
          aria-label={playing ? t('quran.audio.pause') : t('quran.audio.play')}
          className="rounded-md p-2 text-ink-900 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 dark:text-ink-50"
        >
          {playing ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="size-4" aria-hidden />
          )}
        </button>
        <button
          type="button"
          disabled={!active}
          onClick={stop}
          aria-label={t('quran.audio.stop')}
          className="rounded-md p-2 text-ink-900 transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 dark:text-ink-50"
        >
          <Square className="size-4" aria-hidden />
        </button>
      </div>

      <span aria-live="polite" className="min-w-20 text-sm tabular-nums text-foreground">
        {active && current
          ? t('quran.audio.position', { surah: current.surahId, ayah: current.ayah })
          : availability === 'needs-download'
            ? t('quran.audio.needsDownload')
            : t('quran.audio.idle')}
      </span>

      <span
        role={progress === 'error' ? 'alert' : 'status'}
        className="min-h-4 flex-1 text-xs text-muted-foreground"
      >
        {progress === 'error' && (
          <>
            {t('quran.audio.error')}{' '}
            <button
              type="button"
              onClick={retry}
              className="font-medium text-gold-700 underline-offset-4 hover:underline dark:text-gold-200"
            >
              {t('quran.audio.retry')}
            </button>
          </>
        )}
        {progress === 'downloading' && t('quran.audio.downloading')}
        {progress === 'ahead' && t('quran.audio.downloadingAhead', { count: pendingCount })}
      </span>

      {recitation && (
        <span className="text-xs text-muted-foreground">
          {t('quran.audio.reciter', { name: recitation.reciter.name })}
        </span>
      )}
    </section>
  );
}
