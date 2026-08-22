import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AUTO_ADVANCE_KEY,
  loadPlaybackPrefs,
  PLAYBACK_SPEED_KEY,
  parseAutoAdvance,
  parsePlaybackSpeed,
  parseRepeatMode,
  REPEAT_MODE_KEY,
  saveAutoAdvance,
  savePlaybackSpeed,
  saveRepeatMode,
} from './playback-prefs';

vi.mock('./tauri', () => ({
  getSetting: (...args: unknown[]) => getSettingMock(...args),
  setSetting: (...args: unknown[]) => setSettingMock(...args),
}));

const getSettingMock = vi.fn();
const setSettingMock = vi.fn();

// ── parsePlaybackSpeed (FR-1) ───────────────────────────────────────────────

describe('parsePlaybackSpeed', () => {
  it('accepts every preset string', () => {
    expect(parsePlaybackSpeed('0.75')).toBe(0.75);
    expect(parsePlaybackSpeed('1')).toBe(1);
    expect(parsePlaybackSpeed('1.25')).toBe(1.25);
    expect(parsePlaybackSpeed('1.5')).toBe(1.5);
    expect(parsePlaybackSpeed('2')).toBe(2);
  });

  it.each([null, '', 'fast', '3', '0', '1,25'])('falls back to 1x for corrupt value %j', (raw) => {
    expect(parsePlaybackSpeed(raw)).toBe(1);
  });
});

// ── parseRepeatMode / parseAutoAdvance (FR-1) ───────────────────────────────

describe('parseRepeatMode', () => {
  it('accepts the three modes', () => {
    expect(parseRepeatMode('off')).toBe('off');
    expect(parseRepeatMode('ayah')).toBe('ayah');
    expect(parseRepeatMode('surah')).toBe('surah');
  });

  it.each([null, '', 'loop', 'AYAH'])('falls back to off for corrupt value %j', (raw) => {
    expect(parseRepeatMode(raw)).toBe('off');
  });
});

describe('parseAutoAdvance', () => {
  it('accepts true/false strings', () => {
    expect(parseAutoAdvance('true')).toBe(true);
    expect(parseAutoAdvance('false')).toBe(false);
  });

  it.each([null, '', '1', 'yes'])('falls back to false for corrupt value %j', (raw) => {
    expect(parseAutoAdvance(raw)).toBe(false);
  });
});

// ── Load/save wiring locks the setting keys (FR-1) ──────────────────────────

describe('loadPlaybackPrefs', () => {
  beforeEach(() => {
    getSettingMock.mockReset();
  });

  it('reads the three keys and parses them', async () => {
    getSettingMock.mockImplementation((key: string) =>
      Promise.resolve(
        { [PLAYBACK_SPEED_KEY]: '1.5', [REPEAT_MODE_KEY]: 'ayah', [AUTO_ADVANCE_KEY]: 'true' }[
          key
        ] ?? null,
      ),
    );
    await expect(loadPlaybackPrefs()).resolves.toEqual({
      speed: 1.5,
      repeatMode: 'ayah',
      autoAdvance: true,
    });
    expect(getSettingMock).toHaveBeenCalledWith(PLAYBACK_SPEED_KEY);
    expect(getSettingMock).toHaveBeenCalledWith(REPEAT_MODE_KEY);
    expect(getSettingMock).toHaveBeenCalledWith(AUTO_ADVANCE_KEY);
  });

  it('falls back to defaults when nothing is stored', async () => {
    getSettingMock.mockResolvedValue(null);
    await expect(loadPlaybackPrefs()).resolves.toEqual({
      speed: 1,
      repeatMode: 'off',
      autoAdvance: false,
    });
  });
});

describe('save helpers', () => {
  beforeEach(() => {
    setSettingMock.mockReset();
    setSettingMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('writes the speed as its string form under the speed key', async () => {
    await savePlaybackSpeed(1.25);
    expect(setSettingMock).toHaveBeenCalledWith(PLAYBACK_SPEED_KEY, '1.25');
  });

  it('writes the repeat mode verbatim under its key', async () => {
    await saveRepeatMode('surah');
    expect(setSettingMock).toHaveBeenCalledWith(REPEAT_MODE_KEY, 'surah');
  });

  it('writes auto-advance as true/false under its key', async () => {
    await saveAutoAdvance(true);
    expect(setSettingMock).toHaveBeenCalledWith(AUTO_ADVANCE_KEY, 'true');
    await saveAutoAdvance(false);
    expect(setSettingMock).toHaveBeenCalledWith(AUTO_ADVANCE_KEY, 'false');
  });
});
