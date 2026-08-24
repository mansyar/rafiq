import { beforeEach, describe, expect, it, vi } from 'vitest';

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

import { initI18n } from '@/i18n';
import { syncTrayLabels, trayLabelsFromCatalog } from './tray-labels';

describe('tray label sync', () => {
  beforeEach(async () => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    await initI18n('en');
  });

  it('maps the EN catalog onto the TrayLabels DTO', () => {
    expect(trayLabelsFromCatalog()).toEqual({
      nextPrefix: 'Next:',
      completeSetup: 'Complete setup in Rafiq',
      show: 'Show Rafiq',
      quit: 'Quit Rafiq',
      hintBody: expect.stringContaining('system tray'),
    });
  });

  it('maps the ID catalog onto the TrayLabels DTO', async () => {
    await initI18n('id');
    expect(trayLabelsFromCatalog()).toMatchObject({
      nextPrefix: 'Berikutnya:',
      show: 'Tampilkan Rafiq',
      quit: 'Keluar dari Rafiq',
    });
  });

  it('invokes set_tray_labels with the current catalog labels', async () => {
    await syncTrayLabels();
    expect(invokeMock).toHaveBeenCalledWith(
      'set_tray_labels',
      expect.objectContaining({
        labels: expect.objectContaining({ nextPrefix: 'Next:', show: 'Show Rafiq' }),
      }),
    );
  });

  it('swallows backend errors so UI sync never breaks the app', async () => {
    invokeMock.mockRejectedValue(new Error('no tray in browser'));
    await expect(syncTrayLabels()).resolves.toBeUndefined();
  });
});
