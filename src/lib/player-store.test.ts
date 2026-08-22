import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTO_ADVANCE_KEY, PLAYBACK_SPEED_KEY, REPEAT_MODE_KEY } from './playback-prefs';
import { useRecitationPlayer } from './player-store';
import type { CachedFile, PlayerPosition, RecitationState } from './recitation';

vi.mock('./tauri', () => ({
  getSetting: (...args: unknown[]) => getSettingMock(...args),
  setSetting: (...args: unknown[]) => setSettingMock(...args),
  // Tests run outside Tauri: file URLs pass through unchanged.
  isTauri: () => false,
}));

const getSettingMock = vi.fn();
const setSettingMock = vi.fn();

const getRecitationStateMock = vi.fn();
const fetchAyahAudioMock = vi.fn();

// Partial mock: keep the pure machine intact, intercept only the IO wrappers
// the store glue calls (`handleEnded` looks up the next surah's metadata).
vi.mock('./recitation', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getRecitationState: (...args: unknown[]) => getRecitationStateMock(...args),
  fetchAyahAudio: (...args: unknown[]) => fetchAyahAudioMock(...args),
}));

/** Fresh module (and thus fresh store) so startup hydration is observable. */
const loadStore = async () => {
  vi.resetModules();
  return await import('./player-store');
};

const settleSettings = async () => {
  await vi.waitFor(() => {
    expect(getSettingMock).toHaveBeenCalled();
  });
};

const file = (global: number): CachedFile => ({
  global_ayah: global,
  file_path: `/cache/recitation/${global}.mp3`,
});

const pos = (surahId: number, ayah: number, firstGlobal: number): PlayerPosition => ({
  surahId,
  ayah,
  global: firstGlobal + ayah - 1,
});

// Surah 2 spans globals 8..293 (286 ayahs); Surah 3 starts at 294.
const S2_START = 8;
const S2_END = 293;

const surah3Fixture = (): RecitationState => ({
  surah_id: 3,
  ayah_count: 286,
  first_global_ayah: 294,
  cached: [],
  last_played_ayah: null,
  reciter: { name: 'Mishary Rashid Alafasy', edition: 'ar.alafasy' },
});

describe('playback preference store wiring (FR-1/FR-2)', () => {
  beforeEach(() => {
    getSettingMock.mockReset();
    setSettingMock.mockReset();
    setSettingMock.mockResolvedValue(undefined);
    getSettingMock.mockResolvedValue(null);
    // Deterministic baseline for the shared store instance.
    useRecitationPlayer.setState({
      speed: 1,
      repeatMode: 'off',
      autoAdvance: false,
      status: 'idle',
      current: null,
      pendingGlobals: [],
      fetchingTarget: false,
      error: null,
      audioUrl: null,
      cachedFiles: [],
      surahEndGlobal: null,
      surahStartGlobal: null,
      pendingAutoNav: null,
      replayToken: 0,
    });
  });

  it('hydrates persisted preferences on startup', async () => {
    getSettingMock.mockImplementation((key: string) =>
      Promise.resolve(
        { [PLAYBACK_SPEED_KEY]: '2', [REPEAT_MODE_KEY]: 'surah', [AUTO_ADVANCE_KEY]: 'true' }[
          key
        ] ?? null,
      ),
    );
    const { useRecitationPlayer: fresh } = await loadStore();
    await settleSettings();
    expect(fresh.getState().speed).toBe(2);
    expect(fresh.getState().repeatMode).toBe('surah');
    expect(fresh.getState().autoAdvance).toBe(true);
  });

  it('cycleSpeed advances the preset and writes through', () => {
    useRecitationPlayer.getState().cycleSpeed();
    expect(useRecitationPlayer.getState().speed).toBe(1.25);
    expect(setSettingMock).toHaveBeenCalledWith(PLAYBACK_SPEED_KEY, '1.25');

    // Wrapping past 2x persists the wrapped value too.
    useRecitationPlayer.setState({ speed: 2 });
    useRecitationPlayer.getState().cycleSpeed();
    expect(useRecitationPlayer.getState().speed).toBe(0.75);
    expect(setSettingMock).toHaveBeenCalledWith(PLAYBACK_SPEED_KEY, '0.75');
  });

  it('setRepeatMode updates the mode and writes through', () => {
    useRecitationPlayer.getState().setRepeatMode('ayah');
    expect(useRecitationPlayer.getState().repeatMode).toBe('ayah');
    expect(setSettingMock).toHaveBeenCalledWith(REPEAT_MODE_KEY, 'ayah');
  });

  it('toggleAutoAdvance flips the toggle and writes through both ways', () => {
    useRecitationPlayer.getState().toggleAutoAdvance();
    expect(useRecitationPlayer.getState().autoAdvance).toBe(true);
    expect(setSettingMock).toHaveBeenLastCalledWith(AUTO_ADVANCE_KEY, 'true');

    useRecitationPlayer.getState().toggleAutoAdvance();
    expect(useRecitationPlayer.getState().autoAdvance).toBe(false);
    expect(setSettingMock).toHaveBeenLastCalledWith(AUTO_ADVANCE_KEY, 'false');
  });
});

describe('handleEnded boundary routing (FR-3/FR-4)', () => {
  beforeEach(() => {
    getSettingMock.mockReset();
    setSettingMock.mockReset();
    getRecitationStateMock.mockReset();
    fetchAyahAudioMock.mockReset();
    setSettingMock.mockResolvedValue(undefined);
    getSettingMock.mockResolvedValue(null);
    // Default: every fetch "downloads" a file for its requested global ayah.
    fetchAyahAudioMock.mockImplementation((global: number) =>
      Promise.resolve({ global_ayah: global, file_path: `/cache/recitation/${global}.mp3` }),
    );
    useRecitationPlayer.setState({
      speed: 1,
      repeatMode: 'off',
      autoAdvance: false,
      status: 'playing',
      current: null,
      pendingGlobals: [],
      fetchingTarget: false,
      error: null,
      audioUrl: null,
      cachedFiles: [],
      surahEndGlobal: null,
      surahStartGlobal: null,
      pendingAutoNav: null,
      replayToken: 0,
    });
  });

  it('acts as a plain advance mid-surah when repeat mode is off (FR-3.1)', () => {
    useRecitationPlayer.setState({
      current: pos(2, 285, S2_START),
      surahStartGlobal: S2_START,
      surahEndGlobal: S2_END,
      cachedFiles: [file(293)],
    });

    useRecitationPlayer.getState().handleEnded();

    const s = useRecitationPlayer.getState();
    expect(s.current).toEqual(pos(2, 286, S2_START));
    expect(s.audioUrl).toBe('/cache/recitation/293.mp3');
    expect(fetchAyahAudioMock).not.toHaveBeenCalled(); // 293 already cached
    expect(s.pendingAutoNav).toBeNull();
  });

  it('replays the ayah in place under repeat-ayah, without touching the URL (FR-3)', () => {
    useRecitationPlayer.setState({
      repeatMode: 'ayah',
      current: pos(2, 285, S2_START),
      surahStartGlobal: S2_START,
      surahEndGlobal: S2_END,
      cachedFiles: [file(292)],
      audioUrl: '/cache/recitation/292.mp3',
    });

    useRecitationPlayer.getState().handleEnded();

    const s = useRecitationPlayer.getState();
    expect(s.replayToken).toBe(1);
    expect(s.current).toEqual(pos(2, 285, S2_START));
    expect(s.status).toBe('playing');
    expect(s.audioUrl).toBe('/cache/recitation/292.mp3');
    expect(fetchAyahAudioMock).not.toHaveBeenCalled();
  });

  it('wraps to ayah 1 at the surah boundary under repeat-surah (FR-3)', () => {
    useRecitationPlayer.setState({
      repeatMode: 'surah',
      current: pos(2, 286, S2_START),
      surahStartGlobal: S2_START,
      surahEndGlobal: S2_END,
      cachedFiles: [file(S2_START)],
      audioUrl: '/cache/recitation/293.mp3',
    });

    useRecitationPlayer.getState().handleEnded();

    const s = useRecitationPlayer.getState();
    expect(s.current).toEqual(pos(2, 1, S2_START));
    expect(s.status).toBe('playing'); // target (8) is cached
    expect(s.audioUrl).toBe('/cache/recitation/8.mp3');
    expect(s.pendingGlobals).toEqual([9, 10, 11]);
    expect(fetchAyahAudioMock).toHaveBeenCalledTimes(3); // 9, 10, 11
    expect(s.pendingAutoNav).toBeNull(); // same surah — reader must not move
  });

  it('auto-advances into the next surah and flags the reader to follow (FR-4)', async () => {
    getRecitationStateMock.mockResolvedValue(surah3Fixture());
    // Hang the fetch so the intermediate state is deterministic.
    fetchAyahAudioMock.mockReturnValue(new Promise(() => {}));
    useRecitationPlayer.setState({
      autoAdvance: true,
      current: pos(2, 286, S2_START),
      surahStartGlobal: S2_START,
      surahEndGlobal: S2_END,
      cachedFiles: [file(293)],
    });

    useRecitationPlayer.getState().handleEnded();

    await vi.waitFor(() => {
      expect(getRecitationStateMock).toHaveBeenCalledWith(3);
    });
    const s = useRecitationPlayer.getState();
    expect(s.current).toEqual({ surahId: 3, ayah: 1, global: 294 });
    expect(s.status).toBe('fetching'); // target 294 not yet downloaded
    expect(s.pendingGlobals).toEqual([295, 296, 297]); // bounded by surah 3's end
    expect(fetchAyahAudioMock).toHaveBeenCalledWith(294);
    expect(s.pendingAutoNav).toBe(3); // reader navigates, then consumes
  });

  it('hard-stops after the final surah even with auto-advance on (AC-4)', () => {
    useRecitationPlayer.setState({
      autoAdvance: true,
      speed: 1.5,
      current: pos(114, 7, 6104), // at the boundary: global == surahEndGlobal
      surahStartGlobal: 6104,
      surahEndGlobal: 6110,
      cachedFiles: [],
    });

    useRecitationPlayer.getState().handleEnded();

    const s = useRecitationPlayer.getState();
    expect(s.status).toBe('idle');
    expect(s.current).toBeNull();
    expect(getRecitationStateMock).not.toHaveBeenCalled();
    expect(s.speed).toBe(1.5); // preferences survive the stop
  });

  it('keeps the v1 stop-at-end behavior when mode is off and auto-advance is off', () => {
    useRecitationPlayer.setState({
      current: pos(2, 286, S2_START),
      surahStartGlobal: S2_START,
      surahEndGlobal: S2_END,
      cachedFiles: [file(293)],
      audioUrl: '/cache/recitation/293.mp3',
    });

    useRecitationPlayer.getState().handleEnded();

    const s = useRecitationPlayer.getState();
    expect(s.status).toBe('idle');
    expect(s.current).toBeNull();
    expect(s.audioUrl).toBeNull();
    expect(s.pendingAutoNav).toBeNull();
  });

  it('is a safe no-op when nothing is playing', () => {
    useRecitationPlayer.setState({ status: 'idle', current: null });

    useRecitationPlayer.getState().handleEnded();

    expect(useRecitationPlayer.getState().status).toBe('idle');
    expect(getRecitationStateMock).not.toHaveBeenCalled();
    expect(fetchAyahAudioMock).not.toHaveBeenCalled();
  });

  it('consumeAutoNav clears the pending navigation flag', () => {
    useRecitationPlayer.setState({ pendingAutoNav: 3 });
    useRecitationPlayer.getState().consumeAutoNav();
    expect(useRecitationPlayer.getState().pendingAutoNav).toBeNull();
  });
});
