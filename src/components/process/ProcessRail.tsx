import { useLayoutEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsapSetup'
import { processState, STAGE_COUNT, stageWindow } from './processState'
import { clamp01, smoothstep } from '../../lib/stages'
import ProcessDial from './ProcessDial'

/**
 * The PIPELINE rail (cinetica's process dial, in TreeMap's voice): a pinned
 * viewport where five stages trade places — giant stage word left, the SVG
 * dial instrument center, stage copy right. One ScrollTrigger owns the pin
 * and writes processState.progress; the dial, the words and the copy all read
 * that single value, so nothing can drift.
 *
 * v2: the dial is pure SVG (see ProcessDial). The old WebGL mini-canvas was
 * the page's one unreliable organ — sizing races, lazy chunks mid-pin, a
 * second GL context — and every "renders nothing / breaks randomly" report
 * traced back to it. DOM cannot fail those ways.
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

const FADE = 0.15 / STAGE_COUNT

function easeOutCubic(v: number): number {
  const inv = 1 - v
  return 1 - inv * inv * inv
}

export default function ProcessRail({ reduced }: { reduced: boolean }) {
  const sectionRef = useRef<HTMLElement>(null)
  const pinRef = useRef<HTMLDivElement>(null)
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([])
  const charRefs = useRef<Map<number, HTMLElement[]>>(new Map())
  const copyRefs = useRef<Array<HTMLDivElement | null>>([])
  const tagRefs = useRef<Array<HTMLSpanElement | null>>([])
  const ruleRefs = useRef<Array<HTMLSpanElement | null>>([])
  const stageNumRef = useRef<HTMLSpanElement>(null)
  const pctRef = useRef<HTMLSpanElement>(null)
  const lastStage = useRef(-1)
  const lastPct = useRef(-1)

  useLayoutEffect(() => {
    if (reduced) return
    const pin = pinRef.current
    const section = sectionRef.current
    if (!pin || !section) return

    const sceneRoot = document.getElementById('scene-root')

    const apply = (t: number) => {
      processState.progress = t

      // Duck the fixed story field while the dial owns the viewport — the
      // settled treemap at full strength buries the dial. Driven off the
      // same t as everything else, restoring across the last 8% of the pin.
      if (sceneRoot) {
        const duck = smoothstep(0, 0.05, t) * (1 - smoothstep(0.92, 1, t))
        sceneRoot.style.opacity = (1 - 0.93 * duck).toFixed(3)
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
      <ProcessDial />

      {/* HUD framing. */}
      <span className="hud-mono absolute -top-1 left-1/2 -translate-x-1/2 text-[0.58rem] text-muted/50">
        PIPELINE
      </span>
      <span className="hud-mono absolute -bottom-1 left-1/2 -translate-x-1/2 text-[0.58rem] text-muted/60">
        STAGE <span ref={stageNumRef}>01</span>&thinsp;/&thinsp;0{STAGE_COUNT}
      </span>
      <span className="hud-mono absolute -right-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md border border-white/5 bg-void/85 px-1.5 py-0.5 text-[0.58rem] text-teal/80">
        <span ref={pctRef}>000</span>%
      </span>
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
