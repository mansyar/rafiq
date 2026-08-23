import { describe, expect, it } from 'vitest';
import { followReducer, initialFollowState, scrollBehaviorFor } from './follow-scroll';

describe('initialFollowState', () => {
  it('starts out following the recitation', () => {
    expect(initialFollowState()).toBe('following');
  });
});

describe('followReducer (FR-2/FR-3/FR-4)', () => {
  it('suspends when the active ayah leaves the viewport', () => {
    const next = followReducer(initialFollowState(), { type: 'activeLeftView' });

    expect(next).toBe('suspended');
  });

  it('stays suspended if the user keeps scrolling further away', () => {
    let state = followReducer(initialFollowState(), { type: 'activeLeftView' });
    state = followReducer(state, { type: 'activeLeftView' });

    expect(state).toBe('suspended');
  });

  it('resumes automatically once the active ayah re-enters view (FR-2)', () => {
    let state = followReducer(initialFollowState(), { type: 'activeLeftView' });
    state = followReducer(state, { type: 'activeInView' });

    expect(state).toBe('following');
  });

  it('stays following on redundant in-view events', () => {
    const next = followReducer(initialFollowState(), { type: 'activeInView' });

    expect(next).toBe('following');
  });

  it('jumps back to following when the floating button is tapped (FR-3)', () => {
    let state = followReducer(initialFollowState(), { type: 'activeLeftView' });
    state = followReducer(state, { type: 'jumpRequested' });

    expect(state).toBe('following');
  });

  it('reset restores following after a suspension (FR-4)', () => {
    let state = followReducer(initialFollowState(), { type: 'activeLeftView' });
    state = followReducer(state, { type: 'reset' });

    expect(state).toBe('following');
  });
});

describe('scrollBehaviorFor (AC-5)', () => {
  it('uses instant positioning under reduced motion', () => {
    expect(scrollBehaviorFor(true)).toBe('auto');
  });

  it('animates scrolling otherwise', () => {
    expect(scrollBehaviorFor(false)).toBe('smooth');
  });
});
