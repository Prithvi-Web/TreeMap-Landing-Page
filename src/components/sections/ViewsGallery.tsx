import { useLayoutEffect, useRef } from 'react'
import { gsap } from '../../lib/gsapSetup'
import { clamp01 } from '../../lib/stages'

/**
 * FIVE VIEWS — a pinned horizontal gallery (§Kinetic-Max 2). The viewport
 * pins while a track of five view-cards slides through it; each card carries
 * a hand-built animated vignette of the real app surface it describes.
 *
 * One master ScrollTrigger owns the pin and the track; every vignette is
 * driven from that single onUpdate via a per-panel "focus" value (how close
 * the panel is to viewport center), so there are no nested trigger-inside-
 * moving-container headaches and everything rewinds perfectly.
 *
 * Mobile: no pin — the same track becomes a native scroll-snap carousel.
 * Calm tier: a static vertical stack, vignettes at their final state.
 */

type Panel = {
  title: string
  copy: string
  accent: string
}

const PANELS: Panel[] = [
  {
    title: 'Treemap',
    copy: 'The classic: your whole disk as one picture, every tile weighted by the bytes it holds.',
    accent: '#2dd4bf',
  },
  {
    title: 'Sunburst',
    copy: 'The same truth as rings — folder depth radiating out from the root.',
    accent: '#fbbf24',
  },
  {
    title: 'Duplicates',
    copy: 'Byte-identical groups found by staged hashing — keep one, reclaim the rest.',
    accent: '#f43f5e',
  },
  {
    title: 'Trends',
    copy: 'Scan history over time, projected forward to the day this disk fills.',
    accent: '#2dd4bf',
  },
  {
    title: 'Compare',
    copy: 'Two scans, diffed — see exactly what grew while you weren’t looking.',
    accent: '#fbbf24',
  },
]

/** Hand-authored mini treemap mosaic (percent geometry, tier colors). */
const MOSAIC: Array<{ x: number; y: number; w: number; h: number; c: string; pulse?: boolean }> = [
  { x: 0, y: 0, w: 38, h: 62, c: '#f43f5e', pulse: true },
  { x: 0, y: 64, w: 38, h: 36, c: '#fbbf24' },
  { x: 40, y: 0, w: 32, h: 40, c: '#fbbf24' },
  { x: 74, y: 0, w: 26, h: 40, c: '#2dd4bf' },
  { x: 40, y: 42, w: 20, h: 58, c: '#2dd4bf' },
  { x: 62, y: 42, w: 18, h: 34, c: '#2dd4bf' },
  { x: 82, y: 42, w: 18, h: 34, c: '#fbbf24' },
  { x: 62, y: 78, w: 38, h: 22, c: '#2dd4bf' },
]

/** Trends chart geometry (SVG viewBox 0 0 200 100). */
const TREND_POINTS: Array<[number, number]> = [
  [0, 78],
  [28, 72],
  [56, 74],
  [84, 60],
  [112, 52],
  [140, 40],
  [168, 30],
  [200, 18],
]
const TREND_PATH = TREND_POINTS.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
const TREND_LEN = 250 // slightly over actual length; dashoffset scrubs to 0

const COMPARE_BARS = [0.9, 0.62, 0.78, 0.5, 0.66]

export default function ViewsGallery({ reduced }: { reduced: boolean }) {
  const sectionRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLUListElement>(null)
  const panelRefs = useRef<Array<HTMLLIElement | null>>([])
  const hairlineRef = useRef<HTMLDivElement>(null)
  const counterRef = useRef<HTMLSpanElement>(null)
  const lastCounter = useRef(-1)

  useLayoutEffect(() => {
    if (reduced) return
    const section = sectionRef.current
    const pin = pinRef.current
    const track = trackRef.current
    if (!section || !pin || !track) return

    // Per-panel animated bits, queried once — updates are direct style writes.
    type Rig = {
      root: HTMLElement
      center: number
      vignette: HTMLElement | null
      tiles: HTMLElement[]
      rings: HTMLElement[]
      dash: SVGPathElement[]
      dot: HTMLElement | null
      tag: HTMLElement | null
      fill: HTMLElement | null
      barsL: HTMLElement[]
      barsR: HTMLElement[]
    }
    const rigs: Rig[] = []
    for (const root of panelRefs.current) {
      if (!root) continue
      rigs.push({
        root,
        center: 0,
        vignette: root.querySelector<HTMLElement>('[data-vignette]'),
        tiles: Array.from(root.querySelectorAll<HTMLElement>('[data-tile]')),
        rings: Array.from(root.querySelectorAll<HTMLElement>('[data-ring]')),
        dash: Array.from(root.querySelectorAll<SVGPathElement>('[data-dash]')),
        dot: root.querySelector<HTMLElement>('[data-dot]'),
        tag: root.querySelector<HTMLElement>('[data-tag]'),
        fill: root.querySelector<HTMLElement>('[data-fill]'),
        barsL: Array.from(root.querySelectorAll<HTMLElement>('[data-bar-l]')),
        barsR: Array.from(root.querySelectorAll<HTMLElement>('[data-bar-r]')),
      })
    }

    const measure = () => {
      for (const rig of rigs) {
        rig.center = rig.root.offsetLeft + rig.root.offsetWidth / 2
      }
    }

    const apply = (trackX: number) => {
      const viewCenter = -trackX + window.innerWidth / 2
      for (let i = 0; i < rigs.length; i++) {
        const rig = rigs[i]
        const dist = (rig.center - viewCenter) / window.innerWidth
        const focus = clamp01(1 - Math.abs(dist) * 1.55)
        const fEase = 1 - (1 - focus) * (1 - focus)

        // Counter-drift parallax: vignettes glide against the track.
        if (rig.vignette) {
          rig.vignette.style.transform = `translateX(${(dist * 34).toFixed(2)}px)`
        }
        // Treemap mosaic: tiles settle in stagger; handled for whichever
        // panel owns tiles (querySelector returns none elsewhere).
        for (let k = 0; k < rig.tiles.length; k++) {
          const s = 1 - (1 - clamp01(fEase * 1.5 - k * 0.07)) ** 3
          rig.tiles[k].style.transform = `scale(${s.toFixed(3)})`
          rig.tiles[k].style.opacity = String(s)
        }
        for (let k = 0; k < rig.rings.length; k++) {
          const s = clamp01(fEase * 1.4 - k * 0.15)
          rig.rings[k].style.opacity = String(s)
          rig.rings[k].style.scale = String(0.8 + 0.2 * s)
        }
        for (const path of rig.dash) {
          const len = Number(path.dataset.len ?? TREND_LEN)
          path.style.strokeDashoffset = String(len * (1 - fEase))
        }
        if (rig.dot) {
          // The marker rides the drawn end of the trend line.
          const seg = fEase * (TREND_POINTS.length - 1)
          const k = Math.min(TREND_POINTS.length - 2, Math.floor(seg))
          const f = seg - k
          const x = TREND_POINTS[k][0] + (TREND_POINTS[k + 1][0] - TREND_POINTS[k][0]) * f
          const y = TREND_POINTS[k][1] + (TREND_POINTS[k + 1][1] - TREND_POINTS[k][1]) * f
          rig.dot.style.transform = `translate(${x}px, ${y}px)`
          rig.dot.style.opacity = String(fEase)
        }
        if (rig.tag) {
          const on = clamp01((focus - 0.72) / 0.2)
          rig.tag.style.opacity = String(on)
          rig.tag.style.transform = `translateY(${(1 - on) * 8}px) rotate(${(1 - on) * -6}deg)`
        }
        if (rig.fill) {
          // The reclaimable bar sweeps in late, after its rows have landed.
          rig.fill.style.transform = `scaleX(${(0.62 * clamp01((focus - 0.4) / 0.5)).toFixed(3)})`
        }
        for (let k = 0; k < rig.barsL.length; k++) {
          const h = 1 - (1 - COMPARE_BARS[k]) * fEase - 0.28 * fEase
          rig.barsL[k].style.transform = `scaleY(${Math.max(0.08, h * COMPARE_BARS[k]).toFixed(3)})`
        }
        for (let k = 0; k < rig.barsR.length; k++) {
          rig.barsR[k].style.transform = `scaleY(${(0.15 + (COMPARE_BARS[k] - 0.15) * fEase).toFixed(3)})`
        }
      }

      // Progress hairline + counter.
      const total = track.scrollWidth - window.innerWidth
      const t = total > 0 ? clamp01(-trackX / total) : 0
      if (hairlineRef.current) hairlineRef.current.style.transform = `scaleX(${t.toFixed(4)})`
      const idx = Math.min(PANELS.length, Math.floor(t * PANELS.length) + 1)
      if (idx !== lastCounter.current && counterRef.current) {
        lastCounter.current = idx
        counterRef.current.textContent = `0${idx}`
      }
    }

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia()

      mm.add('(min-width: 768px)', () => {
        measure()
        const distance = () => track.scrollWidth - window.innerWidth
        // The fixed story field would blast through the glass cards at full
        // strength; duck it while the gallery owns the viewport (driven off
        // the pin's own progress, like the process rail does).
        const sceneRoot = document.getElementById('scene-root')
        const tween = gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: pin,
            start: 'top top',
            // ~1.9x the track distance: the panels glide instead of whipping past.
            end: () => `+=${Math.round(distance() * 1.9) + 600}`,
            pin: true,
            scrub: 1.5,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onRefresh: measure,
            onUpdate: (self) => {
              apply(Number(gsap.getProperty(track, 'x')))
              if (sceneRoot) {
                const duck =
                  clamp01(self.progress / 0.08) * (1 - clamp01((self.progress - 0.92) / 0.08))
                sceneRoot.style.opacity = (1 - 0.8 * duck).toFixed(3)
              }
            },
          },
        })
        apply(0)
        return () => {
          tween.scrollTrigger?.kill()
          tween.kill()
        }
      })

      mm.add('(max-width: 767px)', () => {
        // Native snap carousel: focus tracks the scroll position instead.
        measure()
        const onScroll = () => {
          // Reuse apply() by treating scrollLeft as -trackX.
          apply(-track.scrollLeft)
        }
        track.addEventListener('scroll', onScroll, { passive: true })
        onScroll()
        return () => track.removeEventListener('scroll', onScroll)
      })
    }, section)

    return () => ctx.revert()
  }, [reduced])

  const vignette = (i: number) => {
    const accent = PANELS[i].accent
    switch (i) {
      case 0: // Treemap mosaic
        return (
          <div data-vignette className="relative h-full w-full" aria-hidden="true">
            {MOSAIC.map((tile, k) => (
              <span
                key={k}
                data-tile={reduced ? undefined : ''}
                className={`absolute rounded-[3px] ${tile.pulse && !reduced ? 'vg-pulse' : ''}`}
                style={{
                  left: `${tile.x}%`,
                  top: `${tile.y}%`,
                  width: `${tile.w}%`,
                  height: `${tile.h}%`,
                  background: tile.c,
                  opacity: reduced ? 1 : undefined,
                }}
              />
            ))}
          </div>
        )
      case 1: // Sunburst rings — SVG stroke-dash donuts. (The first cut used
        // conic-gradients under a CSS radial mask; the mask silently failed in
        // testing and the rings rendered as giant filled pies. SVG cannot fail
        // that way: the ring IS the stroke.)
        return (
          <div data-vignette className="relative h-full w-full overflow-hidden" aria-hidden="true">
            <svg viewBox="0 0 200 200" className="mx-auto h-full" style={{ maxWidth: '100%' }}>
              {[
                { r: 78, w: 19, c: '#2dd4bf', dash: '88 26 120 34 150 72', dur: '64s', dir: 'normal', o: 0.85 },
                { r: 52, w: 17, c: '#fbbf24', dash: '70 24 96 40 60 37', dur: '46s', dir: 'reverse', o: 0.9 },
                { r: 30, w: 15, c: '#f43f5e', dash: '48 26 60 54', dur: '34s', dir: 'normal', o: 0.9 },
              ].map((ring, k) => (
                <g
                  key={k}
                  data-ring={reduced ? undefined : ''}
                  className={reduced ? undefined : 'vg-spin-svg'}
                  style={{
                    transformOrigin: '100px 100px',
                    animationDuration: ring.dur,
                    animationDirection: ring.dir as 'normal' | 'reverse',
                    opacity: reduced ? 1 : undefined,
                  }}
                >
                  <circle
                    cx="100"
                    cy="100"
                    r={ring.r}
                    fill="none"
                    stroke={ring.c}
                    strokeWidth={ring.w}
                    strokeDasharray={ring.dash}
                    opacity={ring.o}
                  />
                </g>
              ))}
              <circle cx="100" cy="100" r="7" fill="#2dd4bf" />
              <circle cx="100" cy="100" r="2.5" fill="#0a0f1c" />
            </svg>
            <span className="hud-mono absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.56rem] text-muted/60">
              DEPTH 0 — 3 · ROOT AT CENTER
            </span>
          </div>
        )
      case 2: {
        // Duplicates — a whole group resolution, not two lonely chips: three
        // copies of the same shot (keep the newest, trash the rest), the
        // arc that proved them identical, the group ledger, and the payoff bar.
        const thumbs = [
          { name: 'IMG_4021.heic', note: 'KEEP · NEWEST', ring: '#2dd4bf', grad: 'linear-gradient(135deg, #134e4a 0%, #2dd4bf 55%, #fbbf24 130%)' },
          { name: 'IMG_4021 copy.heic', note: 'TRASH', ring: '#f43f5e', grad: 'linear-gradient(135deg, #134e4a 0%, #2dd4bf 55%, #fbbf24 130%)' },
          { name: 'IMG_4021 (1).heic', note: 'TRASH', ring: '#f43f5e', grad: 'linear-gradient(135deg, #134e4a 0%, #2dd4bf 55%, #fbbf24 130%)' },
        ]
        const ledger = [
          ['group 07', '3 files', '2.4 GB'],
          ['group 12', '2 files', '1.1 GB'],
          ['group 19', '4 files', '3.8 GB'],
          ['group 23', '2 files', '0.9 GB'],
        ]
        return (
          <div data-vignette className="relative flex h-full w-full gap-[6%] overflow-hidden px-[4%] py-[3%]" aria-hidden="true">
            {/* The group being resolved. */}
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2.5">
              {thumbs.map((t, k) => (
                <div
                  key={t.name}
                  data-tile={reduced ? undefined : ''}
                  className="flex min-w-0 items-center gap-3"
                  style={reduced ? undefined : { opacity: 0 }}
                >
                  <span
                    className="h-11 w-14 shrink-0 rounded-lg border"
                    style={{
                      background: t.grad,
                      borderColor: t.ring,
                      filter: k === 0 ? 'none' : 'saturate(0.45) brightness(0.75)',
                    }}
                  />
                  <span className="hud-mono min-w-0 flex-1 truncate text-[0.6rem] text-white/85">{t.name}</span>
                  <span className="hud-mono shrink-0 text-[0.54rem]" style={{ color: t.ring }}>
                    {t.note}
                  </span>
                </div>
              ))}
              {/* The payoff. */}
              <div className="mt-2">
                <div className="hud-mono flex justify-between text-[0.56rem] text-muted/70">
                  <span>RECLAIMABLE</span>
                  <span className="text-rose">11.2 GB</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
                  <span
                    data-fill={reduced ? undefined : ''}
                    className="block h-full origin-left rounded-full"
                    style={{
                      background: 'linear-gradient(90deg, #f43f5e, #fbbf24)',
                      transform: reduced ? 'scaleX(0.62)' : 'scaleX(0)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* The proof + the ledger. */}
            <div className="relative flex w-[44%] shrink-0 flex-col justify-center gap-1.5">
              <svg viewBox="0 0 100 40" className="absolute -left-[24%] top-[8%] h-[34%] w-[52%] overflow-visible">
                <path
                  data-dash={reduced ? undefined : ''}
                  data-len="120"
                  d="M4,34 C 30,2 74,2 96,30"
                  fill="none"
                  stroke={accent}
                  strokeWidth="1.6"
                  strokeDasharray="120"
                  strokeDashoffset={reduced ? 0 : 120}
                />
              </svg>
              <span
                data-tag={reduced ? undefined : ''}
                className="hud-mono mb-1 self-start rounded-md border px-2 py-1 text-[0.58rem]"
                style={{ borderColor: accent, color: accent, opacity: reduced ? 1 : 0 }}
              >
                3× → 1× · SHA-256 MATCH
              </span>
              {ledger.map(([g, files, size]) => (
                <div
                  key={g}
                  data-tile={reduced ? undefined : ''}
                  className="hud-mono flex justify-between gap-2 rounded-md bg-white/[0.04] px-2.5 py-1.5 text-[0.56rem] text-muted/80"
                  style={reduced ? undefined : { opacity: 0 }}
                >
                  <span>{g}</span>
                  <span>{files}</span>
                  <span className="text-amber">{size}</span>
                </div>
              ))}
            </div>
          </div>
        )
      }
      case 3: // Trends
        return (
          <div data-vignette className="relative h-full w-full" aria-hidden="true">
            <svg viewBox="0 0 200 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
              <line x1="0" y1="14" x2="200" y2="14" stroke="#f43f5e" strokeWidth="0.8" strokeDasharray="4 3" opacity="0.65" />
              <path d={`${TREND_PATH} L200,100 L0,100 Z`} fill="url(#vg-trend-fill)" opacity="0.35" />
              <path
                data-dash={reduced ? undefined : ''}
                data-len={TREND_LEN}
                d={TREND_PATH}
                fill="none"
                stroke="#2dd4bf"
                strokeWidth="1.6"
                strokeDasharray={TREND_LEN}
                strokeDashoffset={reduced ? 0 : TREND_LEN}
              />
              <g data-dot={reduced ? undefined : ''} style={reduced ? { transform: 'translate(200px, 18px)' } : undefined}>
                <circle r="3" fill="#fbbf24" />
              </g>
              <defs>
                <linearGradient id="vg-trend-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2dd4bf" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#2dd4bf" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
            <span className="hud-mono absolute right-0 top-1 text-[0.56rem] text-rose/80">DISK FULL</span>
          </div>
        )
      default: // Compare
        return (
          <div data-vignette className="relative flex h-full w-full items-stretch gap-[6%] px-[6%] py-[8%]" aria-hidden="true">
            <div className="flex flex-1 items-end justify-around gap-[6%]">
              {COMPARE_BARS.map((h, k) => (
                <span
                  key={k}
                  data-bar-l={reduced ? undefined : ''}
                  className="w-full origin-bottom rounded-t-[3px] bg-amber/85"
                  style={{ height: '100%', transform: reduced ? `scaleY(${(h * 0.72).toFixed(2)})` : `scaleY(${h})` }}
                />
              ))}
            </div>
            <span className="w-px shrink-0 bg-white/15" />
            <div className="flex flex-1 items-end justify-around gap-[6%]">
              {COMPARE_BARS.map((h, k) => (
                <span
                  key={k}
                  data-bar-r={reduced ? undefined : ''}
                  className="w-full origin-bottom rounded-t-[3px] bg-teal/85"
                  style={{ height: '100%', transform: reduced ? `scaleY(${h})` : 'scaleY(0.15)' }}
                />
              ))}
            </div>
            <span className="hud-mono absolute bottom-1 left-[6%] text-[0.56rem] text-muted/60">JUN 02</span>
            <span className="hud-mono absolute bottom-1 right-[6%] text-[0.56rem] text-muted/60">JUL 18</span>
          </div>
        )
    }
  }

  const card = (panel: Panel, i: number) => (
    <li
      key={panel.title}
      ref={(el) => {
        panelRefs.current[i] = el
      }}
      className={
        reduced
          ? 'relative'
          : 'relative w-[min(78vw,52rem)] shrink-0 snap-center md:w-[min(64vw,52rem)]'
      }
    >
      {/* Giant outlined numeral behind the card. */}
      <span
        aria-hidden="true"
        data-text={`0${i + 1}`}
        className="marquee-outline-item pointer-events-none absolute -top-14 left-2 select-none font-bold"
        style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(5rem, 11vw, 9rem)', lineHeight: 1 }}
      />
      <div
        className="glass relative flex h-[58vh] min-h-[24rem] flex-col overflow-hidden p-6 md:p-8"
        style={{ background: 'rgba(11, 18, 32, 0.78)' }}
      >
        <div className="relative min-h-0 flex-1">{vignette(i)}</div>
        <div className="mt-6 flex items-end justify-between gap-4">
          <div>
            <p className="hud-mono text-[0.62rem]" style={{ color: panel.accent }}>
              0{i + 1} / VIEW
            </p>
            <h3
              className="mt-1.5 font-bold text-white"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 2.6vw, 2.2rem)', letterSpacing: '-0.02em' }}
            >
              {panel.title}
            </h3>
            <p className="body-lg mt-2 max-w-md !text-[0.95rem]">{panel.copy}</p>
          </div>
        </div>
      </div>
    </li>
  )

  if (reduced) {
    return (
      <section aria-labelledby="views-title" className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <p className="eyebrow">( Five views )</p>
          <h2 id="views-title" className="h2-section mt-4">
            One disk. Five ways to see it.
          </h2>
          <ul className="mt-12 space-y-16">{PANELS.map(card)}</ul>
        </div>
      </section>
    )
  }

  return (
    <section ref={sectionRef} aria-labelledby="views-title" className="relative z-10">
      <div ref={pinRef} className="relative flex h-svh flex-col justify-center overflow-hidden">
        <div className="flex items-end justify-between px-6 pb-8 md:px-[6%]">
          <div>
            <p className="eyebrow">( Five views )</p>
            <h2 id="views-title" className="h2-section mt-3">
              One disk. Five ways to see it.
            </h2>
          </div>
          <p className="hud-mono hidden text-[0.7rem] text-muted/70 md:block">
            <span ref={counterRef} className="text-teal">
              01
            </span>
            &thinsp;/&thinsp;05
          </p>
        </div>
        <ul
          ref={trackRef}
          className="flex snap-x snap-mandatory gap-8 overflow-x-auto px-6 pb-4 pt-14 will-change-transform [-ms-overflow-style:none] [scrollbar-width:none] md:snap-none md:gap-14 md:overflow-x-visible md:px-[18vw] [&::-webkit-scrollbar]:hidden"
        >
          {PANELS.map(card)}
        </ul>
        <div className="mx-6 mt-6 h-px overflow-hidden bg-white/10 md:mx-[6%]">
          <div
            ref={hairlineRef}
            className="h-full origin-left"
            style={{
              background: 'linear-gradient(90deg, #2dd4bf, #fbbf24, #f43f5e)',
              transform: 'scaleX(0)',
            }}
          />
        </div>
      </div>
    </section>
  )
}
