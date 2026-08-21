import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  FIXTURE_AYAH,
  fixtureSourcePath,
  seedRecitationFixture,
  shouldRunRealCdn,
} from './fixtures';
import { withIsolatedDir } from './isolated-dir';

describe('fixtures helpers', () => {
  it('FIXTURE_AYAH is 1', () => {
    expect(FIXTURE_AYAH).toBe(1);
  });

  it('fixtureSourcePath points to a non-empty fixture file', () => {
    const p = fixtureSourcePath();
    expect(existsSync(p)).toBe(true);
    const st = statSync(p);
    expect(st.size).toBeGreaterThan(0);
    expect(st.size).toBeLessThanOrEqual(10240);
  });

  it('seedRecitationFixture copies fixture into isolated dir', async () => {
    await withIsolatedDir(async (dir) => {
      const dest = await seedRecitationFixture(dir);
      expect(dest).toBe(join(dir, 'recitation', '1.mp3'));
      expect(existsSync(dest)).toBe(true);
      expect(statSync(dest).size).toBeGreaterThan(0);
      // source and dest same size
      const srcSize = statSync(fixtureSourcePath()).size;
      const destSize = statSync(dest).size;
      expect(destSize).toBe(srcSize);
    });
  });

  it('shouldRunRealCdn defaults false and respects env', async () => {
    const orig = process.env.E2E_REAL_CDN;
    delete process.env.E2E_REAL_CDN;
    expect(shouldRunRealCdn()).toBe(false);
    process.env.E2E_REAL_CDN = '1';
    expect(shouldRunRealCdn()).toBe(true);
    process.env.E2E_REAL_CDN = '0';
    expect(shouldRunRealCdn()).toBe(false);
    if (orig === undefined) delete process.env.E2E_REAL_CDN;
    else process.env.E2E_REAL_CDN = orig;
  });
});
