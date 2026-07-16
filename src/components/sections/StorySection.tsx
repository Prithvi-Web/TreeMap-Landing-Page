import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { ChevronDown } from 'lucide-react'
import { gsap, SplitText } from '../../lib/gsapSetup'
import { scrollState } from '../../lib/scrollState'
import { smoothstep } from '../../lib/stages'

/**
 * The pinned story (§7): four overlay copy groups that fade through the same
 * shared `t` the 3D scene reads — hero → chaos → scanning → treemap. Styles
 * are written straight to the DOM from one subscription; React never
 * re-renders during scroll.
 *
 * Reduced motion (§8.6): the same copy renders as calm, stacked, always-
 * visible sections instead, over the pre-assembled treemap.
 */
type Window = { in0: number; in1: number; out0: number; out1: number; rise: number }

// Fade windows tuned to §7.3's t ranges. rise = px of directional drift.
const WINDOWS: Window[] = [
  { in0: -1, in1: -0.5, out0: 0.1, out1: 0.17, rise: -28 }, // hero (visible at t=0)
  { in0: 0.14, in1: 0.21, out0: 0.29, out1: 0.36, rise: 26 }, // chaos
  { in0: 0.38, in1: 0.45, out0: 0.58, out1: 0.65, rise: 26 }, // scanning
  { in0: 0.42, in1: 0.47, out0: 0.575, out1: 0.635, rise: 18 }, // chip 1
  { in0: 0.455, in1: 0.505, out0: 0.58, out1: 0.64, rise: 18 }, // chip 2
  { in0: 0.49, in1: 0.54, out0: 0.585, out1: 0.645, rise: 18 }, // chip 3
  { in0: 0.66, in1: 0.74, out0: 2, out1: 3, rise: 26 }, // treemap (stays)
]

const CHIP_COLORS = ['border-teal', 'border-amber', 'border-rose']
const CHIPS = ['Squarified layout', 'Live duplicate detection', 'Zero telemetry']

type StorySectionProps = {
  pinRef: RefObject<HTMLDivElement | null>
  reduced: boolean
}

export default function StorySection({ pinRef, reduced }: StorySectionProps) {
  const groupRefs = useRef<Array<HTMLElement | null>>([])
  const heroBoxRef = useRef<HTMLDivElement>(null)
  const h1Ref = useRef<HTMLHeadingElement>(null)

  // One subscription drives every overlay window.
  useLayoutEffect(() => {
    if (reduced) return
    return scrollState.subscribe((t) => {
      for (let i = 0; i < WINDOWS.length; i++) {
        const el = groupRefs.current[i]
        if (!el) continue
        const w = WINDOWS[i]
        const sIn = smoothstep(w.in0, w.in1, t)
        const sOut = smoothstep(w.out0, w.out1, t)
        const o = sIn * (1 - sOut)
        el.style.opacity = String(o)
        el.style.transform = `translateY(${((1 - sIn) * w.rise - sOut * w.rise).toFixed(2)}px)`
        el.style.visibility = o < 0.015 ? 'hidden' : 'visible'
      }
    })
  }, [reduced])

  // Hero intro: character rise on the H1, soft fade on the supporting copy.
  // The H1's two lines are fixed by an explicit <br>, so splitting doesn't
  // need to wait for fonts — no blank-hero window on slow connections.
  useLayoutEffect(() => {
    if (reduced) return
    let split: SplitText | null = null
    const ctx = gsap.context(() => {
      if (!h1Ref.current) return
      split = new SplitText(h1Ref.current, { type: 'lines,chars', linesClass: 'overflow-hidden' })
      gsap.from(split.chars, {
        yPercent: 112,
        duration: 0.85,
        stagger: 0.016,
        ease: 'power4.out',
        delay: 0.1,
      })
      gsap.from('[data-hero-fade]', {
        autoAlpha: 0,
        y: 14,
        duration: 0.7,
        stagger: 0.12,
        delay: 0.5,
        ease: 'power2.out',
      })
    }, heroBoxRef)
    return () => {
      split?.revert()
      ctx.revert()
    }
  }, [reduced])

  const setGroup = (i: number) => (el: HTMLElement | null) => {
    groupRefs.current[i] = el
  }

  const heroCopy = (
    <div ref={heroBoxRef} className="max-w-3xl text-center">
      <p data-hero-fade className="eyebrow">
        Open source <Dot c="text-teal" /> macOS <Dot c="text-amber" /> Windows <Dot c="text-rose" /> Linux
      </p>
      <h1 ref={h1Ref} className="h1-hero mt-5">
        Your disk is chaos.
        <br />
        Let&rsquo;s map it.
      </h1>
      <p data-hero-fade className="body-lg mx-auto mt-6 max-w-xl">
        TreeMap turns gigabytes of scattered files into a single, honest picture of where your
        space actually went.
      </p>
    </div>
  )

  const chaosCopy = (
    <div className="story-scrim max-w-xl">
      <h2 className="h2-section">You have no idea what&rsquo;s actually on this drive.</h2>
      <p className="body-lg mt-5">
        Downloads you forgot. Caches that never clean themselves. A dozen node_modules folders
        quietly eating 40&nbsp;GB. It&rsquo;s all just&hellip; there.
      </p>
    </div>
  )

  const scanHeading = (
    <div className="story-scrim max-w-xl">
      <h2 className="h2-section">TreeMap scans every byte — fast.</h2>
      <p className="body-lg mt-5">
        A concurrent filesystem walker sized to your CPU, plus staged SHA-256 hashing — size, then
        a 64&nbsp;KB sample, then the full file — that finds true duplicates without choking on
        500,000 files.
      </p>
    </div>
  )

  const treemapCopy = (
    <div className="story-scrim max-w-xl">
      <h2 className="h2-section">Every file, sized and colored by what it costs you.</h2>
      <p className="body-lg mt-5">
        <span className="text-teal">Teal is fine.</span>{' '}
        <span className="text-amber">Amber is worth a look.</span>{' '}
        <span className="text-rose">Red is where your space went.</span> Drill in, find it,
        reclaim it — TreeMap always deletes to your system Trash, never for good.
      </p>
    </div>
  )

  if (reduced) {
    return (
      <div ref={pinRef} className="relative">
        <Static className="min-h-svh">{heroCopy}</Static>
        <Static className="min-h-[72svh]">{chaosCopy}</Static>
        <Static className="min-h-[72svh]">
          <div>
            {scanHeading}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {CHIPS.map((chip, i) => (
                <Chip key={chip} label={chip} color={CHIP_COLORS[i]} />
              ))}
            </div>
          </div>
        </Static>
        <Static className="min-h-[72svh]">{treemapCopy}</Static>
      </div>
    )
  }

  return (
    <div ref={pinRef} className="relative h-svh overflow-hidden" aria-label="How TreeMap works">
      {/* 0 · hero */}
      <section
        ref={setGroup(0)}
        className="pointer-events-none absolute inset-0 flex items-center justify-center px-6"
      >
        {heroCopy}
        <div
          data-hero-fade
          className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-1.5"
        >
          <span className="eyebrow !text-[0.62rem] text-muted/80">Scroll to scan</span>
          <ChevronDown className="scroll-cue h-5 w-5 text-teal" aria-hidden="true" />
        </div>
      </section>

      {/* 1 · chaos */}
      <section
        ref={setGroup(1)}
        style={{ opacity: 0, visibility: 'hidden' }}
        className="pointer-events-none absolute inset-0 flex items-end justify-center px-6 pb-28 text-center md:items-center md:justify-start md:pb-0 md:pl-[7%] md:text-left"
      >
        {chaosCopy}
      </section>

      {/* 2 · scanning */}
      <section
        ref={setGroup(2)}
        style={{ opacity: 0, visibility: 'hidden' }}
        className="pointer-events-none absolute inset-0 flex items-end justify-center px-6 pb-40 text-center md:items-center md:justify-end md:pb-0 md:pr-[7%] md:text-left"
      >
        {scanHeading}
      </section>
      <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center gap-3 px-6 md:bottom-[18%] md:justify-end md:pr-[7%]">
        {CHIPS.map((chip, i) => (
          <span key={chip} ref={setGroup(3 + i)} style={{ opacity: 0, visibility: 'hidden' }}>
            <Chip label={chip} color={CHIP_COLORS[i]} />
          </span>
        ))}
      </div>

      {/* 3 · treemap */}
      <section
        ref={setGroup(6)}
        style={{ opacity: 0, visibility: 'hidden' }}
        className="pointer-events-none absolute inset-0 flex items-end justify-center px-6 pb-24 text-center md:justify-start md:pl-[7%] md:pb-[9%] md:text-left"
      >
        {treemapCopy}
      </section>
    </div>
  )
}

function Dot({ c }: { c: string }) {
  return (
    <span className={`${c} mx-1.5`} aria-hidden="true">
      ·
    </span>
  )
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span className={`stat-chip glass-soft inline-block rounded-lg border-l-2 ${color} px-3.5 py-2 text-white/90`}>
      {label}
    </span>
  )
}

function Static({ className, children }: { className: string; children: ReactNode }) {
  return (
    <section className={`flex items-center justify-center px-6 py-16 text-center ${className}`}>
      {children}
    </section>
  )
}
