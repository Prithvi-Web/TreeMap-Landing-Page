/**
 * Session-once gate for the intro overlay (§Kinetic 5), shared by App (does
 * the overlay mount?) and StorySection (should the hero intro wait for it?).
 * Decided once per page load so both callers always agree.
 */
const KEY = 'tm-intro-done'

function readDone(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return true // storage blocked → never run the intro twice-risky path
  }
}

/** Decided at module load, before any component asks. */
export const introPlanned = !readDone()

export function markIntroDone() {
  try {
    sessionStorage.setItem(KEY, '1')
  } catch {
    /* fine — worst case the gate re-opens next load */
  }
}

/** Extra delay (s) the hero intro adds so it emerges as the veil lifts. */
export const INTRO_HERO_DELAY = 1.05
