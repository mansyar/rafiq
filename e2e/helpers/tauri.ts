import type { Page } from '@playwright/test';

export const JAKARTA_CITY_ID = 'jakarta-id-1';
export const JAKARTA_COORDS = {
  latitude: -6.2088,
  longitude: 106.8456,
  timezone: 'Asia/Jakarta',
} as const;

export const VALID_TRANSLATIONS = ['sahih', 'clear', 'kemenag'] as const;
export type ValidTranslation = (typeof VALID_TRANSLATIONS)[number];

function assertNonEmptyString(value: unknown, name: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${name} is required and must be a non-empty string`);
  }
  return value.trim();
}

/**
 * Invoke a Tauri command from a Playwright `Page`.
 *
 * Uses `window.__TAURI__.core.invoke` (Tauri v2) with a fallback to
 * `window.__TAURI__.invoke` for older mocks. Throws when the command is
 * empty or when `__TAURI__` is not ready.
 */
export async function invokeTauri<T = unknown>(
  page: Page,
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const cmd = assertNonEmptyString(command, 'command');
  return page.evaluate(
    async ({ command: c, args: a }) => {
      const w = window as unknown as {
        __TAURI__?: {
          core?: { invoke: (cmd: string, args?: unknown) => Promise<unknown> };
          invoke?: (cmd: string, args?: unknown) => Promise<unknown>;
        };
      };
      const tauri = w.__TAURI__;
      if (!tauri) throw new Error('__TAURI__ not ready — app not booted');
      const invoke = tauri.core?.invoke ?? tauri.invoke;
      if (!invoke) throw new Error('no Tauri invoke found on window.__TAURI__');
      return (await invoke(c, a)) as unknown;
    },
    { command: cmd, args },
  ) as Promise<T>;
}

/** Wait until `window.__TAURI__` is defined (app boot). */
export async function waitForTauriReady(page: Page, timeout = 10_000): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined,
    undefined,
    {
      timeout,
    },
  );
}

/** Persist Jakarta as the prayer location (bundled city id). */
export async function setJakartaLocation(page: Page): Promise<void> {
  await invokeTauri(page, 'set_location', {
    location: { city_id: JAKARTA_CITY_ID, latitude: null, longitude: null },
  });
}

/** Set a manual coordinate location (validates range). */
export async function setManualLocation(
  page: Page,
  latitude: number,
  longitude: number,
): Promise<void> {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error(`invalid latitude ${latitude} — must be -90..90`);
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error(`invalid longitude ${longitude} — must be -180..180`);
  }
  await invokeTauri(page, 'set_location', {
    location: { city_id: null, latitude, longitude },
  });
}

/** Set the Quran translation preference; validates against the 3 known values. */
export async function setTranslation(page: Page, translation: string): Promise<void> {
  const t = assertNonEmptyString(translation, 'translation').toLowerCase();
  if (!(VALID_TRANSLATIONS as readonly string[]).includes(t)) {
    throw new Error(
      `unknown translation "${translation}" — expected one of ${VALID_TRANSLATIONS.join(', ')}`,
    );
  }
  await invokeTauri(page, 'set_quran_translation', { translation: t });
}

/** Generic `get_setting` helper (validates key non-empty). */
export async function getSettingViaInvoke(page: Page, key: string): Promise<string | null> {
  const k = assertNonEmptyString(key, 'key');
  return invokeTauri<string | null>(page, 'get_setting', { key: k });
}

/** Set a generic setting key (validates non-empty). */
export async function setSettingViaInvoke(page: Page, key: string, value: string): Promise<void> {
  const k = assertNonEmptyString(key, 'key');
  if (typeof value !== 'string') throw new Error('value must be a string');
  await invokeTauri(page, 'set_setting', { key: k, value });
}
