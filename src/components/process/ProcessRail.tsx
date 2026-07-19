import { Suspense, lazy, useLayoutEffect, useRef, useState } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsapSetup'
import { processState, STAGE_COUNT, stageWindow } from './processState'
import { clamp01, smoothstep } from '../../lib/stages'

// three.js stays out of the main bundle — same rule as the story's Experience.
const DialScene = lazy(() => import('./DialScene'))

/**
 * The PIPELINE rail (cinetica's process dial, in TreeMap's voice): a pinned
 * viewport where five stages trade places — giant stage word left, a ticked
 * dial around a WebGL scene center, stage copy right. One ScrollTrigger owns
 * the pin and writes processState.progress; the 3D stages, the tick ring, the
 * words and the copy all read that single value, so nothing can drift.
 *
 * Calm tier: the same five stages as a static, always-visible list.
 */

const STAGES = [
  {
    word: 'SCAN',
    accent: '#2dd4bf',
    tag: 'CONCURRENT WALKER',
    copy:
      'A concurrent walker sized to your CPU tears through the drive — 500,000 files without breaking stride. Local only: nothing ever leaves the machine.',
  },
  {
    word: 'MAP',
    accent: '#fbbf24',
    tag: 'SQUARIFIED LAYOUT',
    copy:
      'Squarified treemapping turns the byte counts into shape. Every file becomes a tile; every tile is sized by exactly what it costs you.',
  },
  {
    word: 'EXPLORE',
    accent: '#2dd4bf',
    tag: 'DRILL-DOWN',
    copy:
      'Drill into any folder, app, or archive. Treemap, sunburst and grid are three views of the same truth — zoom out is always one click away.',
  },
  {
    word: 'DETECT',
    accent: '#f43f5e',
    tag: 'STAGED SHA-256',
    copy:
      'Staged SHA-256 hashing — size, then a sample, then the full file — finds true duplicates fast; perceptual matching catches the near-identical shots.',
  },
  {
    word: 'RECLAIM',
    accent: '#2dd4bf',
    tag: 'TRASH, NEVER VOID',
    copy:
      'Deletes go to the system Trash, never into the void. Verified offload copies, checks every byte, and only then lets go of the original.',
  },
]

const TICKS = 72
const FADE = 0.15 / STAGE_COUNT

function easeOutCubic(v: number): number {
  const inv = 1 - v
  return 1 - inv * inv * inv
}

export default function ProcessRail({ reduced }: { reduced: boolean }) {
  const sectionRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const tickRefs = useRef<Array<SVGLineElement | null>>([])
  const ringRef = useRef<SVGGElement>(null)
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([])
  const charRefs = useRef<Map<number, HTMLElement[]>>(new Map())
  const copyRefs = useRef<Array<HTMLDivElement | null>>([])
  const tagRefs = useRef<Array<HTMLSpanElement | null>>([])
  const ruleRefs = useRef<Array<HTMLSpanElement | null>>([])
  const stageNumRef = useRef<HTMLSpanElement>(null)
  const pctRef = useRef<HTMLSpanElement>(null)
  const lastStage = useRef(-1)
  const lastPct = useRef(-1)

  // The canvas mounts once the rail approaches and then stays; far away it
  // idles at frameloop="never" instead of re-paying WebGL context setup.
  const [canvasMounted, setCanvasMounted] = useState(false)
  const [canvasLive, setCanvasLive] = useState(false)

  // R3F defers GL creation until ResizeObserver delivers a first measurement,
  // and occluded/embedded windows can starve RO indefinitely (the Liquid Glass
  // lesson) — leaving a healthy scene graph with zero pixels. Its measurer
  // also listens for window resize, so a synthetic kick un-wedges it; real
  // browsers just absorb an idempotent ScrollTrigger refresh.
  useLayoutEffect(() => {
    if (!canvasMounted) return
    const kick = () => window.dispatchEvent(new Event('resize'))
    const t1 = setTimeout(kick, 350)
    const t2 = setTimeout(kick, 1400)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [canvasMounted])

  useLayoutEffect(() => {
    if (reduced) return
    const pin = pinRef.current
    const section = sectionRef.current
    if (!pin || !section) return

    const sceneRoot = document.getElementById('scene-root')

    const apply = (t: number) => {
      processState.progress = t

      // Duck the fixed story field while the dial owns the viewport — the
      // settled treemap at full strength buries the stage scenes. Driven off
      // the same t as everything else (a separate trigger fought matchMedia
      // re-inits and lost), restoring across the last 8% of the pin.
      if (sceneRoot) {
        const duck = smoothstep(0, 0.05, t) * (1 - smoothstep(0.92, 1, t))
        sceneRoot.style.opacity = (1 - 0.86 * duck).toFixed(3)
      }

      // ---- Dial ring: slow rotation + sweep-fill ticks. ----
      if (ringRef.current) {
        ringRef.current.style.transform = `rotate(${(t * 90).toFixed(2)}deg)`
      }
      const lit = t * TICKS
      for (let i = 0; i < TICKS; i++) {
        const tick = tickRefs.current[i]
        if (!tick) continue
        if (i < lit - 1) {
          tick.style.stroke = '#2dd4bf'
          tick.style.strokeOpacity = '0.8'
        } else if (i <= lit) {
          tick.style.stroke = '#fbbf24'
          tick.style.strokeOpacity = '1'
        } else {
          tick.style.stroke = '#1c2740'
          tick.style.strokeOpacity = '0.9'
        }
      }

      // ---- Words, tags, accent rules, copy — per-stage windows. ----
      for (let i = 0; i < STAGE_COUNT; i++) {
        const { p, active } = stageWindow(i, t)
        const aEase = easeOutCubic(active)

        const word = wordRefs.current[i]
        if (word) {
          word.style.opacity = String(Math.min(1, active * 1.6))
          word.style.visibility = active < 0.004 ? 'hidden' : 'visible'
        }
        const chars = charRefs.current.get(i)
        if (chars) {
          // Entry cascade per char; the whole word lifts away on exit.
          const start = i / STAGE_COUNT
          const entry = smoothstep(start - FADE, start + FADE * 0.7, t)
          const exit =
            i === STAGE_COUNT - 1 ? 0 : smoothstep(start + 1 / STAGE_COUNT - FADE, start + 1 / STAGE_COUNT + FADE, t)
          for (let j = 0; j < chars.length; j++) {
            const rise = easeOutCubic(clamp01(entry * 1.5 - j * 0.09))
            chars[j].style.transform = `translateY(${((1 - rise) * 108 + exit * -108).toFixed(2)}%)`
          }
        }
        const tag = tagRefs.current[i]
        if (tag) {
          const o = aEase * aEase
          tag.style.opacity = String(o)
          tag.style.visibility = o < 0.22 ? 'hidden' : 'visible'
          tag.style.transform = `translateX(${((1 - aEase) * -16).toFixed(2)}px)`
        }
        const rule = ruleRefs.current[i]
        if (rule) {
          // The accent rule charts progress through the active stage.
          rule.style.transform = `scaleX(${(p * aEase).toFixed(4)})`
        }
        const copy = copyRefs.current[i]
        if (copy) {
          // Squared curve + a hard floor: the outgoing paragraph is gone
          // before the incoming one is legible — overlapping half-faded copy
          // read as a rendering bug in user testing.
          const o = aEase * aEase
          copy.style.opacity = String(o)
          copy.style.transform = `translateY(${((1 - aEase) * 34).toFixed(2)}px)`
          copy.style.visibility = o < 0.22 ? 'hidden' : 'visible'
        }
      }

      // ---- Counters (write only on change — these are text nodes). ----
      const stage = Math.min(STAGE_COUNT - 1, Math.floor(t * STAGE_COUNT))
      if (stage !== lastStage.current && stageNumRef.current) {
        lastStage.current = stage
        stageNumRef.current.textContent = `0${stage + 1}`
      }
      const pct = Math.round(t * 100)
      if (pct !== lastPct.current && pctRef.current) {
        lastPct.current = pct
        pctRef.current.textContent = String(pct).padStart(3, '0')
      }
    }

    const ctx = gsap.context(() => {
      // Length via matchMedia so phones aren't trapped in a 4600px pin.
      const mm = gsap.matchMedia()
      mm.add(
        { desktop: '(min-width: 768px)', mobile: '(max-width: 767px)' },
        (mmCtx) => {
          const { desktop } = mmCtx.conditions as { desktop: boolean }
          const trigger = ScrollTrigger.create({
            trigger: pin,
            start: 'top top',
            end: `+=${desktop ? 7500 : 4500}`,
            pin: true,
            // 1.5 matches the story pin — the pace the user tuned by hand.
            scrub: 1.5,
            anticipatePin: 1,
            invalidateOnRefresh: true,
            onUpdate: (self) => apply(self.progress),
          })
          apply(trigger.progress)
          return () => trigger.kill()
        },
      )

      // Canvas lifecycle: mount as the rail nears, sleep when far away.
      ScrollTrigger.create({
        trigger: section,
        start: 'top 160%',
        end: 'bottom -60%',
        onToggle: (self) => {
          if (self.isActive) setCanvasMounted(true)
          setCanvasLive(self.isActive)
        },
      })

    }, section)

    return () => ctx.revert()
  }, [reduced])

  const setChars = (i: number) => (el: HTMLSpanElement | null) => {
    wordRefs.current[i] = el
    if (el) {
      charRefs.current.set(
        i,
        Array.from(el.querySelectorAll<HTMLElement>('[data-char]')),
      )
    }
  }

  const dial = (
    <div className="relative aspect-square w-[min(66vw,30rem)] md:w-[min(46vh,30rem)]">
      {/* Tick ring + crosshairs (decorative — the copy carries the meaning). */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <g ref={ringRef} style={{ transformOrigin: '50% 50%' }}>
          {Array.from({ length: TICKS }, (_, i) => {
            const a = (i / TICKS) * Math.PI * 2 - Math.PI / 2
            const major = i % 6 === 0
            const r0 = major ? 44.4 : 45.8
            const r1 = 48.4
            return (
              <line
                key={i}
                ref={(el) => {
                  tickRefs.current[i] = el
                }}
                x1={50 + Math.cos(a) * r0}
                y1={50 + Math.sin(a) * r0}
                x2={50 + Math.cos(a) * r1}
                y2={50 + Math.sin(a) * r1}
                stroke="#1c2740"
                strokeWidth={major ? 0.55 : 0.35}
              />
            )
          })}
        </g>
        <circle cx="50" cy="50" r="42.5" fill="none" stroke="#1c2740" strokeWidth="0.3" strokeOpacity="0.8" />
        {[0, 90, 180, 270].map((deg) => {
          const a = (deg * Math.PI) / 180
          return (
            <line
              key={deg}
              x1={50 + Math.cos(a) * 40.2}
              y1={50 + Math.sin(a) * 40.2}
              x2={50 + Math.cos(a) * 42.5}
              y2={50 + Math.sin(a) * 42.5}
              stroke="#3b4a6b"
              strokeWidth="0.4"
            />
          )
        })}
      </svg>

      {/* HUD framing. */}
      <span className="hud-mono absolute -top-1 left-1/2 -translate-x-1/2 text-[0.58rem] text-muted/50">
        PIPELINE
      </span>
      <span className="hud-mono absolute -bottom-1 left-1/2 -translate-x-1/2 text-[0.58rem] text-muted/60">
        STAGE <span ref={stageNumRef}>01</span>&thinsp;/&thinsp;0{STAGE_COUNT}
      </span>
      <span className="hud-mono absolute right-0 top-1/2 -translate-y-1/2 whitespace-nowrap text-[0.58rem] text-teal/70">
        <span ref={pctRef}>000</span>%
      </span>

      {/* The WebGL heart. */}
      <div className="absolute inset-[8%]">
        {canvasMounted && (
          <Suspense fallback={null}>
            <DialScene frameloop={canvasLive ? 'always' : 'never'} />
          </Suspense>
        )}
      </div>
    </div>
  )

  if (reduced) {
    return (
      <section aria-labelledby="process-title" className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <p className="eyebrow">( The pipeline )</p>
          <h2 id="process-title" className="h2-section mt-4">
            Five moves from chaos to reclaimed space.
          </h2>
          <ol className="mt-12 space-y-8">
            {STAGES.map((stage, i) => (
              <li
                key={stage.word}
                className="glass-soft rounded-2xl border-l-2 p-6"
                style={{ borderLeftColor: stage.accent }}
              >
                <p className="hud-mono text-[0.62rem]" style={{ color: stage.accent }}>
                  0{i + 1} · {stage.tag}
                </p>
                <p className="process-word-static mt-2">{stage.word}</p>
                <p className="body-lg mt-3 max-w-2xl">{stage.copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    )
  }

  return (
    <section ref={sectionRef} aria-labelledby="process-title" className="relative z-10">
      {/* Intro sits above the pin so the dial arrives on a clean viewport. */}
      <div className="px-6 pb-10 pt-28 text-center">
        <p className="eyebrow">( The pipeline )</p>
        <h2 id="process-title" className="h2-section mx-auto mt-4 max-w-2xl">
          Five moves from chaos to reclaimed space.
        </h2>
        <p className="body-lg mx-auto mt-4 max-w-xl">
          The same engine that powers the app — end to end, on your machine.
        </p>
      </div>

      <div ref={pinRef} className="relative h-svh overflow-hidden">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-6 md:grid md:grid-cols-[1fr_auto_1fr] md:gap-10 md:px-[6%]">
          {/* Left: the giant stage word. */}
          <div className="pointer-events-none relative flex min-h-[4.5rem] w-full items-center justify-center md:min-h-0 md:justify-end">
            {STAGES.map((stage, i) => (
              <span
                key={stage.word}
                ref={setChars(i)}
                style={{ opacity: i === 0 ? 1 : 0 }}
                className="process-word absolute inline-flex overflow-hidden text-center md:right-0 md:text-right"
              >
                {stage.word.split('').map((ch, j) => (
                  <span key={j} data-char className="inline-block will-change-transform">
                    {ch}
                  </span>
                ))}
              </span>
            ))}
          </div>

          {/* Center: the dial. */}
          <div className="relative">{dial}</div>

          {/* Right: stage tag + copy. */}
          <div className="pointer-events-none relative min-h-[9rem] w-full max-w-md md:min-h-0">
            {STAGES.map((stage, i) => (
              <div
                key={stage.word}
                ref={(el) => {
                  copyRefs.current[i] = el
                }}
                style={{ opacity: i === 0 ? 1 : 0, visibility: i === 0 ? 'visible' : 'hidden' }}
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center md:text-left"
              >
                <span
                  ref={(el) => {
                    tagRefs.current[i] = el
                  }}
                  className="hud-mono inline-block text-[0.62rem]"
                  style={{ color: stage.accent }}
                >
                  0{i + 1} · {stage.tag}
                </span>
                <span
                  ref={(el) => {
                    ruleRefs.current[i] = el
                  }}
                  className="mt-2 block h-px w-24 origin-left"
                  style={{ background: stage.accent, transform: 'scaleX(0)' }}
                  aria-hidden="true"
                />
                <p className="body-lg mt-3">{stage.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
