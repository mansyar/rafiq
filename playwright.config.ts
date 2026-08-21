import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for Rafiq E2E harness.
 * - Web E2E (default): `pnpm dev` Vite server at http://localhost:1420 + mocked Tauri invokes. Zero native deps.
 * - Native E2E (opt-in): set TAURI_E2E_NATIVE=1 to boot via `pnpm tauri dev` with tauri-driver.
 * See e2e/README.md and spec FR-1.
 */
const isCI = !!process.env.CI;
const isNative = !!process.env.TAURI_E2E_NATIVE;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: 1,
  reporter: isCI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: isNative ? 'pnpm tauri dev -- --port 1420' : 'pnpm dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !isCI,
    timeout: 120 * 1000,
    env: {
      // Ephemeral dir is injected per-test via e2e/helpers/isolated-dir; global fallback for local dev.
      TAURI_E2E: '1',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
