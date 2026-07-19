import { useLayoutEffect, useRef } from 'react'
import { gsap, ScrollTrigger, SplitText } from '../../lib/gsapSetup'

/**
 * Giant-type stats band (§Kinetic 3, cinetica's "SINCE 2019" moment):
 * four screen-height claims — every one true, lifted from the page's own
 * copy — whose characters roll up out of masks, scrubbed to entry.
 *
 * Calm tier: the same wall, statically assembled.
 */
// ! prefixes: .eyebrow is unlayered CSS, so utility overrides need force.
const STATS = [
  { value: '500K', label: 'files per scan, without choking', accent: '!text-teal' },
  { value: 'SHA-256', label: 'verified before anything moves', accent: '!text-amber' },
  { value: '0', label: 'telemetry. zero. none.', accent: '!text-rose' },
  { value: 'MIT', label: 'open source, forever', accent: '!text-teal' },
]

export default function StatsWall({ reduced }: { reduced: boolean }) {
  const sectionRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    if (reduced) return
    const section = sectionRef.current
    if (!section) return
    const splits: SplitText[] = []
    const triggers: ScrollTrigger[] = []
    const ctx = gsap.context(() => {
      for (const block of section.querySelectorAll<HTMLElement>('[data-stat]')) {
        const value = block.querySelector<HTMLElement>('[data-stat-value]')
        if (!value) continue
        const split = new SplitText(value, { type: 'chars', mask: 'chars' })
        splits.push(split)
        const tween = gsap.fromTo(
          split.chars,
          { yPercent: 110 },
          {
            yPercent: 0,
            ease: 'power3.out',
            stagger: 0.06,
            scrollTrigger: {
              trigger: block,
              start: 'top 88%',
              end: 'top 46%',
              scrub: true,
            },
          },
        )
        triggers.push(tween.scrollTrigger!)
        // The label eases up behind its numeral on the same scrub.
        const label = block.querySelector<HTMLElement>('[data-stat-label]')
        if (label) {
          const labelTween = gsap.fromTo(
            label,
            { autoAlpha: 0, y: 18 },
            {
              autoAlpha: 1,
              y: 0,
              ease: 'none',
              scrollTrigger: {
                trigger: block,
                start: 'top 70%',
                end: 'top 46%',
                scrub: true,
              },
            },
          )
          triggers.push(labelTween.scrollTrigger!)
        }
      }
    }, section)
    return () => {
      for (const t of triggers) {
        t.animation?.kill()
        t.kill()
      }
      for (const s of splits) s.revert()
      ctx.revert()
    }
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      aria-label="TreeMap by the numbers"
      className="relative z-10 border-y border-white/[0.06] bg-base/85 py-28 sm:py-36"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-x-8 gap-y-20 px-6 sm:grid-cols-2">
        {STATS.map((stat, i) => (
          <div
            key={stat.value}
            data-stat
            data-speed={i % 2 === 0 ? '0.97' : '1.03'}
            aria-label={`${stat.value} — ${stat.label}`}
            className={i % 2 === 0 ? 'text-left' : 'text-left sm:text-right'}
          >
            <div
              data-stat-value
              aria-hidden="true"
              className={`whitespace-nowrap font-display font-bold leading-[0.95] tracking-tight text-white ${
                stat.value.length > 4
                  ? 'text-[clamp(3rem,7vw,6.5rem)]'
                  : 'text-[clamp(4.5rem,11vw,10rem)]'
              }`}
            >
              {stat.value}
            </div>
            <p
              data-stat-label
              aria-hidden="true"
              className={`eyebrow mt-4 !text-[0.78rem] ${stat.accent}`}
            >
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
