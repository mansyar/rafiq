import type { PlaybackSpeed, RepeatMode } from './recitation';

import { SPEED_PRESETS } from './recitation';
import { getSetting, setSetting } from './tauri';

// FR-1: playback preferences survive restarts via the settings store.
export const PLAYBACK_SPEED_KEY = 'recitation_speed';
export const REPEAT_MODE_KEY = 'recitation_repeat_mode';
export const AUTO_ADVANCE_KEY = 'recitation_auto_advance';

const SPEED_DEFAULT: PlaybackSpeed = 1;

/** Parses a stored speed string, falling back to 1x on anything invalid. */
export function parsePlaybackSpeed(raw: string | null): PlaybackSpeed {
  if (raw === null) return SPEED_DEFAULT;
  const parsed = Number(raw);
  return (SPEED_PRESETS as readonly number[]).includes(parsed)
    ? (parsed as PlaybackSpeed)
    : SPEED_DEFAULT;
}

/** Parses a stored repeat mode, falling back to off on anything invalid. */
export function parseRepeatMode(raw: string | null): RepeatMode {
  return raw === 'ayah' || raw === 'surah' ? raw : 'off';
}

/** Parses a stored boolean, falling back to false on anything invalid. */
export function parseAutoAdvance(raw: string | null): boolean {
  return raw === 'true';
}

export interface PlaybackPrefs {
  speed: PlaybackSpeed;
  repeatMode: RepeatMode;
  autoAdvance: boolean;
}

/** Loads all playback preferences, applying defaults for missing/corrupt values. */
export async function loadPlaybackPrefs(): Promise<PlaybackPrefs> {
  const [speedRaw, modeRaw, advanceRaw] = await Promise.all([
    getSetting(PLAYBACK_SPEED_KEY),
    getSetting(REPEAT_MODE_KEY),
    getSetting(AUTO_ADVANCE_KEY),
  ]);
  return {
    speed: parsePlaybackSpeed(speedRaw),
    repeatMode: parseRepeatMode(modeRaw),
    autoAdvance: parseAutoAdvance(advanceRaw),
  };
}

export function savePlaybackSpeed(speed: PlaybackSpeed): Promise<void> {
  return setSetting(PLAYBACK_SPEED_KEY, String(speed));
}

export function saveRepeatMode(mode: RepeatMode): Promise<void> {
  return setSetting(REPEAT_MODE_KEY, mode);
}

export function saveAutoAdvance(enabled: boolean): Promise<void> {
  return setSetting(AUTO_ADVANCE_KEY, String(enabled));
}
