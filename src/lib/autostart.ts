import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart';

/** True when Rafiq is registered to launch at OS login (false when unavailable). */
export async function getLaunchAtLogin(): Promise<boolean> {
  try {
    return await isEnabled();
  } catch {
    // Backend unavailable (browser dev / E2E mock) — conservative default off.
    return false;
  }
}

/** Registers or unregisters Rafiq as a login launch item. */
export async function setLaunchAtLogin(enabled: boolean): Promise<void> {
  if (enabled) {
    await enable();
  } else {
    await disable();
  }
}
