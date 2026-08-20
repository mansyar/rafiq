import { convertFileSrc, invoke } from '@tauri-apps/api/core';

import { isTauri } from './tauri';

// ── Types mirrored from Rust ──────────────────────────────────────────────

export interface ReciterInfo {
  name: string;
  edition: string;
}

export interface CachedFile {
  global_ayah: number;
  file_path: string;
}

export interface RecitationState {
  surah_id: number;
  ayah_count: number;
  first_global_ayah: number;
  cached: CachedFile[];
  last_played_ayah: number | null;
  reciter: ReciterInfo;
}

export interface CachedAudio {
  global_ayah: number;
  file_path: string;
  size_bytes: number;
  fetched_at: string;
}

// ── Tauri invoke wrappers ─────────────────────────────────────────────────

export async function getRecitationState(surahId: number): Promise<RecitationState> {
  return invoke<RecitationState>('get_recitation_state', { surahId });
}

export async function fetchAyahAudio(globalAyah: number): Promise<CachedAudio> {
  return invoke<CachedAudio>('fetch_ayah_audio', { globalAyah });
}

export async function reportPlayedPosition(surahId: number, ayah: number): Promise<void> {
  await invoke('report_played_position', { surahId, ayah });
}

// ── Local file URL helper ─────────────────────────────────────────────────

/**
 * Converts a cached MP3's absolute file path to a URL playable by `<audio>`
 * (Tauri asset protocol). Identity in a plain browser (e.g. `pnpm dev` in a
 * browser tab).
 */
export function localAudioUrl(filePath: string): string {
  if (!isTauri()) {
    return filePath;
  }
  return convertFileSrc(filePath);
}

// ── Player state machine (logic-bearing, unit-tested) ─────────────────────

/** Bounded lookahead window (NFR-2): uncached ayahs fetched ahead of the
 *  currently playing one. */
export const AHEAD = 3;

export type PlayerStatus = 'idle' | 'fetching' | 'playing' | 'paused';

export interface PlayerPosition {
  surahId: number;
  ayah: number;
  global: number;
}

export interface PlayerState {
  status: PlayerStatus;
  current: PlayerPosition | null;
  pendingGlobals: number[];
  fetchingTarget: boolean;
  error: string | null;
}

export type PlayerEvent =
  | {
      type: 'requestPlay';
      position: PlayerPosition;
      cachedGlobals: number[];
      surahEndGlobal: number;
    }
  | { type: 'advance'; position: PlayerPosition; cachedGlobals: number[]; surahEndGlobal: number }
  | { type: 'fetchSucceeded'; global: number }
  | { type: 'fetchFailed'; global: number; error: string }
  | { type: 'retry'; cachedGlobals: number[]; surahEndGlobal: number }
  | { type: 'audioStarted' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' };

export function initialPlayerState(): PlayerState {
  return {
    status: 'idle',
    current: null,
    pendingGlobals: [],
    fetchingTarget: false,
    error: null,
  };
}

/**
 * The next uncached global ayahs to fetch ahead of `position`: at most `AHEAD`
 * ascending globals, never past the surah's end.
 */
export function computeLookahead(
  position: PlayerPosition,
  surahEndGlobal: number,
  cachedGlobals: readonly number[],
): number[] {
  const cached = new Set(cachedGlobals);
  const end = Math.min(position.global + AHEAD, surahEndGlobal);
  const pending: number[] = [];
  for (let global = position.global + 1; global <= end; global += 1) {
    if (!cached.has(global)) {
      pending.push(global);
    }
  }
  return pending;
}

/**
 * Starts playback at `position`, fetching first if uncached. The lookahead
 * window is (re)planned from `position`.
 */
function startPlayback(
  position: PlayerPosition,
  cachedGlobals: readonly number[],
  surahEndGlobal: number,
): PlayerState {
  const needsFetch = !new Set(cachedGlobals).has(position.global);
  return {
    status: needsFetch ? 'fetching' : 'playing',
    current: position,
    pendingGlobals: computeLookahead(position, surahEndGlobal, cachedGlobals),
    fetchingTarget: needsFetch,
    error: null,
  };
}

/**
 * Advances the highlight to `position`. The existing pending plan is kept
 * (only played globals drop out); when it has drained, the window is
 * re-planned from the new position so lookahead continues (FR-2.2).
 */
function advancePlayback(
  state: PlayerState,
  position: PlayerPosition,
  cachedGlobals: readonly number[],
  surahEndGlobal: number,
): PlayerState {
  const needsFetch = !new Set(cachedGlobals).has(position.global);
  const pruned = state.pendingGlobals.filter((g) => g > position.global);
  const pendingGlobals =
    pruned.length > 0 ? pruned : computeLookahead(position, surahEndGlobal, cachedGlobals);
  return {
    status: needsFetch ? 'fetching' : 'playing',
    current: position,
    pendingGlobals,
    fetchingTarget: needsFetch,
    error: null,
  };
}

export function playerReducer(state: PlayerState, event: PlayerEvent): PlayerState {
  switch (event.type) {
    case 'requestPlay':
      return startPlayback(event.position, event.cachedGlobals, event.surahEndGlobal);
    case 'advance':
      return advancePlayback(state, event.position, event.cachedGlobals, event.surahEndGlobal);
    case 'fetchSucceeded': {
      const isTarget = state.fetchingTarget && state.current?.global === event.global;
      return {
        ...state,
        pendingGlobals: state.pendingGlobals.filter((g) => g !== event.global),
        status: isTarget ? 'playing' : state.status,
        fetchingTarget: isTarget ? false : state.fetchingTarget,
      };
    }
    case 'fetchFailed': {
      const isTarget = state.fetchingTarget && state.current?.global === event.global;
      return {
        ...state,
        pendingGlobals: state.pendingGlobals.filter((g) => g !== event.global),
        error: isTarget ? event.error : state.error,
      };
    }
    case 'retry':
      if (!state.current) {
        return state;
      }
      return {
        ...state,
        status: 'fetching',
        fetchingTarget: true,
        error: null,
        pendingGlobals: computeLookahead(state.current, event.surahEndGlobal, event.cachedGlobals),
      };
    case 'audioStarted':
      return state.current ? { ...state, status: 'playing', fetchingTarget: false } : state;
    case 'pause':
      return state.status === 'playing' ? { ...state, status: 'paused' } : state;
    case 'resume':
      return state.status === 'paused' ? { ...state, status: 'playing' } : state;
    case 'stop':
      return initialPlayerState();
  }
}

/**
 * The ayah whose playback this event actually started, if any — the position
 * to persist as last-played (FR-4.1). Fetch activity and requested-but-unplayed
 * ayahs do not persist.
 */
export function persistencePosition(state: PlayerState, event: PlayerEvent): PlayerPosition | null {
  if (event.type === 'audioStarted') {
    return state.current;
  }
  if (event.type === 'advance') {
    return event.position;
  }
  return null;
}
