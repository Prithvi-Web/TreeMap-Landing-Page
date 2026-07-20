import { useEffect, useRef } from 'react'
import { gsap } from '../../lib/gsapSetup'
import { processState, STAGE_COUNT, stageWindow } from './processState'
import { clamp01, lerp, smoothstep } from '../../lib/stages'
import { mulberry32 } from '../../lib/random'
import { squarify } from '../../lib/squarify'

/**
 * The PIPELINE dial, rebuilt as a single SVG instrument (v2).
 *
 * v1 put a second WebGL canvas at the dial's heart, and that canvas was the
 * page's one unreliable organ: R3F sizing races, lazy-chunk loads mid-pin,
 * frameloop toggling and a second GL context all produced the "renders
 * nothing / breaks randomly" reports. SVG cannot fail any of those ways —
 * the same lesson the views gallery already learned with its sunburst.
 *
 * One writer: a gsap.ticker callback (GSAP has a timer fallback where rAF
 * starves; R3F never did). It reads processState.progress — written by the
 * rail's single ScrollTrigger — plus the ticker clock for idle drift, and
 * pushes plain attribute/style strings. Every visual is a pure function of
 * (t, time), so scrubbing backwards rewinds perfectly and there is nothing
 * to mount, size, or lose mid-scroll.
 */

const TAU = Math.PI * 2

/** 12 o'clock in SVG space (y-down): angles increase clockwise. */
const TOP = -Math.PI / 2

// Brand + chrome hexes (tokens from index.css / existing scene chrome).
const TEAL = '#2dd4bf'
const AMBER = '#fbbf24'
const ROSE = '#f43f5e'
const FLASH = '#dcfefa'
const CHROME_DIM = '#3b4a6b'
const CHROME = '#8fa3c8'
const GRID = '#1c2740'
const PLATE = '#0b1220'

/** Stage accents, matching ProcessRail's STAGES order. */
const ACCENTS = [TEAL, AMBER, TEAL, ROSE, TEAL]

function easeOutCubic(v: number): number {
  const inv = 1 - v
  return 1 - inv * inv * inv
}

function easeOutBack(v: number): number {
  const c1 = 1.35
  const c3 = c1 + 1
  const inv = v - 1
  return 1 + c3 * inv * inv * inv + c1 * inv * inv
}

function easeInOutCubic(v: number): number {
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2
}

function px(cx: number, r: number, a: number): number {
  return cx + Math.cos(a) * r
}

function py(cy: number, r: number, a: number): number {
  return cy + Math.sin(a) * r
}

/** Filled wedge (pie slice) between two clockwise angles at radius r. */
function wedgePath(a0: number, a1: number, r: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0
  return [
    `M50,50`,
    `L${px(50, r, a0).toFixed(2)},${py(50, r, a0).toFixed(2)}`,
    `A${r},${r} 0 ${large} 1 ${px(50, r, a1).toFixed(2)},${py(50, r, a1).toFixed(2)}`,
    'Z',
  ].join(' ')
}

/** Hex color lerp for the handful of per-frame color blends. */
function hexLerp(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const r = Math.round(lerp(pa >> 16, pb >> 16, t))
  const g = Math.round(lerp((pa >> 8) & 0xff, (pb >> 8) & 0xff, t))
  const bl = Math.round(lerp(pa & 0xff, pb & 0xff, t))
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`
}

/* ------------------------------------------------------------------ */
/* Precomputed geometry — deterministic seeds, evaluated once.         */
/* ------------------------------------------------------------------ */

// ---- Ring chrome ----
const TICKS = 72
const TICK_GEO = Array.from({ length: TICKS }, (_, i) => {
  const a = (i / TICKS) * TAU + TOP
  const major = i % 6 === 0
  const r0 = major ? 42.2 : 43.0
  const r1 = 44.6
  return {
    x1: px(50, r0, a),
    y1: py(50, r0, a),
    x2: px(50, r1, a),
    y2: py(50, r1, a),
    major,
  }
})

const STAGE_MARKS = Array.from({ length: STAGE_COUNT }, (_, i) => {
  const a = (i / STAGE_COUNT) * TAU + TOP
  return {
    x1: px(50, 45.6, a),
    y1: py(50, 45.6, a),
    x2: px(50, 47.6, a),
    y2: py(50, 47.6, a),
    // Numeral sits outside the ring, swung into its slice far enough to
    // clear the centered PIPELINE/STAGE DOM labels at 12 and 6 o'clock.
    lx: px(50, 49.2, a + 0.28),
    ly: py(50, 49.2, a + 0.28) + 1.1,
  }
})

// ---- SCAN: radar platter ----
const SCAN_RINGS = [9, 16, 23, 29]
const SCAN_DOTS = (() => {
  const rand = mulberry32(20260718)
  return Array.from({ length: 44 }, () => {
    const radius = Math.sqrt(rand()) * 26 + 2.5
    const angle = rand() * TAU
    return { x: px(50, radius, angle), y: py(50, radius, angle), a: angle }
  })
})()
const SCAN_TURNS = 3.5
/** Comet tail behind the hand: 6 wedges, 7° each, fading. */
const SCAN_TAIL = [0.28, 0.2, 0.14, 0.09, 0.05, 0.02]
const SCAN_TAIL_STEP = (7 / 360) * TAU

// ---- MAP: tiles assembling into a squarified treemap ----
const MAP_FRAME = { x: 23, y: 31, w: 54, h: 38 }
const MAP_TILES = (() => {
  const rand = mulberry32(20260719)
  const items = Array.from({ length: 22 }, (_, i) => ({
    id: String(i),
    value: Math.pow(rand(), 2.4) * 99 + 1,
  }))
  const rects = squarify(items, MAP_FRAME.x, MAP_FRAME.y, MAP_FRAME.w, MAP_FRAME.h)
  const total = rects.reduce((s, r) => s + r.value, 0)
  let cumulative = 0
  return rects.map((r, k) => {
    cumulative += r.value
    const share = cumulative / total
    // Grout: shrink 4% about the tile center so void lines the seams.
    const gx = r.x + r.w * 0.02
    const gy = r.y + r.h * 0.02
    const gw = r.w * 0.96
    const gh = r.h * 0.96
    return {
      x: gx,
      y: gy,
      w: gw,
      h: gh,
      cx: gx + gw / 2,
      cy: gy + gh / 2,
      fill: share <= 0.32 ? ROSE : share <= 0.62 ? AMBER : TEAL,
      // Sorted-desc ⇒ big tiles launch first; chaos start is a seeded fling.
      delay: (k / rects.length) * 0.55,
      dx: (rand() - 0.5) * 46,
      dy: (rand() - 0.5) * 36,
      rot: (rand() - 0.5) * 140,
      phase: rand() * TAU,
    }
  })
})()

// ---- EXPLORE: the constant-mapping dive (2D port of the v1 math) ----
type ExploreGen = {
  rects: Array<{ x: number; y: number; w: number; h: number; fill: string }>
  target: { x: number; y: number; w: number; h: number }
  mapScale: { x: number; y: number }
  mapOffset: { x: number; y: number }
  zoomEnd: { x: number; y: number }
}
const EXPLORE_W = 54
const EXPLORE_H = 36
const EXPLORE_GENS: ExploreGen[] = Array.from({ length: 3 }, (_, g) => {
  const rand = mulberry32(2026_100 + g * 17)
  const items = Array.from({ length: 11 }, (_, i) => ({
    id: String(i),
    value: Math.pow(rand(), 1.9) * 88 + 4,
  }))
  const rects = squarify(items, -EXPLORE_W / 2, -EXPLORE_H / 2, EXPLORE_W, EXPLORE_H)

  // Dive target: a big tile whose aspect best matches the frame, so the zoom
  // lands without distortion.
  let target = rects[0]
  let best = Infinity
  for (const r of rects.slice(0, 6)) {
    const score = Math.abs(Math.log(r.w / r.h / (EXPLORE_W / EXPLORE_H)))
    if (score < best) {
      best = score
      target = r
    }
  }

  const total = rects.reduce((s, r) => s + r.value, 0)
  let cumulative = 0
  return {
    rects: rects.map((r) => {
      cumulative += r.value
      const share = cumulative / total
      return { x: r.x, y: r.y, w: r.w, h: r.h, fill: share <= 0.32 ? ROSE : share <= 0.62 ? AMBER : TEAL }
    }),
    target: { x: target.x, y: target.y, w: target.w, h: target.h },
    mapScale: { x: target.w / EXPLORE_W, y: target.h / EXPLORE_H },
    mapOffset: { x: target.x + target.w / 2, y: target.y + target.h / 2 },
    zoomEnd: { x: EXPLORE_W / target.w, y: EXPLORE_H / target.h },
  }
})

// ---- DETECT: constellation + duplicate links ----
const DETECT_EVENTS = 6 // five pairs + one triple
const DETECT_SPAN = 0.145
const DETECT_FIRST = 0.05
const DETECT_DOTS = (() => {
  const rand = mulberry32(20260721)
  const dots = Array.from({ length: 30 }, () => {
    const a = rand() * TAU
    const r = Math.sqrt(rand())
    return { x: 50 + Math.cos(a) * r * 26, y: 50 + Math.sin(a) * r * 17, event: -1 }
  })
  const shuffled = dots.map((_, i) => i)
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const edges: Array<{ event: number; a: number; b: number; d: string; pts: Array<[number, number]>; phase: number }> = []
  const makeEdge = (event: number, ai: number, bi: number) => {
    const A = dots[ai]
    const B = dots[bi]
    // Control point: midpoint pushed along the perpendicular so links arc
    // over the field instead of slicing through it.
    const mx = (A.x + B.x) / 2
    const my = (A.y + B.y) / 2
    const dx = B.x - A.x
    const dy = B.y - A.y
    const len = Math.hypot(dx, dy) || 1
    const lift = 4.5 + rand() * 4
    const side = my > 50 ? -1 : 1
    const cx = mx + (-dy / len) * lift * side
    const cy = my + (dx / len) * lift * side
    const pts: Array<[number, number]> = []
    for (let s = 0; s <= 32; s++) {
      const f = s / 32
      const inv = 1 - f
      pts.push([
        inv * inv * A.x + 2 * inv * f * cx + f * f * B.x,
        inv * inv * A.y + 2 * inv * f * cy + f * f * B.y,
      ])
    }
    edges.push({
      event,
      a: ai,
      b: bi,
      d: `M${A.x.toFixed(2)},${A.y.toFixed(2)} Q${cx.toFixed(2)},${cy.toFixed(2)} ${B.x.toFixed(2)},${B.y.toFixed(2)}`,
      pts,
      phase: rand(),
    })
  }
  for (let e = 0; e < 5; e++) {
    const a = shuffled[e * 2]
    const b = shuffled[e * 2 + 1]
    dots[a].event = e
    dots[b].event = e
    makeEdge(e, a, b)
  }
  const [t0, t1, t2] = [shuffled[10], shuffled[11], shuffled[12]]
  for (const m of [t0, t1, t2]) dots[m].event = 5
  makeEdge(5, t0, t1)
  makeEdge(5, t1, t2)
  makeEdge(5, t2, t0)
  return { dots, edges }
})()

// ---- RECLAIM: hog fragments, survivors re-layout, gauge sweeps ----
const RECLAIM_FRAME = { x: -27, y: -18, w: 54, h: 36 }
const RECLAIM = (() => {
  const rand = mulberry32(20260722)
  const items = Array.from({ length: 12 }, (_, i) => ({
    id: String(i),
    value: Math.pow(rand(), 2.1) * 90 + 3,
  }))
  const layoutA = squarify(items, RECLAIM_FRAME.x, RECLAIM_FRAME.y, RECLAIM_FRAME.w, RECLAIM_FRAME.h)
  const hog = layoutA[0]
  const survivors = layoutA.slice(1)
  const layoutB = squarify(
    survivors.map((r) => ({ id: r.id, value: r.value })),
    RECLAIM_FRAME.x,
    RECLAIM_FRAME.y,
    RECLAIM_FRAME.w,
    RECLAIM_FRAME.h,
  )
  const targetById = new Map(layoutB.map((r) => [r.id, r]))
  const total = survivors.reduce((s, r) => s + r.value, 0)
  let cumulative = 0
  const tiles = survivors.map((r) => {
    cumulative += r.value
    return {
      id: r.id,
      a: r,
      b: targetById.get(r.id)!,
      fill: cumulative / total <= 0.35 ? AMBER : TEAL,
    }
  })
  const particles = Array.from({ length: 22 }, () => ({
    x: hog.x + rand() * hog.w,
    y: hog.y + rand() * hog.h,
    vx: (rand() - 0.5) * 10,
    vy: -(12 + rand() * 14),
    jitter: 0.85 + 0.3 * rand(),
    phase: rand() * TAU,
  }))
  const sparks = Array.from({ length: 12 }, () => ({
    x: (rand() - 0.5) * 50,
    y: (rand() - 0.5) * 30,
    phase: rand() * TAU,
  }))
  return { hog, tiles, particles, sparks }
})()

/* ------------------------------------------------------------------ */
/* Component                                                            */
/* ------------------------------------------------------------------ */

type Refs = {
  spinner: SVGGElement | null
  arc: SVGCircleElement | null
  head: SVGCircleElement | null
  halo: SVGCircleElement | null
  ticks: Array<SVGLineElement | null>
  stageNums: Array<SVGTextElement | null>
  vignette: SVGGElement | null
  stageGroups: Array<SVGGElement | null>
  // scan
  scanRings: Array<SVGCircleElement | null>
  scanSweep: SVGGElement | null
  scanDots: Array<SVGCircleElement | null>
  scanTip: SVGCircleElement | null
  // map
  mapTiles: Array<SVGRectElement | null>
  mapFrame: SVGRectElement | null
  // explore
  exploreZoom: SVGGElement | null
  exploreGens: Array<SVGGElement | null>
  exploreFills: Array<Array<SVGRectElement | null>>
  exploreLines: Array<Array<SVGRectElement | null>>
  explorePulses: Array<SVGRectElement | null>
  // detect
  detectDots: Array<SVGCircleElement | null>
  detectEdges: Array<SVGPathElement | null>
  detectPulses: Array<SVGCircleElement | null>
  // reclaim
  reclaimHog: SVGRectElement | null
  reclaimTiles: Array<SVGRectElement | null>
  reclaimParticles: Array<SVGCircleElement | null>
  reclaimGauge: SVGCircleElement | null
  reclaimTrack: SVGCircleElement | null
  reclaimSparks: Array<SVGCircleElement | null>
}

export default function ProcessDial() {
  const refs = useRef<Refs>({
    spinner: null,
    arc: null,
    head: null,
    halo: null,
    ticks: [],
    stageNums: [],
    vignette: null,
    stageGroups: [],
    scanRings: [],
    scanSweep: null,
    scanDots: [],
    scanTip: null,
    mapTiles: [],
    mapFrame: null,
    exploreZoom: null,
    exploreGens: [],
    exploreFills: EXPLORE_GENS.map(() => []),
    exploreLines: EXPLORE_GENS.map(() => []),
    explorePulses: [],
    detectDots: [],
    detectEdges: [],
    detectPulses: [],
    reclaimHog: null,
    reclaimTiles: [],
    reclaimParticles: [],
    reclaimGauge: null,
    reclaimTrack: null,
    reclaimSparks: [],
  })
  const lastStage = useRef(-1)

  useEffect(() => {
    const R = refs.current

    const update = () => {
      const t = processState.progress
      const time = gsap.ticker.time

      /* ---- Ring chrome ---- */
      if (R.spinner) {
        R.spinner.setAttribute('transform', `rotate(${((time * 4) % 360).toFixed(2)} 50 50)`)
      }

      const stage = Math.min(STAGE_COUNT - 1, Math.floor(t * STAGE_COUNT))
      const accent =
        t * STAGE_COUNT - stage > 0.82 && stage < STAGE_COUNT - 1
          ? hexLerp(ACCENTS[stage], ACCENTS[stage + 1], (t * STAGE_COUNT - stage - 0.82) / 0.18)
          : ACCENTS[stage]

      if (R.arc) {
        R.arc.style.strokeDashoffset = String(100 - t * 100)
        R.arc.setAttribute('stroke', accent)
      }
      const headAngle = TOP + t * TAU
      if (R.head) {
        R.head.setAttribute('cx', px(50, 46, headAngle).toFixed(2))
        R.head.setAttribute('cy', py(50, 46, headAngle).toFixed(2))
        R.head.setAttribute('fill', accent)
        R.head.style.opacity = t > 0.002 ? '1' : '0'
      }
      if (R.halo) {
        R.halo.setAttribute('cx', px(50, 46, headAngle).toFixed(2))
        R.halo.setAttribute('cy', py(50, 46, headAngle).toFixed(2))
        R.halo.setAttribute('fill', accent)
        R.halo.style.opacity = t > 0.002 ? String(0.22 + 0.1 * Math.sin(time * 3)) : '0'
      }

      const lit = t * TICKS
      for (let i = 0; i < TICKS; i++) {
        const tick = R.ticks[i]
        if (!tick) continue
        if (i < lit - 1) {
          tick.setAttribute('stroke', TEAL)
          tick.style.strokeOpacity = '0.75'
        } else if (i <= lit) {
          tick.setAttribute('stroke', accent)
          tick.style.strokeOpacity = '1'
        } else {
          tick.setAttribute('stroke', CHROME_DIM)
          tick.style.strokeOpacity = TICK_GEO[i].major ? '0.6' : '0.4'
        }
      }

      if (stage !== lastStage.current) {
        lastStage.current = stage
        for (let i = 0; i < STAGE_COUNT; i++) {
          const num = R.stageNums[i]
          if (!num) continue
          if (i === stage) {
            num.setAttribute('fill', ACCENTS[i])
            num.style.opacity = '1'
          } else if (i < stage) {
            num.setAttribute('fill', TEAL)
            num.style.opacity = '0.55'
          } else {
            num.setAttribute('fill', CHROME)
            num.style.opacity = '0.4'
          }
        }
      }

      /* ---- Vignette layer: breathing + per-stage windows ---- */
      if (R.vignette) {
        const breathe = Math.sin(t * TAU) * 2.2 + Math.sin(time * 0.16) * 1.1
        R.vignette.setAttribute('transform', `rotate(${breathe.toFixed(2)} 50 50)`)
      }

      for (let i = 0; i < STAGE_COUNT; i++) {
        const group = R.stageGroups[i]
        if (!group) continue
        const { p, active } = stageWindow(i, t)
        if (active < 0.001) {
          group.style.display = 'none'
          continue
        }
        group.style.display = ''
        const aEase = easeOutCubic(active)
        group.style.opacity = String(aEase)
        const scale = 0.86 + 0.14 * aEase
        group.setAttribute(
          'transform',
          `translate(50 50) scale(${scale.toFixed(3)}) translate(-50 -50)`,
        )

        if (i === 0) updateScan(R, p, aEase, time)
        else if (i === 1) updateMap(R, p, time)
        else if (i === 2) updateExplore(R, p, time)
        else if (i === 3) updateDetect(R, p, time)
        else updateReclaim(R, p, time)
      }
    }

    // Always ticking while mounted — v1 gated its canvas on a lifecycle
    // ScrollTrigger and a spurious toggle froze the dial mid-scroll ("the
    // animation stops"). The whole update is ~150 string writes against a
    // mostly display:none tree, so running it unconditionally costs nothing
    // and there is no state machine left to wedge.
    update()
    gsap.ticker.add(update)
    return () => gsap.ticker.remove(update)
  }, [])

  /* ---- Static SVG structure; every animated node carries a ref. ---- */
  const R = refs.current
  return (
    <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
      {/* Backplate: the dial owns its pixels — the story field can't muddy it. */}
      <circle cx="50" cy="50" r="40" fill={PLATE} opacity="0.82" />
      <circle cx="50" cy="50" r="40" fill="none" stroke={GRID} strokeWidth="0.35" opacity="0.9" />
      <circle cx="50" cy="50" r="36.5" fill="none" stroke={GRID} strokeWidth="0.25" opacity="0.6" />

      {/* Rotating bezel: three faint arcs, the dial's idle heartbeat. */}
      <g
        ref={(el) => {
          R.spinner = el
        }}
      >
        {[0, 120, 240].map((deg) => {
          const a0 = (deg / 360) * TAU + TOP
          const a1 = a0 + (34 / 360) * TAU
          return (
            <path
              key={deg}
              d={`M${px(50, 38.2, a0).toFixed(2)},${py(50, 38.2, a0).toFixed(2)} A38.2,38.2 0 0 1 ${px(50, 38.2, a1).toFixed(2)},${py(50, 38.2, a1).toFixed(2)}`}
              fill="none"
              stroke={CHROME_DIM}
              strokeWidth="0.3"
              opacity="0.5"
            />
          )
        })}
      </g>

      {/* Fixed tick scale. */}
      {TICK_GEO.map((tick, i) => (
        <line
          key={i}
          ref={(el) => {
            R.ticks[i] = el
          }}
          x1={tick.x1.toFixed(2)}
          y1={tick.y1.toFixed(2)}
          x2={tick.x2.toFixed(2)}
          y2={tick.y2.toFixed(2)}
          stroke={CHROME_DIM}
          strokeWidth={tick.major ? 0.55 : 0.35}
          strokeOpacity={tick.major ? 0.6 : 0.4}
        />
      ))}

      {/* Track + progress arc (pathLength keeps the dash math exact). */}
      <circle cx="50" cy="50" r="46" fill="none" stroke={GRID} strokeWidth="0.45" opacity="0.9" />
      <circle
        ref={(el) => {
          R.arc = el
        }}
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke={TEAL}
        strokeWidth="1"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray="100"
        style={{ strokeDashoffset: 100 }}
        transform="rotate(-90 50 50)"
      />
      <circle
        ref={(el) => {
          R.halo = el
        }}
        r="2.4"
        fill={TEAL}
        style={{ opacity: 0 }}
      />
      <circle
        ref={(el) => {
          R.head = el
        }}
        r="1.05"
        fill={TEAL}
        style={{ opacity: 0 }}
      />

      {/* Stage boundaries + numerals. */}
      {STAGE_MARKS.map((mark, i) => (
        <g key={i}>
          <line
            x1={mark.x1.toFixed(2)}
            y1={mark.y1.toFixed(2)}
            x2={mark.x2.toFixed(2)}
            y2={mark.y2.toFixed(2)}
            stroke={CHROME}
            strokeWidth="0.4"
            opacity="0.7"
          />
          <text
            ref={(el) => {
              R.stageNums[i] = el
            }}
            x={mark.lx.toFixed(2)}
            y={mark.ly.toFixed(2)}
            fill={CHROME}
            opacity="0.4"
            fontSize="3"
            fontFamily="ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace"
            textAnchor="middle"
          >
            0{i + 1}
          </text>
        </g>
      ))}

      {/* -------- Stage vignettes -------- */}
      <g
        ref={(el) => {
          R.vignette = el
        }}
      >
        {/* SCAN */}
        <g
          ref={(el) => {
            R.stageGroups[0] = el
          }}
          style={{ display: 'none' }}
        >
          {SCAN_RINGS.map((radius, k) => (
            <circle
              key={radius}
              ref={(el) => {
                R.scanRings[k] = el
              }}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={CHROME_DIM}
              strokeWidth="0.3"
              opacity="0.55"
            />
          ))}
          <line x1="50" y1="21" x2="50" y2="79" stroke={CHROME_DIM} strokeWidth="0.25" opacity="0.3" />
          <line x1="21" y1="50" x2="79" y2="50" stroke={CHROME_DIM} strokeWidth="0.25" opacity="0.3" />
          {SCAN_DOTS.map((dot, k) => (
            <circle
              key={k}
              ref={(el) => {
                R.scanDots[k] = el
              }}
              cx={dot.x.toFixed(2)}
              cy={dot.y.toFixed(2)}
              r="0.55"
              fill={TEAL}
              style={{ opacity: 0.14 }}
            />
          ))}
          <g
            ref={(el) => {
              R.scanSweep = el
            }}
          >
            {SCAN_TAIL.map((alpha, k) => (
              <path
                key={k}
                d={wedgePath(TOP - (k + 1) * SCAN_TAIL_STEP, TOP - k * SCAN_TAIL_STEP, 28.4)}
                fill={TEAL}
                opacity={alpha}
              />
            ))}
            <line x1="50" y1="48" x2="50" y2="21.6" stroke="#8ff7ea" strokeWidth="0.6" strokeLinecap="round" />
            <circle
              ref={(el) => {
                R.scanTip = el
              }}
              cx="50"
              cy="21.6"
              r="0.9"
              fill="#8ff7ea"
            />
          </g>
          <circle cx="50" cy="50" r="1" fill={CHROME} opacity="0.8" />
        </g>

        {/* MAP */}
        <g
          ref={(el) => {
            R.stageGroups[1] = el
          }}
          style={{ display: 'none' }}
        >
          <rect
            ref={(el) => {
              R.mapFrame = el
            }}
            x={MAP_FRAME.x - 1.2}
            y={MAP_FRAME.y - 1.2}
            width={MAP_FRAME.w + 2.4}
            height={MAP_FRAME.h + 2.4}
            rx="1.4"
            fill="none"
            stroke={GRID}
            strokeWidth="0.35"
            style={{ opacity: 0 }}
          />
          {MAP_TILES.map((tile, k) => (
            <rect
              key={k}
              ref={(el) => {
                R.mapTiles[k] = el
              }}
              x={tile.x.toFixed(2)}
              y={tile.y.toFixed(2)}
              width={tile.w.toFixed(2)}
              height={tile.h.toFixed(2)}
              rx="0.7"
              fill={tile.fill}
              stroke={FLASH}
              strokeWidth="0.45"
              style={{ opacity: 0, strokeOpacity: 0 }}
            />
          ))}
        </g>

        {/* EXPLORE */}
        <g
          ref={(el) => {
            R.stageGroups[2] = el
          }}
          style={{ display: 'none' }}
        >
          <g transform="translate(50 50)">
            <g
              ref={(el) => {
                R.exploreZoom = el
              }}
            >
              {EXPLORE_GENS.map((gen, g) => (
                <g
                  key={g}
                  ref={(el) => {
                    R.exploreGens[g] = el
                  }}
                  style={{ display: 'none' }}
                >
                  {gen.rects.map((r, k) => (
                    <rect
                      key={`f${k}`}
                      ref={(el) => {
                        R.exploreFills[g][k] = el
                      }}
                      x={r.x.toFixed(2)}
                      y={r.y.toFixed(2)}
                      width={r.w.toFixed(2)}
                      height={r.h.toFixed(2)}
                      fill={r.fill}
                      style={{ opacity: 0 }}
                    />
                  ))}
                  {gen.rects.map((r, k) => (
                    <rect
                      key={`l${k}`}
                      ref={(el) => {
                        R.exploreLines[g][k] = el
                      }}
                      x={r.x.toFixed(2)}
                      y={r.y.toFixed(2)}
                      width={r.w.toFixed(2)}
                      height={r.h.toFixed(2)}
                      fill="none"
                      stroke={CHROME}
                      strokeWidth="0.32"
                      style={{ opacity: 0 }}
                    />
                  ))}
                  <rect
                    ref={(el) => {
                      R.explorePulses[g] = el
                    }}
                    x={(gen.target.x + gen.target.w * 0.02).toFixed(2)}
                    y={(gen.target.y + gen.target.h * 0.02).toFixed(2)}
                    width={(gen.target.w * 0.96).toFixed(2)}
                    height={(gen.target.h * 0.96).toFixed(2)}
                    fill={AMBER}
                    style={{ opacity: 0 }}
                  />
                </g>
              ))}
            </g>
          </g>
        </g>

        {/* DETECT */}
        <g
          ref={(el) => {
            R.stageGroups[3] = el
          }}
          style={{ display: 'none' }}
        >
          {DETECT_DOTS.edges.map((edge, k) => (
            <path
              key={k}
              ref={(el) => {
                R.detectEdges[k] = el
              }}
              d={edge.d}
              fill="none"
              stroke={AMBER}
              strokeWidth="0.4"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray="100"
              style={{ strokeDashoffset: 100, opacity: 0 }}
            />
          ))}
          {DETECT_DOTS.dots.map((dot, k) => (
            <circle
              key={k}
              ref={(el) => {
                R.detectDots[k] = el
              }}
              cx={dot.x.toFixed(2)}
              cy={dot.y.toFixed(2)}
              r="0.9"
              fill="#232f4c"
            />
          ))}
          {DETECT_DOTS.edges.map((_, k) => (
            <circle
              key={k}
              ref={(el) => {
                R.detectPulses[k] = el
              }}
              r="0.55"
              fill="#ffffff"
              style={{ opacity: 0 }}
            />
          ))}
        </g>

        {/* RECLAIM */}
        <g
          ref={(el) => {
            R.stageGroups[4] = el
          }}
          style={{ display: 'none' }}
        >
          <circle
            ref={(el) => {
              R.reclaimTrack = el
            }}
            cx="50"
            cy="50"
            r="31.5"
            fill="none"
            stroke={GRID}
            strokeWidth="0.5"
            style={{ opacity: 0 }}
          />
          <circle
            ref={(el) => {
              R.reclaimGauge = el
            }}
            cx="50"
            cy="50"
            r="31.5"
            fill="none"
            stroke={TEAL}
            strokeWidth="0.9"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray="100"
            style={{ strokeDashoffset: 100, opacity: 0 }}
            transform="rotate(-90 50 50)"
          />
          <g transform="translate(50 50)">
            <rect
              ref={(el) => {
                R.reclaimHog = el
              }}
              x={RECLAIM.hog.x.toFixed(2)}
              y={RECLAIM.hog.y.toFixed(2)}
              width={RECLAIM.hog.w.toFixed(2)}
              height={RECLAIM.hog.h.toFixed(2)}
              rx="0.7"
              fill={ROSE}
            />
            {RECLAIM.tiles.map((tile, k) => (
              <rect
                key={tile.id}
                ref={(el) => {
                  R.reclaimTiles[k] = el
                }}
                rx="0.7"
                fill={tile.fill}
                stroke={FLASH}
                strokeWidth="0.4"
                style={{ strokeOpacity: 0 }}
              />
            ))}
            {RECLAIM.particles.map((_, k) => (
              <circle
                key={k}
                ref={(el) => {
                  R.reclaimParticles[k] = el
                }}
                r="0.5"
                fill={ROSE}
                style={{ opacity: 0 }}
              />
            ))}
            {RECLAIM.sparks.map((_, k) => (
              <circle
                key={k}
                ref={(el) => {
                  R.reclaimSparks[k] = el
                }}
                r="0.4"
                fill="#ffffff"
                style={{ opacity: 0 }}
              />
            ))}
          </g>
        </g>
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/* Per-stage frame updates — pure functions of (p, time).               */
/* ------------------------------------------------------------------ */

function updateScan(R: Refs, p: number, aEase: number, time: number) {
  // Rings stagger in with a little overshoot.
  for (let k = 0; k < SCAN_RINGS.length; k++) {
    const ring = R.scanRings[k]
    if (!ring) continue
    const s = Math.max(0.001, easeOutBack(clamp01(aEase * 1.7 - k * 0.14)))
    ring.setAttribute('transform', `translate(50 50) scale(${s.toFixed(3)}) translate(-50 -50)`)
  }

  // 3.5 revolutions scrubbed across the stage + drift so it never rests.
  const sweep = p * SCAN_TURNS * 360 + time * 9
  if (R.scanSweep) {
    R.scanSweep.setAttribute('transform', `rotate(${(sweep % 360).toFixed(2)} 50 50)`)
  }

  // Radar paint: dots spike at the beam and decay behind it.
  const beam = ((sweep / 360) * TAU + TOP) % TAU
  for (let k = 0; k < SCAN_DOTS.length; k++) {
    const dot = R.scanDots[k]
    if (!dot) continue
    let delta = (beam - SCAN_DOTS[k].a) % TAU
    if (delta < 0) delta += TAU
    // Early passes barely mark the disk; late passes leave it lit.
    const glow = Math.exp(-delta * (2.6 - p * 1.5))
    dot.style.opacity = (0.14 + 0.86 * Math.min(1, glow * 1.3)).toFixed(3)
    dot.setAttribute('r', (0.55 + glow * 0.55).toFixed(2))
  }
}

function updateMap(R: Refs, p: number, time: number) {
  const assembly = clamp01(p * 1.12)
  if (R.mapFrame) R.mapFrame.style.opacity = (0.9 * smoothstep(0.05, 0.25, assembly)).toFixed(3)

  for (let k = 0; k < MAP_TILES.length; k++) {
    const rect = R.mapTiles[k]
    if (!rect) continue
    const tile = MAP_TILES[k]
    const local = clamp01((assembly - tile.delay) / 0.45)
    const move = easeOutBack(local)
    const grow = easeOutCubic(local)
    const settled = local >= 1
    const dx = tile.dx * (1 - move)
    const dy = tile.dy * (1 - move) + (settled ? Math.sin(time * 1.3 + tile.cx * 0.12 + tile.phase * 0.3) * 0.35 : 0)
    const rot = tile.rot * (1 - move)
    const s = lerp(0.12, 1, grow)
    rect.setAttribute(
      'transform',
      `translate(${(tile.cx + dx).toFixed(2)} ${(tile.cy + dy).toFixed(2)}) rotate(${rot.toFixed(1)}) scale(${s.toFixed(3)}) translate(${(-tile.cx).toFixed(2)} ${(-tile.cy).toFixed(2)})`,
    )
    rect.style.opacity = Math.min(1, local * 2.2).toFixed(3)
    // White edge kiss right at touchdown.
    const flashDist = (local - 0.93) / 0.05
    const flash = local > 0.6 && local < 1 ? Math.exp(-flashDist * flashDist) : 0
    rect.style.strokeOpacity = (flash * 0.9).toFixed(3)
  }
}

function updateExplore(R: Refs, p: number, time: number) {
  // Two dives across the stage; generation g maps into g-1's target tile.
  const dv = p * 2
  const dive = Math.min(EXPLORE_GENS.length - 2, Math.floor(dv))
  const d = easeInOutCubic(clamp01(dv - dive))
  const parent = EXPLORE_GENS[dive]

  const sx = Math.exp(d * Math.log(parent.zoomEnd.x))
  const sy = Math.exp(d * Math.log(parent.zoomEnd.y))
  if (R.exploreZoom) {
    R.exploreZoom.setAttribute(
      'transform',
      `translate(${(-parent.mapOffset.x * d * sx).toFixed(3)} ${(-parent.mapOffset.y * d * sy).toFixed(3)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)})`,
    )
  }

  for (let g = 0; g < EXPLORE_GENS.length; g++) {
    const group = R.exploreGens[g]
    if (!group) continue
    const isParent = g === dive
    const isChild = g === dive + 1
    if (!isParent && !isChild) {
      group.style.display = 'none'
      continue
    }
    group.style.display = ''
    group.setAttribute(
      'transform',
      isChild
        ? `translate(${parent.mapOffset.x.toFixed(3)} ${parent.mapOffset.y.toFixed(3)}) scale(${parent.mapScale.x.toFixed(4)} ${parent.mapScale.y.toFixed(4)})`
        : 'translate(0 0)',
    )

    let fillO: number
    let lineO: number
    let pulseO = 0
    let pulseFill = AMBER
    if (isParent) {
      fillO = 0.2 * (1 - d * 0.92)
      lineO = 0.85 * (1 - smoothstep(0.62, 1, d))
      const anticipation = 1 - smoothstep(0.45, 0.72, d)
      const pulse = (0.16 + 0.09 * Math.sin(time * 2.8)) * anticipation
      const punch = smoothstep(0.55, 0.85, d) * (1 - smoothstep(0.85, 1, d))
      pulseFill = hexLerp(AMBER, ROSE, smoothstep(0.5, 0.8, d))
      pulseO = pulse + punch * 0.3
    } else {
      fillO = 0.2 * smoothstep(0.12, 0.5, d)
      lineO = 0.85 * smoothstep(0.05, 0.4, d)
    }
    for (const rect of R.exploreFills[g]) if (rect) rect.style.opacity = fillO.toFixed(3)
    for (const rect of R.exploreLines[g]) if (rect) rect.style.opacity = lineO.toFixed(3)
    const pulseRect = R.explorePulses[g]
    if (pulseRect) {
      pulseRect.style.opacity = pulseO.toFixed(3)
      pulseRect.setAttribute('fill', pulseFill)
    }
  }
}

function updateDetect(R: Refs, p: number, time: number) {
  const detectT = clamp01((p - DETECT_FIRST) / (DETECT_EVENTS * DETECT_SPAN))
  const finale = smoothstep(0.9, 0.97, p) * (0.5 + 0.5 * Math.sin(time * 3))

  for (let k = 0; k < DETECT_DOTS.dots.length; k++) {
    const dot = R.detectDots[k]
    if (!dot) continue
    const info = DETECT_DOTS.dots[k]
    if (info.event < 0) {
      // Bystanders sink back as the hunt narrows.
      dot.setAttribute('fill', '#232f4c')
      dot.style.opacity = (1 - detectT * 0.6).toFixed(3)
      dot.setAttribute('r', '0.9')
    } else {
      const start = DETECT_FIRST + info.event * DETECT_SPAN
      const ignite = smoothstep(start, start + 0.04, p)
      const lock = smoothstep(start + 0.07, start + 0.11, p)
      let fill = hexLerp('#232f4c', AMBER, ignite)
      if (lock > 0) fill = hexLerp(fill, ROSE, lock)
      const shimmer = lock * clamp01(0.12 * Math.sin(time * 2.2 + k) + finale * 0.4)
      if (shimmer > 0) fill = hexLerp(fill, '#ffffff', shimmer)
      dot.setAttribute('fill', fill)
      dot.style.opacity = '1'
      dot.setAttribute('r', (0.9 + ignite * 0.5).toFixed(2))
    }
  }

  for (let k = 0; k < DETECT_DOTS.edges.length; k++) {
    const path = R.detectEdges[k]
    if (!path) continue
    const edge = DETECT_DOTS.edges[k]
    const start = DETECT_FIRST + edge.event * DETECT_SPAN + 0.04
    const draw = smoothstep(start, start + 0.09, p)
    path.style.strokeDashoffset = String(100 - draw * 100)
    path.setAttribute('stroke', hexLerp(AMBER, ROSE, smoothstep(start + 0.05, start + 0.1, p)))
    path.style.opacity = ((0.55 + 0.3 * finale) * draw).toFixed(3)

    const pulse = R.detectPulses[k]
    if (!pulse) continue
    if (draw >= 1) {
      const f = (time * 0.35 + edge.phase) % 1
      const pt = edge.pts[Math.min(edge.pts.length - 1, Math.floor(f * edge.pts.length))]
      pulse.setAttribute('cx', pt[0].toFixed(2))
      pulse.setAttribute('cy', pt[1].toFixed(2))
      pulse.style.opacity = '0.9'
    } else {
      pulse.style.opacity = '0'
    }
  }
}

function updateReclaim(R: Refs, p: number, time: number) {
  const frag = smoothstep(0.14, 0.6, p)
  const glide = smoothstep(0.35, 0.82, p)
  const gauge = smoothstep(0.42, 0.96, p)

  // The hog collapses as its particles carry its mass away.
  if (R.reclaimHog) {
    const collapse = 1 - smoothstep(0.14, 0.3, p)
    const cx = RECLAIM.hog.x + RECLAIM.hog.w / 2
    const cy = RECLAIM.hog.y + RECLAIM.hog.h / 2
    R.reclaimHog.setAttribute(
      'transform',
      `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${Math.max(collapse, 0.001).toFixed(3)}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`,
    )
    R.reclaimHog.setAttribute('fill', hexLerp(ROSE, '#ffffff', smoothstep(0.14, 0.24, p) * 0.5))
    R.reclaimHog.style.opacity = collapse > 0.002 ? '1' : '0'
  }

  // Survivors glide to their re-layout homes (a real second squarify pass).
  for (let k = 0; k < RECLAIM.tiles.length; k++) {
    const rect = R.reclaimTiles[k]
    if (!rect) continue
    const tile = RECLAIM.tiles[k]
    const local = easeInOutCubic(clamp01(glide * 1.25 - (k / RECLAIM.tiles.length) * 0.25))
    const x = lerp(tile.a.x, tile.b.x, local)
    const y = lerp(tile.a.y, tile.b.y, local)
    const w = lerp(tile.a.w, tile.b.w, local)
    const h = lerp(tile.a.h, tile.b.h, local)
    rect.setAttribute('x', (x + w * 0.02).toFixed(2))
    rect.setAttribute('y', (y + h * 0.02).toFixed(2))
    rect.setAttribute('width', (w * 0.96).toFixed(2))
    rect.setAttribute('height', (h * 0.96).toFixed(2))
    const settleFlash = Math.exp(-Math.pow((local - 0.94) / 0.05, 2))
    rect.style.strokeOpacity = (local > 0.6 && local < 1 ? settleFlash * 0.6 : 0).toFixed(3)
  }

  // Fragment plume: rises, drifts, dissolves.
  const gate = smoothstep(0.12, 0.2, p)
  for (let k = 0; k < RECLAIM.particles.length; k++) {
    const dot = R.reclaimParticles[k]
    if (!dot) continue
    const part = RECLAIM.particles[k]
    const f = clamp01(frag * 1.15 * part.jitter)
    dot.setAttribute('cx', (part.x + part.vx * f + Math.sin(f * TAU + part.phase) * 1.4 * f).toFixed(2))
    dot.setAttribute('cy', (part.y + part.vy * f).toFixed(2))
    dot.setAttribute('fill', hexLerp(ROSE, '#ffffff', Math.min(1, f * 1.6)))
    dot.style.opacity = (gate * Math.pow(1 - f, 1.4)).toFixed(3)
  }

  // Rim gauge sweeps to 100%, then glimmers.
  if (R.reclaimGauge) {
    R.reclaimGauge.style.strokeDashoffset = String(100 - gauge * 100)
    R.reclaimGauge.style.opacity = (0.7 + 0.15 * Math.sin(time * 2) * smoothstep(0.9, 1, gauge)).toFixed(3)
  }
  if (R.reclaimTrack) {
    R.reclaimTrack.style.opacity = (0.4 * smoothstep(0.3, 0.5, p)).toFixed(3)
  }

  // Celebration sparks drift up forever once the space is reclaimed.
  const sparkGate = smoothstep(0.82, 0.95, p)
  for (let k = 0; k < RECLAIM.sparks.length; k++) {
    const dot = R.reclaimSparks[k]
    if (!dot) continue
    const spark = RECLAIM.sparks[k]
    const rise = (time * 0.12 + spark.phase / TAU) % 1
    dot.setAttribute('cx', (spark.x + Math.sin(time * 0.4 + spark.phase) * 1.2).toFixed(2))
    dot.setAttribute('cy', (spark.y - rise * 14).toFixed(2))
    dot.style.opacity = (sparkGate * 0.6 * (1 - rise)).toFixed(3)
  }
}
