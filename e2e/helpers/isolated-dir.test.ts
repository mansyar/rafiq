import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanupIsolatedDir, createIsolatedDir, withIsolatedDir } from './isolated-dir';

describe('isolated-dir helpers', () => {
  it('createIsolatedDir creates a tmp dir containing rafiq-e2e and sets env var', async () => {
    const dir = await createIsolatedDir();
    try {
      expect(dir).toContain('rafiq-e2e-');
      expect(existsSync(dir)).toBe(true);
      expect(process.env.TAURI_E2E_APP_DATA_DIR).toBe(dir);
    } finally {
      await cleanupIsolatedDir(dir);
    }
  });

  it('two sequential calls produce distinct dirs and files do not leak', async () => {
    const a = await createIsolatedDir();
    const b = await createIsolatedDir();
    try {
      expect(a).not.toBe(b);
      expect(existsSync(a)).toBe(true);
      expect(existsSync(b)).toBe(true);
      // Write to a, ensure b is empty
      writeFileSync(join(a, 'sentinel.txt'), 'hello');
      expect(existsSync(join(a, 'sentinel.txt'))).toBe(true);
      expect(existsSync(join(b, 'sentinel.txt'))).toBe(false);
    } finally {
      await cleanupIsolatedDir(a);
      await cleanupIsolatedDir(b);
    }
  });

  it('cleanupIsolatedDir clears env var only when it matches and removes dir', async () => {
    const dir = await createIsolatedDir();
    expect(process.env.TAURI_E2E_APP_DATA_DIR).toBe(dir);
    await cleanupIsolatedDir(dir);
    expect(process.env.TAURI_E2E_APP_DATA_DIR).toBeUndefined();
    expect(existsSync(dir)).toBe(false);
  });

  it('cleanupIsolatedDir does not clear unrelated env var value', async () => {
    const dir = await createIsolatedDir();
    process.env.TAURI_E2E_APP_DATA_DIR = '/other/path';
    await cleanupIsolatedDir(dir);
    // Should have left the manually-set value intact
    expect(process.env.TAURI_E2E_APP_DATA_DIR).toBe('/other/path');
    expect(existsSync(dir)).toBe(false);
    delete process.env.TAURI_E2E_APP_DATA_DIR;
  });

  it('withIsolatedDir creates, passes dir to callback, and always cleans up', async () => {
    let seen = '';
    const result = await withIsolatedDir(async (dir) => {
      seen = dir;
      expect(existsSync(dir)).toBe(true);
      expect(process.env.TAURI_E2E_APP_DATA_DIR).toBe(dir);
      return 42;
    });
    expect(result).toBe(42);
    expect(existsSync(seen)).toBe(false);
    expect(process.env.TAURI_E2E_APP_DATA_DIR).toBeUndefined();
  });

  it('withIsolatedDir cleans up even when callback throws', async () => {
    let leaked = '';
    await expect(
      withIsolatedDir(async (dir) => {
        leaked = dir;
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(existsSync(leaked)).toBe(false);
    expect(process.env.TAURI_E2E_APP_DATA_DIR).toBeUndefined();
  });

  it('concurrent withIsolatedDir calls are isolated (no shared dir)', async () => {
    const [a, b] = await Promise.all([
      withIsolatedDir(async (dir) => {
        // Hold dir open a moment to force concurrency
        await new Promise((r) => setTimeout(r, 20));
        return dir;
      }),
      withIsolatedDir(async (dir) => {
        await new Promise((r) => setTimeout(r, 20));
        return dir;
      }),
    ]);
    expect(a).not.toBe(b);
    // Both cleaned up after return
    expect(existsSync(a)).toBe(false);
    expect(existsSync(b)).toBe(false);
  });
});
