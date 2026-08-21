import { existsSync } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/** The global ayah mocked by the tiny silent fixture (see `e2e/fixtures/ayah-1.mp3`). */
export const FIXTURE_AYAH = 1;

/** Absolute path to the bundled MP3 fixture. */
export function fixtureSourcePath(): string {
  // CWD is repo root when running `pnpm e2e`; resolve covers both CWDs.
  const candidates = [
    resolve('e2e/fixtures/ayah-1.mp3'),
    resolve('fixtures/ayah-1.mp3'),
    resolve('../e2e/fixtures/ayah-1.mp3'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return resolve('e2e/fixtures/ayah-1.mp3');
}

/**
 * Pre-seed `recitation/1.mp3` into an isolated `TAURI_E2E_APP_DATA_DIR`.
 * When `TAURI_E2E=1` the Rust side also short-circuits `download(1)` to this
 * fixture, so tests pass offline even without calling this helper. Use this
 * helper when a test wants to assert a warm cache without invoking
 * `fetch_ayah_audio`.
 */
export async function seedRecitationFixture(isolatedDir: string): Promise<string> {
  const src = fixtureSourcePath();
  if (!existsSync(src)) {
    throw new Error(`fixture missing at ${src} — run from repo root`);
  }
  const destDir = join(isolatedDir, 'recitation');
  await mkdir(destDir, { recursive: true });
  const dest = join(destDir, `${FIXTURE_AYAH}.mp3`);
  await copyFile(src, dest);
  return dest;
}

/** Gate for the single opt-in real-network CDN test (skipped unless `E2E_REAL_CDN=1`). */
export function shouldRunRealCdn(): boolean {
  return process.env.E2E_REAL_CDN === '1';
}

/** Conditional skip helper for Playwright: `test.skip(!shouldRunRealCdn(), 'E2E_REAL_CDN=1 required')`. */
export function realCdnSkipReason(): string {
  return 'skipped: set E2E_REAL_CDN=1 to hit the live CDN (60s timeout)';
}
