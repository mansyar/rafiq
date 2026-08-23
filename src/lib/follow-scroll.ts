/**
 * Follow-scroll decision logic for the Quran reader (recitation-follow-scroll
 * track). Pure and DOM-free: the reader observes the viewport, feeds events
 * in, and performs the actual scrolling when this machine says to.
 */

/** Whether the reader auto-centers the recited ayah. */
export type FollowPhase = 'following' | 'suspended';

export type FollowEvent =
  /** The active ayah has zero viewport overlap while playback is active. */
  | { type: 'activeLeftView' }
  /** Any part of the active ayah re-entered the viewport ("any overlap"). */
  | { type: 'activeInView' }
  /** The floating "jump to reciting ayah" button was tapped. */
  | { type: 'jumpRequested' }
  /** Playback stopped, a new play started, or the surah changed. */
  | { type: 'reset' };

export function initialFollowState(): FollowPhase {
  return 'following';
}

export function followReducer(state: FollowPhase, event: FollowEvent): FollowPhase {
  switch (event.type) {
    case 'activeLeftView':
      return 'suspended';
    case 'activeInView':
      // FR-2: scrolling back by hand silently resumes the chase.
      return 'following';
    case 'jumpRequested':
      return 'following';
    case 'reset':
      // FR-4: stop / new play / surah navigation always restarts following.
      return 'following';
    default:
      // Unknown events are no-ops; state machines stay conservative.
      return state;
  }
}

/** AC-5/NFR-3: honor `prefers-reduced-motion` with instant jumps. */
export function scrollBehaviorFor(prefersReducedMotion: boolean): ScrollBehavior {
  return prefersReducedMotion ? 'auto' : 'smooth';
}
