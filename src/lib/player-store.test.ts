import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTO_ADVANCE_KEY, PLAYBACK_SPEED_KEY, REPEAT_MODE_KEY } from './playback-prefs';
import { useRecitationPlayer } from './player-store';

vi.mock('./tauri', () => ({
  getSetting: (...args: unknown[]) => getSettingMock(...args),
  setSetting: (...args: unknown[]) => setSettingMock(...args),
}));

const getSettingMock = vi.fn();
const setSettingMock = vi.fn();

/** Fresh module (and thus fresh store) so startup hydration is observable. */
const loadStore = async () => {
  vi.resetModules();
  return await import('./player-store');
};

const settle = async () => {
  await vi.waitFor(() => {
    expect(getSettingMock).toHaveBeenCalled();
  });
};

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
    await settle();
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
