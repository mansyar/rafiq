import { describe, expect, it } from 'vitest';
import { isLoggablePrayer, LOGGABLE_PRAYERS } from './log';

describe('isLoggablePrayer', () => {
  it('accepts the five obligatory prayers', () => {
    for (const prayer of LOGGABLE_PRAYERS) {
      expect(isLoggablePrayer(prayer)).toBe(true);
    }
  });

  it('rejects sunrise (non-obligatory) and unknown names', () => {
    expect(isLoggablePrayer('sunrise')).toBe(false);
    expect(isLoggablePrayer('midnight')).toBe(false);
    expect(isLoggablePrayer('')).toBe(false);
  });
});
