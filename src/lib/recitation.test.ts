import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AHEAD,
  computeLookahead,
  initialPlayerState,
  type PlayerEvent,
  type PlayerPosition,
  persistencePosition,
  playerReducer,
} from './recitation';

// ── Fixtures ────────────────────────────────────────────────────────────────

const pos = (surahId: number, ayah: number, first = 1): PlayerPosition => ({
  surahId,
  ayah,
  global: first + ayah - 1,
});

const cached = (...globals: number[]): number[] => [...globals];

/** Surah 2 (Al-Baqarah): starts at global 8, 286 ayahs → ends at 293. */
const SURAH2_START = 8;
const SURAH2_END = 293;

const requestPlay = (
  position: PlayerPosition,
  cachedGlobals: number[],
  surahEndGlobal: number,
): PlayerEvent => ({ type: 'requestPlay', position, cachedGlobals, surahEndGlobal });

// ── Initial state ────────────────────────────────────────────────────────────

describe('initialPlayerState', () => {
  it('is idle with nothing playing and no error', () => {
    expect(initialPlayerState()).toEqual({
      status: 'idle',
      current: null,
      pendingGlobals: [],
      fetchingTarget: false,
      error: null,
    });
  });
});

// ── Lookahead window (NFR-2: bounded) ───────────────────────────────────────

describe('computeLookahead', () => {
  it('requests up to AHEAD ayahs ahead, ascending', () => {
    expect(computeLookahead(pos(2, 1, SURAH2_START), SURAH2_END, cached())).toEqual([
      SURAH2_START + 1,
      SURAH2_START + 2,
      SURAH2_START + 3,
    ]);
    expect(AHEAD).toBeGreaterThanOrEqual(2);
  });

  it('is bounded by the surah end', () => {
    // Current = global 292 (ayah 285), only one ayah left in the surah.
    expect(computeLookahead(pos(2, 285, SURAH2_START), SURAH2_END, cached())).toEqual([293]);
  });

  it('is empty at the last ayah of the surah', () => {
    expect(computeLookahead(pos(2, 286, SURAH2_START), SURAH2_END, cached())).toEqual([]);
  });

  it('skips already-cached ayahs', () => {
    expect(computeLookahead(pos(2, 1, SURAH2_START), SURAH2_END, cached(9, 11))).toEqual([10]);
  });
});

// ── Player state machine ─────────────────────────────────────────────────────

describe('playerReducer', () => {
  it('requestPlay with a cached target goes straight to playing', () => {
    const state = playerReducer(
      initialPlayerState(),
      requestPlay(pos(2, 1, SURAH2_START), cached(8), SURAH2_END),
    );
    expect(state.status).toBe('playing');
    expect(state.fetchingTarget).toBe(false);
    expect(state.current).toEqual(pos(2, 1, SURAH2_START));
    expect(state.pendingGlobals).toEqual([9, 10, 11]);
    expect(state.error).toBeNull();
  });

  it('requestPlay with an uncached target fetches first', () => {
    const state = playerReducer(
      initialPlayerState(),
      requestPlay(pos(2, 1, SURAH2_START), cached(), SURAH2_END),
    );
    expect(state.status).toBe('fetching');
    expect(state.fetchingTarget).toBe(true);
    expect(state.pendingGlobals).toEqual([9, 10, 11]);
  });

  it('fetchSucceeded for the target starts playback', () => {
    const fetching = playerReducer(
      initialPlayerState(),
      requestPlay(pos(2, 1, SURAH2_START), cached(), SURAH2_END),
    );
    const playing = playerReducer(fetching, { type: 'fetchSucceeded', global: 8 });
    expect(playing.status).toBe('playing');
    expect(playing.fetchingTarget).toBe(false);
    expect(playing.pendingGlobals).toEqual([9, 10, 11]);
  });

  it('fetchSucceeded for a lookahead ayah does not change status', () => {
    const fetching = playerReducer(
      initialPlayerState(),
      requestPlay(pos(2, 1, SURAH2_START), cached(), SURAH2_END),
    );
    const next = playerReducer(fetching, { type: 'fetchSucceeded', global: 10 });
    expect(next.status).toBe('fetching');
    expect(next.pendingGlobals).toEqual([9, 11]);
    expect(next.error).toBeNull();
  });

  it('fetchFailed for the target keeps a calm error for retry', () => {
    const fetching = playerReducer(
      initialPlayerState(),
      requestPlay(pos(2, 1, SURAH2_START), cached(), SURAH2_END),
    );
    const failed = playerReducer(fetching, { type: 'fetchFailed', global: 8, error: 'no network' });
    expect(failed.status).toBe('fetching');
    expect(failed.error).toBe('no network');
  });

  it('fetchFailed for a lookahead ayah is silent', () => {
    const fetching = playerReducer(
      initialPlayerState(),
      requestPlay(pos(2, 1, SURAH2_START), cached(), SURAH2_END),
    );
    const failed = playerReducer(fetching, {
      type: 'fetchFailed',
      global: 11,
      error: 'no network',
    });
    expect(failed.error).toBeNull();
    expect(failed.status).toBe('fetching');
    expect(failed.pendingGlobals).toEqual([9, 10]);
  });

  it('retry clears the error and re-requests the target', () => {
    const fetching = playerReducer(
      initialPlayerState(),
      requestPlay(pos(2, 1, SURAH2_START), cached(), SURAH2_END),
    );
    const failed = playerReducer(fetching, { type: 'fetchFailed', global: 8, error: 'no network' });
    const retrying = playerReducer(failed, {
      type: 'retry',
      cachedGlobals: cached(),
      surahEndGlobal: SURAH2_END,
    });
    expect(retrying.error).toBeNull();
    expect(retrying.status).toBe('fetching');
    expect(retrying.fetchingTarget).toBe(true);
  });

  it('audioStarted confirms playback is actually going', () => {
    const fetching = playerReducer(
      initialPlayerState(),
      requestPlay(pos(2, 1, SURAH2_START), cached(8), SURAH2_END),
    );
    const playing = playerReducer(fetching, { type: 'audioStarted' });
    expect(playing.status).toBe('playing');
  });

  it('advance moves the highlight and re-plans the lookahead (cached next)', () => {
    let state = playerReducer(
      initialPlayerState(),
      requestPlay(pos(2, 1, SURAH2_START), cached(8, 9), SURAH2_END),
    );
    state = playerReducer(state, {
      type: 'advance',
      position: pos(2, 2, SURAH2_START),
      cachedGlobals: cached(8, 9),
      surahEndGlobal: SURAH2_END,
    });
    expect(state.status).toBe('playing');
    expect(state.current).toEqual(pos(2, 2, SURAH2_START));
    expect(state.pendingGlobals).toEqual([10, 11]);
  });

  it('advance fetches when the next ayah is not cached', () => {
    let state = playerReducer(
      initialPlayerState(),
      requestPlay(pos(2, 1, SURAH2_START), cached(8), SURAH2_END),
    );
    state = playerReducer(state, {
      type: 'advance',
      position: pos(2, 2, SURAH2_START),
      cachedGlobals: cached(8),
      surahEndGlobal: SURAH2_END,
    });
    expect(state.status).toBe('fetching');
    expect(state.fetchingTarget).toBe(true);
  });

  it('pause and resume toggle only from the correct states', () => {
    const state = playerReducer(
      initialPlayerState(),
      requestPlay(pos(2, 1, SURAH2_START), cached(8), SURAH2_END),
    );
    expect(playerReducer(state, { type: 'pause' }).status).toBe('paused');
    expect(playerReducer(state, { type: 'resume' }).status).toBe('playing');
    // No-ops from wrong states
    expect(playerReducer(initialPlayerState(), { type: 'pause' }).status).toBe('idle');
    expect(playerReducer(initialPlayerState(), { type: 'resume' }).status).toBe('idle');
  });

  it('stop resets to idle (FR-3.5: end of surah stops, no auto-advance)', () => {
    let state = playerReducer(
      initialPlayerState(),
      requestPlay(pos(2, 1, SURAH2_START), cached(8), SURAH2_END),
    );
    state = playerReducer(state, { type: 'pause' });
    const stopped = playerReducer(state, { type: 'stop' });
    expect(stopped).toEqual({
      status: 'idle',
      current: null,
      pendingGlobals: [],
      fetchingTarget: false,
      error: null,
    });
  });
});

// ── Position persistence triggers (FR-4.1) ──────────────────────────────────

describe('persistencePosition', () => {
  const playing = () => {
    const state = playerReducer(
      initialPlayerState(),
      requestPlay(pos(2, 1, SURAH2_START), cached(8), SURAH2_END),
    );
    return playerReducer(state, { type: 'audioStarted' });
  };

  it('persists when audio actually starts on an ayah', () => {
    expect(persistencePosition(playing(), { type: 'audioStarted' })).toEqual(
      pos(2, 1, SURAH2_START),
    );
  });

  it('persists on advance to the next ayah', () => {
    const state = playing();
    const event: PlayerEvent = {
      type: 'advance',
      position: pos(2, 2, SURAH2_START),
      cachedGlobals: cached(9),
      surahEndGlobal: SURAH2_END,
    };
    expect(persistencePosition(state, event)).toEqual(pos(2, 2, SURAH2_START));
  });

  it('does not persist mere fetch activity or requested-but-unplayed ayahs', () => {
    const state = playing();
    expect(persistencePosition(state, { type: 'fetchSucceeded', global: 10 })).toBeNull();
    expect(
      persistencePosition(state, requestPlay(pos(2, 3, SURAH2_START), cached(10), SURAH2_END)),
    ).toBeNull();
  });
});

// ── Local file URL helper ────────────────────────────────────────────────────

describe('localAudioUrl', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns the raw path outside the Tauri webview', async () => {
    const outsideTauri = typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window);
    expect(outsideTauri).toBe(true);
    const { localAudioUrl } = await import('./recitation');
    expect(localAudioUrl('C:/Users/x/AppData/rafiq/recitation/8.mp3')).toBe(
      'C:/Users/x/AppData/rafiq/recitation/8.mp3',
    );
  });
});
