import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';
import {
  loadPlaybackPrefs,
  saveAutoAdvance,
  savePlaybackSpeed,
  saveRepeatMode,
} from './playback-prefs';
import type {
  CachedFile,
  NextSurahInfo,
  PlaybackSpeed,
  PlayerEvent,
  PlayerPosition,
  PlayerState,
  RecitationState,
  RepeatMode,
} from './recitation';
import {
  fetchAyahAudio,
  getRecitationState,
  localAudioUrl,
  nextSpeed,
  persistencePosition,
  playerReducer,
  reportPlayedPosition,
} from './recitation';

/**
 * Recitation player store: owns the pure player state machine
 * (`playerReducer`) plus the glue to the Tauri commands (fetch, persist).
 * The `<audio>` element itself lives in the reader component.
 */
interface RecitationPlayerStore extends PlayerState {
  /** URL of the file loaded in `<audio>`; `null` while nothing is ready. */
  audioUrl: string | null;
  /** Cached files known to exist (grows as fetches succeed). */
  cachedFiles: CachedFile[];
  /** Last global ayah of the active surah; `null` when idle. */
  surahEndGlobal: number | null;
  /** First global ayah of the active surah; `null` when idle. */
  surahStartGlobal: number | null;
  /**
   * Surah id the machine auto-advanced into at a boundary (FR-4). The reader
   * consumes this to follow playback across surahs. Cleared on stop/play.
   */
  pendingAutoNav: number | null;
  /** Starts (or restarts) playback at `ayah` of `surahId` (FR-3.1/FR-3.2). */
  play: (surahId: number, ayah: number) => Promise<void>;
  /** Advances to the next ayah; stops at the end of the surah (FR-3.5). */
  advance: () => void;
  /** Routes the `<audio>` `ended` event through repeat/auto-advance semantics (FR-3/FR-4). */
  handleEnded: () => void;
  /** Clears `pendingAutoNav` once the reader has followed playback. */
  consumeAutoNav: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  /** Re-attempts a failed download (FR-5.2). */
  retry: () => void;
  /** Called from the `<audio>` element's `play` event. */
  audioStarted: () => void;
  /** Cycles/sets the playback-rate preset (FR-2). */
  setSpeed: (speed: PlaybackSpeed) => void;
  /** Switches repeat mode (FR-3). */
  setRepeatMode: (mode: RepeatMode) => void;
  /** Toggles continue-to-next-surah (FR-4). */
  setAutoAdvance: (enabled: boolean) => void;
  /** Steps through the speed presets, wrapping 2x → 0.75x (FR-2). */
  cycleSpeed: () => void;
  /** Flips the continue-to-next-surah toggle (FR-4). */
  toggleAutoAdvance: () => void;
}

export const useRecitationPlayer = create<RecitationPlayerStore>((set, get) => {
  const inFlight = new Set<number>();

  const cachedGlobals = (): number[] => get().cachedFiles.map((c) => c.global_ayah);

  const dispatch = (event: PlayerEvent) => {
    const prev: PlayerState = {
      status: get().status,
      current: get().current,
      pendingGlobals: get().pendingGlobals,
      fetchingTarget: get().fetchingTarget,
      error: get().error,
      speed: get().speed,
      repeatMode: get().repeatMode,
      autoAdvance: get().autoAdvance,
      replayToken: get().replayToken,
    };
    const next = playerReducer(prev, event);
    const position = persistencePosition(next, event);
    if (position) {
      void reportPlayedPosition(position.surahId, position.ayah).catch(() => {});
    }
    set({ ...next });
  };

  const startFetch = (global: number) => {
    if (inFlight.has(global)) {
      return;
    }
    inFlight.add(global);
    void fetchAyahAudio(global)
      .then((audio) => {
        const entry: CachedFile = {
          global_ayah: audio.global_ayah,
          file_path: audio.file_path,
        };
        set((s) => ({
          cachedFiles: s.cachedFiles.some((c) => c.global_ayah === global)
            ? s.cachedFiles
            : [...s.cachedFiles, entry].sort((a, b) => a.global_ayah - b.global_ayah),
          // Target ready → hand the file to <audio>; playback starts on canplay/play.
          audioUrl:
            get().current?.global === global && get().audioUrl === null
              ? localAudioUrl(audio.file_path)
              : get().audioUrl,
        }));
        dispatch({ type: 'fetchSucceeded', global });
      })
      .catch((e: unknown) => {
        dispatch({
          type: 'fetchFailed',
          global,
          error: e instanceof Error ? e.message : String(e),
        });
      })
      .finally(() => {
        inFlight.delete(global);
      });
  };

  const fetchPending = () => {
    for (const global of get().pendingGlobals) {
      startFetch(global);
    }
  };

  // FR-1: restore persisted playback preferences once at startup.
  // Failures (e.g. no Tauri runtime) silently keep the defaults.
  void loadPlaybackPrefs()
    .then((prefs) => {
      set(prefs);
    })
    .catch(() => {});

  return {
    status: 'idle',
    current: null,
    pendingGlobals: [],
    fetchingTarget: false,
    error: null,
    speed: 1,
    repeatMode: 'off',
    autoAdvance: false,
    replayToken: 0,
    audioUrl: null,
    cachedFiles: [],
    surahEndGlobal: null,
    surahStartGlobal: null,
    pendingAutoNav: null,

    play: async (surahId: number, ayah: number) => {
      const rs = await getRecitationState(surahId);
      const position: PlayerPosition = {
        surahId,
        ayah,
        global: rs.first_global_ayah + ayah - 1,
      };
      const surahEndGlobal = rs.first_global_ayah + rs.ayah_count - 1;
      const cachedTarget = rs.cached.find((c) => c.global_ayah === position.global);
      set({
        cachedFiles: rs.cached,
        surahEndGlobal,
        surahStartGlobal: rs.first_global_ayah,
        pendingAutoNav: null,
        audioUrl: cachedTarget ? localAudioUrl(cachedTarget.file_path) : null,
      });
      const cachedGlobals = rs.cached.map((c) => c.global_ayah);
      dispatch({ type: 'requestPlay', position, cachedGlobals, surahEndGlobal });
      if (!cachedGlobals.includes(position.global)) {
        startFetch(position.global);
      }
      fetchPending();
    },

    advance: () => {
      const { current, surahEndGlobal } = get();
      if (!current || surahEndGlobal === null) {
        dispatch({ type: 'stop' });
        return;
      }
      if (current.global >= surahEndGlobal) {
        // FR-3.5: end of surah → stop; no auto-advance in v1.
        dispatch({ type: 'stop' });
        return;
      }
      const position: PlayerPosition = {
        surahId: current.surahId,
        ayah: current.ayah + 1,
        global: current.global + 1,
      };
      const globals = cachedGlobals();
      const nextFile = get().cachedFiles.find((c) => c.global_ayah === position.global);
      set({ audioUrl: nextFile ? localAudioUrl(nextFile.file_path) : null });
      dispatch({ type: 'advance', position, cachedGlobals: globals, surahEndGlobal });
      if (!globals.includes(position.global)) {
        startFetch(position.global);
      }
      fetchPending();
    },

    pause: () => {
      dispatch({ type: 'pause' });
    },

    resume: () => {
      dispatch({ type: 'resume' });
    },

    stop: () => {
      set({ audioUrl: null, pendingAutoNav: null });
      dispatch({ type: 'stop' });
    },

    handleEnded: () => {
      const prev = get();
      if (!prev.current || prev.surahEndGlobal === null || prev.surahStartGlobal === null) {
        // Nothing active or incomplete context — fall back to plain advance.
        prev.advance();
        return;
      }
      const atBoundary = prev.current.global >= prev.surahEndGlobal;

      // Mid-surah: repeat-ayah replays; everything else advances normally.
      if (!atBoundary && prev.repeatMode !== 'ayah') {
        prev.advance();
        return;
      }

      // Cross-surah continuation needs the next surah's metadata (bounds +
      // cache list), which lives behind an async local-DB lookup (NFR-2: no
      // new network calls). The reducer guard makes a late dispatch safe even
      // if the user stops playback while we await.
      const needsNext =
        atBoundary && prev.repeatMode === 'off' && prev.autoAdvance && prev.current.surahId < 114;

      void (async () => {
        let nextSurah: NextSurahInfo | null = null;
        const fromSurah = prev.current?.surahId;
        const fromGlobal = prev.current?.global;
        if (needsNext && fromSurah !== undefined) {
          try {
            const rs = await getRecitationState(fromSurah + 1);
            nextSurah = {
              id: rs.surah_id,
              firstGlobal: rs.first_global_ayah,
              endGlobal: rs.first_global_ayah + rs.ayah_count - 1,
            };
          } catch {
            nextSurah = null; // degrade to hard stop below
          }
        }
        const live = get().current;
        if (!live || live.surahId !== fromSurah || live.global !== fromGlobal) {
          return; // stopped, replayed, or moved elsewhere while we awaited
        }
        dispatch({
          type: 'ended',
          cachedGlobals: cachedGlobals(),
          surahStartGlobal: prev.surahStartGlobal ?? 0,
          surahEndGlobal: prev.surahEndGlobal ?? 0,
          nextSurah,
        });
        const now = get();
        if (now.status === 'idle') {
          set({ audioUrl: null }); // clean/hard stop — <audio> goes quiet
          return;
        }
        if (!now.current || now.current.global === fromGlobal) {
          return; // in-place ayah replay: <audio> restarts via replayToken
        }
        // Position changed (wrap or cross-surah): hand the right file over.
        const target = now.current;
        const f = now.cachedFiles.find((c) => c.global_ayah === target.global);
        set({
          audioUrl: f ? localAudioUrl(f.file_path) : null,
          pendingAutoNav:
            fromSurah !== undefined && fromSurah !== target.surahId ? target.surahId : null,
        });
        if (!f) {
          startFetch(target.global);
        }
        fetchPending();
      })();
    },

    consumeAutoNav: () => {
      set({ pendingAutoNav: null });
    },

    retry: () => {
      const { current, surahEndGlobal } = get();
      if (!current || surahEndGlobal === null) {
        return;
      }
      const globals = cachedGlobals();
      dispatch({ type: 'retry', cachedGlobals: globals, surahEndGlobal });
      if (!globals.includes(current.global)) {
        startFetch(current.global);
      }
      fetchPending();
    },

    audioStarted: () => {
      dispatch({ type: 'audioStarted' });
    },

    setSpeed: (speed) => {
      dispatch({ type: 'setSpeed', speed });
      void savePlaybackSpeed(speed);
    },

    setRepeatMode: (mode) => {
      dispatch({ type: 'setRepeatMode', mode });
      void saveRepeatMode(mode);
    },

    setAutoAdvance: (enabled) => {
      dispatch({ type: 'setAutoAdvance', enabled });
      void saveAutoAdvance(enabled);
    },

    cycleSpeed: () => {
      get().setSpeed(nextSpeed(get().speed));
    },

    toggleAutoAdvance: () => {
      get().setAutoAdvance(!get().autoAdvance);
    },
  };
});

/** Recitation state for one surah (reciter identity, last played, cache). */
export function useRecitationState(surahId: number): {
  data: RecitationState | undefined;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: ['recitation-state', surahId],
    queryFn: () => getRecitationState(surahId),
  });
  return { data: query.data, isLoading: query.isLoading };
}
