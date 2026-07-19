import { clamp01, smoothstep } from '../../lib/stages'

/**
 * Shared progress for the pinned PROCESS rail (cinetica-style dial section),
 * mirroring lib/scrollState: one module-level value written by the rail's
 * ScrollTrigger, read inside useFrame by every stage scene — no React state,
 * no re-renders at 60fps.
 */
export const processState = {
  /** 0..1 across the whole pinned rail. */
  progress: 0,
}

export const STAGE_COUNT = 5

/** Names + copy live with the rail component; scenes only need windows. */
export type StageWindow = {
  /** Local progress 0..1 through this stage's slice (clamped, incl. margins). */
  p: number
  /** Blend weight 0..1 — 1 while this stage owns the dial, easing at edges. */
  active: number
}

// Each stage owns 1/STAGE_COUNT of the rail; neighbours crossfade over this
// fraction of a slice on each side of the boundary.
const FADE = 0.22

/**
 * Compute a stage's window from rail progress. Stage i's plateau spans its
 * slice; `active` eases 0→1 entering and 1→0 leaving so the dial always sums
 * to ~1 across the two stages trading places. `p` keeps advancing slightly
 * beyond the slice (±FADE) so motion never freezes mid-crossfade.
 */
export function stageWindow(index: number, t: number): StageWindow {
  const slice = 1 / STAGE_COUNT
  const start = index * slice
  const end = start + slice
  const fade = FADE * slice

  const enter = index === 0 ? 1 : smoothstep(start - fade, start + fade, t)
  const exit = index === STAGE_COUNT - 1 ? 0 : smoothstep(end - fade, end + fade, t)
  const active = enter * (1 - exit)

  const p = clamp01((t - (start - fade)) / (slice + 2 * fade))
  return { p, active }
}
