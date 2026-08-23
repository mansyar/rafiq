import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { Locator, Page, Route } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { installMockTauri } from './helpers/mock-tauri';

// Real, decodable 0.5 s silent MP3 so headless Chromium actually starts and
// ends playback for every ayah (driving advance/persistence in the store).
const FIXTURE_MP3 = readFileSync(path.join('e2e', 'fixtures', 'silence.mp3'));
// Globals 1..7 (Al-Fatiha) plus 8..10 (Al-Baqarah lookahead after the
// auto-advance boundary) are served from local fixture paths by the mock.
const MOCK_MP3_URL = /\/tmp\/mock\/recitation\/(?:[1-9]|10)\.mp3$/;

/**
 * Opt-in real-CDN mode (`E2E_REAL_CDN=1`): the same `/tmp/mock/recitation/N.mp3`
 * routes are fulfilled by proxying the production CDN instead of the fixture,
 * proving the pipeline works against genuine network audio (manual gate —
 * requires internet; slower, so assertions relax accordingly).
 */
const REAL_CDN = process.env.E2E_REAL_CDN === '1';
const CDN_URL = (globalAyah: number) =>
  `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalAyah}.mp3`;
/** Full surah playback takes ~45 s of real audio; cache fills as it advances. */
const CACHE_TARGET = REAL_CDN ? 5 : 7;
const CACHE_TIMEOUT = REAL_CDN ? 90_000 : 20_000;

/** Real-CDN proxies currently running (node-side counter for teardown drain). */
let cdnInFlight = 0;

/** Fulfills one mocked mp3 route: fixture bytes, or real-CDN proxy passthrough. */
async function fulfillMp3(route: Route): Promise<void> {
  if (!REAL_CDN) {
    await route.fulfill({ body: FIXTURE_MP3, contentType: 'audio/mpeg' });
    return;
  }
  const m = route
    .request()
    .url()
    .match(/recitation\/(\d+)\.mp3$/);
  // route.fetch keeps the proxied request tied to the route's lifetime
  // (a test-scoped page.request.get can still be pending at teardown).
  cdnInFlight += 1;
  try {
    const response = await route.fetch({ url: CDN_URL(Number(m?.[1] ?? 0)) });
    await route.fulfill({ response });
  } catch {
    // Context closed mid-proxy (teardown race) — Playwright has already
    // handled or discarded the route; nothing left to do.
  } finally {
    cdnInFlight -= 1;
  }
}

test.describe('Recitation playback (Al-Fatiha fixture)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockTauri(page);
    // The mock's fetch_ayah_audio hands back literal `/tmp/mock/recitation/N.mp3`
    // paths (browser mode keeps paths as-is), so <audio> requests exactly those
    // URLs. Fulfill them with the local fixture — or, in E2E_REAL_CDN mode,
    // proxy the production CDN for that global ayah.
    await page.route(MOCK_MP3_URL, (route) => fulfillMp3(route));
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
    // audio index holds all 7 Al-Fatiha entries (real CDN: ≥5 within 90 s).
    await expect
      .poll(async () => (await recitationState(page)).cached.length, {
        timeout: CACHE_TIMEOUT,
        intervals: [250],
      })
      .toBeGreaterThanOrEqual(CACHE_TARGET);

    const state = await recitationState(page);
    if (!REAL_CDN) {
      expect(state.cached.map((c) => c.global_ayah).sort((a, b) => a - b)).toEqual([
        1, 2, 3, 4, 5, 6, 7,
      ]);
    }
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
        return fulfillMp3(route);
      }
      return route.abort();
    });

    await footerPlay.click();
    await expect(
      page.locator('[aria-label="Recitation player"] span[aria-live="polite"]'),
    ).toHaveText(/1 : \d/, { timeout: 10_000 });

    // Cache-hit path: not a single upstream download during the replay.
    expect(await fetchCalls(page)).toBe(callsAfterFirstPlay);

    // End the session and let any in-flight real-CDN proxy finish before
    // the context closes (otherwise its rejection leaks into the next test).
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect.poll(() => cdnInFlight, { timeout: 20_000, intervals: [100] }).toBe(0);
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

test.describe('Playback preferences (FR-2/FR-3/FR-4)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockTauri(page);
    await page.route(MOCK_MP3_URL, (route) => fulfillMp3(route));
    await page.goto('/onboarding');
    await page.getByRole('button', { name: /skip/i }).click();
    await expect(page).toHaveURL('/');
  });

  const player = (page: Page) => page.locator('[aria-label="Recitation player"]');
  const positionLabel = (page: Page) => player(page).locator('span[aria-live="polite"]');

  test('speed button cycles presets, wraps, and persists across reload (AC-1)', async ({
    page,
  }) => {
    await page.goto('/quran/1');
    const speedBtn = page.getByRole('button', { name: /Playback speed/ });
    await expect(speedBtn).toHaveText('1×');

    await speedBtn.click();
    await expect(speedBtn).toHaveText('1.25×');
    await speedBtn.click();
    await expect(speedBtn).toHaveText('1.5×');
    await speedBtn.click();
    await expect(speedBtn).toHaveText('2×');
    await speedBtn.click(); // wraps past 2× back to the slowest preset
    await expect(speedBtn).toHaveText('0.75×');

    // Preference survives a full app restart (settings-backed hydration).
    await page.reload();
    await expect(speedBtn).toHaveText('0.75×');
  });

  test('repeat-ayah keeps replaying the same ayah in place (FR-3)', async ({ page }) => {
    await page.goto('/quran/1');
    const repeatGroup = page.getByRole('group', { name: 'Repeat' });
    await repeatGroup.getByRole('button', { name: 'Ayah', exact: true }).click();

    const play = player(page).getByRole('button', { name: 'Play', exact: true });
    await play.click({ timeout: 10_000 });

    // Two fixture ayah-durations (~0.5 s each) pass; playback must still be
    // sitting on ayah 1 and still running.
    await expect(positionLabel(page)).toHaveText('1 : 1');
    await page.waitForTimeout(1600);
    await expect(positionLabel(page)).toHaveText('1 : 1');
    await expect(player(page).getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  });

  test('repeat-surah wraps back to ayah 1 at the end of Al-Fatiha (FR-3)', async ({ page }) => {
    await page.goto('/quran/1');
    const repeatGroup = page.getByRole('group', { name: 'Repeat' });
    await repeatGroup.getByRole('button', { name: 'Surah', exact: true }).click();

    await player(page).getByRole('button', { name: 'Play', exact: true }).click({
      timeout: 10_000,
    });

    // Playback moves past ayah 1 …
    await expect(positionLabel(page)).toHaveText(/1 : [2-7]/, { timeout: 15_000 });
    // … and wraps to ayah 1 again while audio is still going.
    await expect(positionLabel(page)).toHaveText('1 : 1', { timeout: 15_000 });
    await expect(player(page).getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  });

  test('auto-advance carries playback from Al-Fatiha into Al-Baqarah hands-free (FR-4)', async ({
    page,
  }) => {
    await page.goto('/quran/1');
    await page.getByRole('button', { name: 'Continue to next surah' }).click();

    await player(page).getByRole('button', { name: 'Play', exact: true }).click({
      timeout: 10_000,
    });

    // After the last Fatiha ayah ends, the reader follows playback into
    // surah 2 without any user interaction.
    await expect(page).toHaveURL(/\/quran\/2$/, { timeout: 20_000 });
    await expect(positionLabel(page)).toHaveText('2 : 1', { timeout: 20_000 });
    await expect(player(page).getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  });
});

test.describe('Recitation follow-scroll (FR-1..FR-4)', () => {
  const player = (page: Page) => page.locator('[aria-label="Recitation player"]');
  const positionLabel = (page: Page) => player(page).locator('span[aria-live="polite"]');

  test.beforeEach(async ({ page }) => {
    await installMockTauri(page);
    await page.route(MOCK_MP3_URL, fulfillMp3);
    await page.goto('/onboarding');
    await page.getByRole('button', { name: 'Skip' }).click();
    await expect(page).toHaveURL('/');
  });

  const ayahCard = (page: Page, n: number) =>
    page.getByRole('button', { name: new RegExp(`Ayah ${n} `) });

  const isInViewport = (page: Page, locator: Locator) =>
    locator.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return (
        r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth
      );
    });

  test('keeps the recited ayah in view as playback advances (AC-1)', async ({ page }) => {
    await page.goto('/quran/1');
    await player(page).getByRole('button', { name: 'Play', exact: true }).click({
      timeout: 10_000,
    });
    // Clicking the footer can leave the viewport below the cards; align with
    // ayah 1 so following starts engaged rather than suspended (FR-2).
    await page.evaluate(() => window.scrollTo(0, 0));

    // Wait for the second ayah to become active, then confirm it is on screen.
    await expect(positionLabel(page)).toHaveText('1 : 2', { timeout: 15_000 });
    await expect.poll(() => isInViewport(page, ayahCard(page, 2)), { timeout: 5_000 }).toBe(true);
  });

  test('reveals the jump pill after scrolling away and snaps back on tap (AC-2)', async ({
    page,
  }) => {
    await page.goto('/quran/1');
    await page
      .getByRole('group', { name: 'Repeat' })
      .getByRole('button', { name: 'Surah', exact: true })
      .click();
    await player(page).getByRole('button', { name: 'Play', exact: true }).click({
      timeout: 10_000,
    });
    await expect(positionLabel(page)).toHaveText(/1 : [1-7]/, { timeout: 15_000 });

    // Scroll far below the recited verse; the chase suspends and the pill appears.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const jump = page.getByTestId('jump-to-recitation');
    await expect(jump).toBeVisible({ timeout: 5_000 });

    // Tapping it centers the active card and hides the pill again (resume).
    await jump.click();
    await expect(jump).toBeHidden({ timeout: 5_000 });
    await expect.poll(() => isInViewport(page, ayahCard(page, 1))).toBe(true);
  });

  test('resumes following silently when the user scrolls back into range (AC-3)', async ({
    page,
  }) => {
    await page.goto('/quran/1');
    await page
      .getByRole('group', { name: 'Repeat' })
      .getByRole('button', { name: 'Surah', exact: true })
      .click();
    await player(page).getByRole('button', { name: 'Play', exact: true }).click({
      timeout: 10_000,
    });
    await expect(positionLabel(page)).toHaveText(/1 : [1-7]/, { timeout: 15_000 });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByTestId('jump-to-recitation')).toBeVisible({ timeout: 5_000 });

    // Returning without touching the pill re-engages the chase on its own.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByTestId('jump-to-recitation')).toBeHidden({ timeout: 5_000 });
  });

  test('pill stays useful while paused and disappears when playback stops (AC-4)', async ({
    page,
  }) => {
    await page.goto('/quran/1');
    await page
      .getByRole('group', { name: 'Repeat' })
      .getByRole('button', { name: 'Surah', exact: true })
      .click();
    await player(page).getByRole('button', { name: 'Play', exact: true }).click({
      timeout: 10_000,
    });
    await expect(positionLabel(page)).toHaveText(/1 : [1-7]/, { timeout: 15_000 });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByTestId('jump-to-recitation')).toBeVisible({ timeout: 5_000 });

    // Paused playback keeps the escape hatch available...
    await player(page).getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(page.getByTestId('jump-to-recitation')).toBeVisible();

    // ...and stopping clears it entirely (idle resets following).
    await player(page).getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(page.getByTestId('jump-to-recitation')).toBeHidden({ timeout: 5_000 });
  });
});
