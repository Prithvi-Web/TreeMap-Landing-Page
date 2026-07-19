import { useLayoutEffect, useRef } from 'react'
import { gsap, ScrollTrigger } from '../../lib/gsapSetup'

/**
 * Full-bleed kinetic type band (§Kinetic 3): two giant rows sliding in
 * opposite directions, scrubbed to the section's transit through the
 * viewport, tilted 2° — the cinetica marquee, in TreeMap's voice.
 *
 * Calm tier: the same two rows, static and untilted — still a typographic
 * moment, just a quiet one.
 */
const ROW_A = 'Every file has a place'
const ROW_B = 'Every byte accounted for'

export default function MarqueeBand({ reduced }: { reduced: boolean }) {
  const sectionRef = useRef<HTMLElement>(null)
  const rowARef = useRef<HTMLDivElement>(null)
  const rowBRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (reduced) return
    const section = sectionRef.current
    if (!section) return
    const triggers: ScrollTrigger[] = []
    const scrub = (row: HTMLElement | null, from: number, to: number) => {
      if (!row) return
      const tween = gsap.fromTo(
        row,
        { xPercent: from },
        {
          xPercent: to,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        },
      )
      triggers.push(tween.scrollTrigger!)
    }
    scrub(rowARef.current, -2, -14)
    scrub(rowBRef.current, -14, -2)
    return () => {
      for (const t of triggers) {
        t.animation?.kill()
        t.kill()
      }
    }
  }, [reduced])

  const repeat = (phrase: string) =>
    Array.from({ length: 6 }, (_, i) => (
      <span key={i} className="shrink-0">
        {phrase}
        <span className="mx-[0.6em] text-teal">·</span>
      </span>
    ))

  return (
    <section
      ref={sectionRef}
      aria-label="Every file has a place. Every byte accounted for."
      className="relative z-10 overflow-hidden py-24 sm:py-32"
    >
      {/* Tilted inner wrapper, oversized so the rotation never exposes edges. */}
      <div className={reduced ? '' : 'w-[106%] -translate-x-[3%] -rotate-2'}>
        <div
          ref={rowARef}
          aria-hidden="true"
          className="marquee-row text-brand-gradient flex whitespace-nowrap font-display text-[clamp(3rem,7.5vw,6.5rem)] font-bold leading-[1.05] tracking-tight will-change-transform"
        >
          {repeat(ROW_A)}
        </div>
        <div
          ref={rowBRef}
          aria-hidden="true"
          className="marquee-row marquee-outline mt-3 flex whitespace-nowrap font-display text-[clamp(3rem,7.5vw,6.5rem)] font-bold leading-[1.05] tracking-tight will-change-transform"
        >
          {repeat(ROW_B)}
        </div>
      </div>
    </section>
  )
}
