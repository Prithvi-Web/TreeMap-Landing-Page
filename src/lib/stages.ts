/**
 * The story's stage math, shared by the cube field, the scan sweep, the
 * camera rig and the DOM overlays so every layer agrees on the same
 * breakpoints (§2: chaos 0–30%, scanning 30–60%, treemap 60–100%).
 */
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function smoothstep(edge0: number, edge1: number, v: number): number {
  const t = clamp01((v - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * 0 = pure chaos, 1 = aligned on scan tracks. Alignment begins only as the
 * scanning stage starts (§2's table: 0–30% stays chaotic while the camera
 * dollies in; tracks form across 30–60%).
 */
export function chaosToScan(t: number): number {
  return smoothstep(0.28, 0.52, t)
}

/** 0 = still track formation, 1 = settled squarified treemap. */
export function scanToTreemap(t: number): number {
  return smoothstep(0.55, 0.98, t)
}

/** Scan-sweep window and position: 2.5 ping-pong passes across 30%→62%. */
export function sweepState(t: number, halfWidth: number): { x: number; gate: number } {
  const gate =
    smoothstep(0.27, 0.34, t) * (1 - smoothstep(0.56, 0.64, t))
  const local = clamp01((t - 0.3) / 0.32)
  const phase = pingpong(local * 2.5)
  const span = halfWidth + 1.5
  return { x: lerp(-span, span, phase), gate }
}

function pingpong(v: number): number {
  const m = v % 2
  return m <= 1 ? m : 2 - m
}

/** Opacity window helper for overlay copy: fade in over [in0,in1], out over [out0,out1]. */
export function fadeWindow(t: number, in0: number, in1: number, out0: number, out1: number): number {
  return smoothstep(in0, in1, t) * (1 - smoothstep(out0, out1, t))
}
