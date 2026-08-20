// NOTE: TDD red-state stub — signatures only, bodies throw until the green commit.

import { isTauri } from './tauri';

export const AHEAD = 3;

export type PlayerStatus = 'idle' | 'fetching' | 'playing' | 'paused';

export interface PlayerPosition {
  surahId: number;
  ayah: number;
  global: number;
}

export interface PlayerState {
  status: PlayerStatus;
  current: PlayerPosition | null;
  pendingGlobals: number[];
  fetchingTarget: boolean;
  error: string | null;
}

export type PlayerEvent =
  | {
      type: 'requestPlay';
      position: PlayerPosition;
      cachedGlobals: number[];
      surahEndGlobal: number;
    }
  | { type: 'advance'; position: PlayerPosition; cachedGlobals: number[]; surahEndGlobal: number }
  | { type: 'fetchSucceeded'; global: number }
  | { type: 'fetchFailed'; global: number; error: string }
  | { type: 'retry'; cachedGlobals: number[]; surahEndGlobal: number }
  | { type: 'audioStarted' }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'stop' };

export function initialPlayerState(): PlayerState {
  throw new Error('not implemented');
}

export function computeLookahead(
  _position: PlayerPosition,
  _surahEndGlobal: number,
  _cachedGlobals: readonly number[],
): number[] {
  throw new Error('not implemented');
}

export function playerReducer(_state: PlayerState, _event: PlayerEvent): PlayerState {
  throw new Error('not implemented');
}

export function persistencePosition(
  _state: PlayerState,
  _event: PlayerEvent,
): PlayerPosition | null {
  throw new Error('not implemented');
}

export function localAudioUrl(path: string): string {
  if (!isTauri()) {
    return path;
  }
  throw new Error('not implemented');
}
