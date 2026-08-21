import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Create a fresh `TAURI_E2E_APP_DATA_DIR` under the OS temp directory. */
export async function createIsolatedDir(): Promise<string> {
  const dir = join(tmpdir(), `rafiq-e2e-${randomUUID()}`);
  await mkdir(dir, { recursive: true });
  process.env.TAURI_E2E_APP_DATA_DIR = dir;
  return dir;
}

/** Remove an isolated dir and clear the env var if it still points there. */
export async function cleanupIsolatedDir(dir: string): Promise<void> {
  if (process.env.TAURI_E2E_APP_DATA_DIR === dir) {
    delete process.env.TAURI_E2E_APP_DATA_DIR;
  }
  await rm(dir, { recursive: true, force: true });
}

/** Convenience: create → run callback → always cleanup (even on throw). */
export async function withIsolatedDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await createIsolatedDir();
  try {
    return await fn(dir);
  } finally {
    await cleanupIsolatedDir(dir);
  }
}
