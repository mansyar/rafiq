//! Zustand glue for the updater: owns the UI-facing status machine
//! (`idle / checking / available / latest / error`) and drives the pure
//! check logic from `./update`. The launch check is silent (FR-5.3) — only
//! a user-initiated settings check ever surfaces the `checking` state.

import { create } from 'zustand';
import {
  type CheckOutcome,
  checkForUpdates,
  runStartupUpdateCheck,
  tauriUpdatePorts,
  type UpdatePorts,
} from './update';

/** UI-facing updater status (FR-5.3: up-to-date / available / error). */
export type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; version: string; notes: string | null }
  | { kind: 'latest' }
  | { kind: 'error' };

interface UpdateStore {
  status: UpdateStatus;
  /** Silent once-per-launch check; honours the persisted 24h interval. */
  autoCheck: (nowMs?: number, ports?: UpdatePorts) => Promise<void>;
  /** Manual "Check for updates"; bypasses the interval, shows `checking`. */
  manualCheck: (nowMs?: number, ports?: UpdatePorts) => Promise<void>;
  /** Resets to idle (tests / E2E isolation). */
  reset: () => void;
}

function applyOutcome(set: (partial: Partial<UpdateStore>) => void, outcome: CheckOutcome): void {
  switch (outcome.status) {
    case 'available':
      set({
        status: { kind: 'available', version: outcome.version, notes: outcome.notes },
      });
      break;
    case 'latest':
      set({ status: { kind: 'latest' } });
      break;
    case 'error':
      // A failed refresh intentionally replaces any previous status; the next
      // successful launch or manual check will restore accurate information.
      set({ status: { kind: 'error' } });
      break;
    case 'skipped':
      break;
  }
}

export const useUpdateStore = create<UpdateStore>((set) => ({
  status: { kind: 'idle' },

  autoCheck: async (nowMs = Date.now(), ports = tauriUpdatePorts) => {
    // Silent: no intermediate `checking` transition at launch time.
    applyOutcome(set, await runStartupUpdateCheck(ports, nowMs));
  },

  manualCheck: async (nowMs = Date.now(), ports = tauriUpdatePorts) => {
    set({ status: { kind: 'checking' } });
    applyOutcome(set, await checkForUpdates(ports, nowMs));
  },

  reset: () => {
    set({ status: { kind: 'idle' } });
  },
}));
