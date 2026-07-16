/**
 * Sanity check (§16.5): squarify() must perfectly tile the layout box — full
 * coverage, no overlaps, everything in bounds — at every responsive cube
 * count. Run with `npm run check:squarify` (Node 22.18+ runs TS natively).
 */
import { squarify } from '../src/lib/squarify.ts'
import { buildDemoData } from '../src/lib/demoData.ts'

type Box = { w: number; h: number }

const CASES: Array<{ count: number; box: Box }> = [
  { count: 320, box: { w: 16, h: 10 } },
  { count: 180, box: { w: 14, h: 10 } },
  { count: 90, box: { w: 10, h: 12.5 } },
]

const EPS = 1e-6
let failed = false

for (const { count, box } of CASES) {
  const items = buildDemoData(count)
  const rects = squarify(items, 0, 0, box.w, box.h)

  const boxArea = box.w * box.h
  const rectArea = rects.reduce((s, r) => s + r.w * r.h, 0)
  const coverageErr = Math.abs(rectArea - boxArea) / boxArea

  let outOfBounds = 0
  let degenerate = 0
  let minDim = Infinity
  let worstAspect = 0
  for (const r of rects) {
    if (r.x < -EPS || r.y < -EPS || r.x + r.w > box.w + 1e-3 || r.y + r.h > box.h + 1e-3) outOfBounds++
    if (r.w <= EPS || r.h <= EPS) degenerate++
    minDim = Math.min(minDim, r.w, r.h)
    worstAspect = Math.max(worstAspect, r.w / r.h, r.h / r.w)
  }

  // Pairwise overlap: any shared interior area is a layout bug.
  let overlaps = 0
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i]
      const b = rects[j]
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      if (ox > 1e-4 && oy > 1e-4) overlaps++
    }
  }

  const ok =
    rects.length === count &&
    coverageErr < 0.001 &&
    overlaps === 0 &&
    outOfBounds === 0 &&
    degenerate === 0

  if (!ok) failed = true
  console.log(
    `[${ok ? 'PASS' : 'FAIL'}] n=${count} box=${box.w}x${box.h} ` +
      `rects=${rects.length} coverageErr=${(coverageErr * 100).toFixed(4)}% ` +
      `overlaps=${overlaps} outOfBounds=${outOfBounds} degenerate=${degenerate} ` +
      `minDim=${minDim.toFixed(3)} worstAspect=${worstAspect.toFixed(1)}`,
  )
}

if (failed) {
  process.exit(1)
}
console.log('squarify: all cases tile perfectly.')
