import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { installMockTauri } from './helpers/mock-tauri';

test.describe('Adhan playback on prayer-time', () => {
  test.beforeEach(async ({ page }) => {
    await installMockTauri(page);
    await page.goto('/onboarding');
    await page.getByRole('button', { name: /skip/i }).click();
    await expect(page).toHaveURL('/');
  });

  const adhanAudio = (page: Page) => page.locator('[data-testid="adhan-audio"]');

  /**
   * `canplaythrough` may beat React's `useEffect`, so the Tauri-event
   * listeners (`prayer-fired` / `prayer-time`) may not be registered yet.
   * The mock exposes its live listener count — wait for both components.
   */
  async function waitForEventListeners(page: Page): Promise<void> {
    await page.waitForFunction(
      () =>
        ((window as unknown as { __TAURI_EVENT_LISTENERS__?: number }).__TAURI_EVENT_LISTENERS__ ??
          0) >= 2,
      undefined,
      { timeout: 10_000, polling: 100 },
    );
  }

  test('plays the bundled adhan and shows the prompt when a prayer fires', async ({ page }) => {
    // Bundled CC0 tone finished loading (canplaythrough fired).
    await expect(adhanAudio(page)).toHaveAttribute('data-canplay', 'true', {
      timeout: 10_000,
    });
    await waitForEventListeners(page);

    // Scheduler simulation → real Tauri events reach both listeners.
    await page.evaluate(async () => {
      const invoke = (
        window as unknown as {
          __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: unknown) => Promise<unknown> };
        }
      ).__TAURI_INTERNALS__!.invoke;
      await invoke('trigger_test_prayer', { prayer: 'dhuhr' });
    });

    // prayer-fired → always-on prompt card with the prayer name.
    await expect(page.getByText('Dhuhr time')).toBeVisible({ timeout: 10_000 });

    // prayer-time + enabled toggles → adhan audio actually starts.
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="adhan-audio"]') as HTMLAudioElement | null;
        return Boolean(el) && !el!.paused && el!.currentTime > 0;
      },
      undefined,
      { timeout: 15_000, polling: 250 },
    );
  });

  test('stays silent when notification/adhan toggles are disabled', async ({ page }) => {
    await expect(adhanAudio(page)).toHaveAttribute('data-canplay', 'true', {
      timeout: 10_000,
    });
    await waitForEventListeners(page);

    // Persisted '0' for both gates (defaults are enabled; FR-5.x).
    await page.evaluate(async () => {
      const invoke = (
        window as unknown as {
          __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: unknown) => Promise<unknown> };
        }
      ).__TAURI_INTERNALS__!.invoke;
      await invoke('set_setting', { key: 'notification_enabled', value: '0' });
      await invoke('set_setting', { key: 'adhan_enabled', value: '0' });
    });

    await page.evaluate(async () => {
      const invoke = (
        window as unknown as {
          __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: unknown) => Promise<unknown> };
        }
      ).__TAURI_INTERNALS__!.invoke;
      await invoke('trigger_test_prayer', { prayer: 'asr' });
    });

    // Prompt is always-on regardless of toggles…
    await expect(page.getByText('Asr time')).toBeVisible({ timeout: 10_000 });

    // …but the adhan must NOT play.
    await page.waitForTimeout(1_500);
    const paused = await adhanAudio(page).evaluate((el) => (el as HTMLAudioElement).paused);
    expect(paused).toBe(true);
  });
});
