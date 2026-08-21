import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { installMockTauri } from './helpers/mock-tauri';

// Real, decodable 0.5 s silent MP3 so headless Chromium actually starts and
// ends playback for every ayah (driving advance/persistence in the store).
const FIXTURE_MP3 = readFileSync(path.join('e2e', 'fixtures', 'silence.mp3'));
// Al-Fatiha globals 1..7 are all served from local fixture paths by the mock.
const MOCK_MP3_URL = /\/tmp\/mock\/recitation\/[1-7]\.mp3$/;

test.describe('Recitation playback (Al-Fatiha fixture)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockTauri(page);
    // The mock's fetch_ayah_audio hands back literal `/tmp/mock/recitation/N.mp3`
    // paths (browser mode keeps paths as-is), so <audio> requests exactly those
    // URLs. Fulfill them with the local fixture — no real CDN involved.
    await page.route(MOCK_MP3_URL, (route) =>
      route.fulfill({ body: FIXTURE_MP3, contentType: 'audio/mpeg' }),
    );
    await page.goto('/onboarding');
    await page.getByRole('button', { name: /skip/i }).click();
    await expect(page).toHaveURL('/');
  });

  /** Counts upstream `fetch_ayah_audio` invocations by wrapping the mock invoke. */
  async function trackFetchCalls(page: Page): Promise<void> {
    await page.evaluate(() => {
      const w = window as unknown as {
        __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: unknown) => Promise<unknown> };
        __FETCH_AYAH_CALLS__?: () => number;
      };
      const internals = w.__TAURI_INTERNALS__;
      if (!internals) {
        throw new Error('mock Tauri not installed');
      }
      const original = internals.invoke;
      let fetches = 0;
      w.__FETCH_AYAH_CALLS__ = () => fetches;
      internals.invoke = ((cmd: string, args?: unknown) => {
        if (String(cmd) === 'fetch_ayah_audio') {
          fetches += 1;
        }
        return original(cmd, args);
      }) as typeof internals.invoke;
    });
  }

  const fetchCalls = (page: Page) =>
    page.evaluate(() => {
      const w = window as unknown as { __FETCH_AYAH_CALLS__?: () => number };
      return w.__FETCH_AYAH_CALLS__?.() ?? -1;
    });

  const recitationState = (page: Page) =>
    page.evaluate(async () => {
      type Invoke = (
        cmd: string,
        args?: unknown,
      ) => Promise<{
        cached: Array<{ global_ayah: number; file_path: string }>;
        last_played_ayah: number | null;
      }>;
      const invoke = (window as unknown as { __TAURI_INTERNALS__?: { invoke: Invoke } })
        .__TAURI_INTERNALS__!.invoke;
      return invoke('get_recitation_state', { surahId: 1 });
    });

  test('plays Al-Fatiha, caches it in the audio index, then replays with network blocked', async ({
    page,
  }) => {
    await page.goto('/quran/1');
    await trackFetchCalls(page);

    const footerPlay = page.getByRole('button', { name: 'Play', exact: true });
    await expect(footerPlay).toBeEnabled({ timeout: 10_000 });

    // ── First play: downloads ayah 1 (+lookahead), then advances ayah by ayah ──
    await footerPlay.click();

    // Playback of each ~0.5 s ayah triggers the next download; wait until the
    // audio index holds all 7 Al-Fatiha entries.
    await expect
      .poll(async () => (await recitationState(page)).cached.length, {
        timeout: 20_000,
        intervals: [250],
      })
      .toBeGreaterThanOrEqual(7);

    const state = await recitationState(page);
    expect(state.cached.map((c) => c.global_ayah).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
    // Real playback fired `audioStarted`, which persisted a position (FR-4.1).
    expect(state.last_played_ayah).toBeGreaterThanOrEqual(1);

    const callsAfterFirstPlay = await fetchCalls(page);
    // Ayah 1 on demand + lookahead prefetches as playback advances.
    expect(callsAfterFirstPlay).toBeGreaterThanOrEqual(4);
    expect(callsAfterFirstPlay).toBeLessThanOrEqual(7);

    // ── Replay with ALL network blocked except the already-cached files ──
    // The caching poll can exit while later ayahs are still playing; stop the
    // session so the transport returns to its idle "Play" state.
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(footerPlay).toBeVisible();
    // Stay on this document (the mock's audio index is in-memory per page).
    await page.unrouteAll();
    await page.route('**/*', (route) => {
      if (MOCK_MP3_URL.test(route.request().url())) {
        return route.fulfill({
          body: FIXTURE_MP3.toString('base64'),
          contentType: 'audio/mpeg',
        });
      }
      return route.abort();
    });

    await footerPlay.click();
    await expect(
      page.locator('[aria-label="Recitation player"] span[aria-live="polite"]'),
    ).toHaveText(/1 : \d/, { timeout: 10_000 });

    // Cache-hit path: not a single upstream download during the replay.
    expect(await fetchCalls(page)).toBe(callsAfterFirstPlay);
  });

  test('footer shows needs-download hint while idle', async ({ page }) => {
    await page.goto('/quran/1');
    await expect(page.locator('[aria-label="Recitation player"]')).toBeVisible({
      timeout: 10_000,
    });
    // Nothing cached yet for surah 1 in this fresh session → calm hint.
    await expect(
      page.locator('[aria-label="Recitation player"] span[aria-live="polite"]'),
    ).toHaveText(/Audio downloads when you press play/);
  });
});
