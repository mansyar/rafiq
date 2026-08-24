import { invoke } from '@tauri-apps/api/core';
import { t } from 'i18next';

/** Localized tray strings handed to the Rust runtime (mirrors `tray::TrayLabels`). */
export type TrayLabels = {
  nextPrefix: string;
  completeSetup: string;
  show: string;
  quit: string;
  hintBody: string;
};

/** Builds the DTO from the active i18n catalog (NFR-1: single source of truth). */
export function trayLabelsFromCatalog(): TrayLabels {
  return {
    nextPrefix: t('tray.nextPrefix'),
    completeSetup: t('tray.completeSetup'),
    show: t('tray.show'),
    quit: t('tray.quit'),
    hintBody: t('tray.hintBody'),
  };
}

/** Pushes current catalog labels to the tray runtime; safe no-op on failure. */
export async function syncTrayLabels(): Promise<void> {
  try {
    await invoke('set_tray_labels', { labels: trayLabelsFromCatalog() });
  } catch {
    // No tray backend in browser dev / E2E — ignore.
  }
}
