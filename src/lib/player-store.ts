import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';
import type {
  CachedFile,
  PlayerEvent,
  PlayerPosition,
  PlayerState,
  RecitationState,
} from './recitation';
import {
  fetchAyahAudio,
  getRecitationState,
  localAudioUrl,
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
  /** Starts (or restarts) playback at `ayah` of `surahId` (FR-3.1/FR-3.2). */
  play: (surahId: number, ayah: number) => Promise<void>;
  /** Advances to the next ayah; stops at the end of the surah (FR-3.5). */
  advance: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  /** Re-attempts a failed download (FR-5.2). */
  retry: () => void;
  /** Called from the `<audio>` element's `play` event. */
  audioStarted: () => void;
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

  return {
    status: 'idle',
    current: null,
    pendingGlobals: [],
    fetchingTarget: false,
    error: null,
    audioUrl: null,
    cachedFiles: [],
    surahEndGlobal: null,

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
      set({ audioUrl: null });
      dispatch({ type: 'stop' });
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
