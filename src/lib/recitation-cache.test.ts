import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import {
  deleteRecitationCache,
  formatCacheSize,
  getRecitationCacheSummary,
} from './recitation-cache';

describe('formatCacheSize (FR-5)', () => {
  it('renders byte values without decimals', () => {
    expect(formatCacheSize(0, 'en')).toBe('0 B');
    expect(formatCacheSize(512, 'en')).toBe('512 B');
  });

  it('renders kilobytes with up to one decimal (EN)', () => {
    expect(formatCacheSize(2048, 'en')).toBe('2 KB');
    expect(formatCacheSize(2560, 'en')).toBe('2.5 KB');
  });

  it('renders megabytes with up to one decimal (EN)', () => {
    expect(formatCacheSize(1536 * 1024, 'en')).toBe('1.5 MB');
    expect(formatCacheSize(10 * 1024 * 1024, 'en')).toBe('10 MB');
  });

  it('localizes the decimal separator (ID)', () => {
    expect(formatCacheSize(2560, 'id')).toBe('2,5 KB');
    expect(formatCacheSize(1536 * 1024, 'id')).toContain('MB');
    expect(formatCacheSize(2560, 'id')).toMatch(/^2,5/);
  });
});

describe('invoke wrappers (FR-5)', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
  });

  it('getRecitationCacheSummary calls the summary command', async () => {
    invokeMock.mockResolvedValue({ total_bytes: 0, surahs: [] });
    await getRecitationCacheSummary();
    expect(invokeMock).toHaveBeenCalledWith('get_recitation_cache_summary');
  });

  it('deleteRecitationCache passes null for the whole cache', async () => {
    await deleteRecitationCache();
    expect(invokeMock).toHaveBeenCalledWith('delete_recitation_cache', { surahId: null });
  });

  it('deleteRecitationCache passes the surah id for per-surah deletion', async () => {
    await deleteRecitationCache(3);
    expect(invokeMock).toHaveBeenCalledWith('delete_recitation_cache', { surahId: 3 });
  });
});
