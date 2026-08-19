import { invoke } from '@tauri-apps/api/core';

/** Returns a stored setting value, or `null` when unset or the backend is unavailable. */
export async function getSetting(key: string): Promise<string | null> {
  try {
    return await invoke<string | null>('get_setting', { key });
  } catch {
    return null;
  }
}

/** Stores a setting value via the Rust backend. */
export async function setSetting(key: string, value: string): Promise<void> {
  await invoke('set_setting', { key, value });
}

/** Loads the persisted locale (falls back to `null` when unset). */
export async function loadPersistedLocale(): Promise<string | null> {
  return getSetting('locale');
}

/** True when running inside the Tauri webview (not a plain browser). */
export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window;
}

/** Updates the native window title when running in Tauri; safe no-op elsewhere. */
export async function setWindowTitle(title: string): Promise<void> {
  if (!isTauri()) {
    return;
  }
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  await getCurrentWindow().setTitle(title);
}
