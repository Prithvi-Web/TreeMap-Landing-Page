import { useLayoutEffect, useRef } from 'react'
import { CalendarClock, ShieldCheck, LayoutGrid, Lock } from 'lucide-react'
import { gsap, SplitText } from '../../lib/gsapSetup'
import GlassCard from '../ui/GlassCard'
import dividerUrl from '../../assets/divider.svg'

/**
 * Post-pin feature call-outs (§7.3 + §Kinetic 4) — real TreeMap features
 * only. Animated tier: the divider wipes across, the eyebrow scramble-decodes,
 * the headline assembles word-by-word, and each card slides in from its own
 * side with a settling rotation — all scrubbed, so scrolling back rewinds
 * them. The settled 3D treemap keeps idling behind everything.
 */
const FEATURES = [
  {
    icon: CalendarClock,
    accent: 'text-teal',
    title: 'Disk-full forecast',
    body: '“At current growth, this disk is full in ~58 days.” TreeMap projects from your scan history — and tells you when it doesn’t have enough data to be sure.',
  },
  {
    icon: ShieldCheck,
    accent: 'text-amber',
    title: 'Verified offload',
    body: 'Copy to another drive → read every byte back and verify via SHA-256 → only then trash the originals. Never a bare move; any failure rolls back.',
  },
  {
    icon: LayoutGrid,
    accent: 'text-rose',
    title: 'App-aware',
    body: 'See exactly how much disk every installed app really owns — app, cache, data and logs split out — with one-click safe cache clearing.',
  },
  {
    icon: Lock,
    accent: 'text-teal',
    title: 'Local-first & safe',
    body: 'No account. No telemetry. Deletes always go to the OS Trash. Cloud scanning is opt-in and metadata-only — file contents are never downloaded.',
  },
]

export default function FeatureHighlights({ reduced }: { reduced: boolean }) {
  const sectionRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    if (reduced) return
    const section = sectionRef.current
    if (!section) return
    let split: SplitText | null = null
    const ctx = gsap.context(() => {
      // Divider wipes left→right as it enters.
      gsap.fromTo(
        '[data-divider-clip]',
        { clipPath: 'inset(0 100% 0 0)' },
        {
          clipPath: 'inset(0 0% 0 0)',
          ease: 'none',
          scrollTrigger: { trigger: section, start: 'top 92%', end: 'top 62%', scrub: true },
        },
      )

      // Eyebrow decodes once; headline words cascade on scrub.
      gsap.to('[data-eyebrow]', {
        scrambleText: { text: 'Beyond the map', chars: '01▮▯#/', speed: 0.4 },
        duration: 1.1,
        ease: 'none',
        scrollTrigger: { trigger: section, start: 'top 80%', toggleActions: 'play none none none' },
      })
      const h2 = section.querySelector('h2')
      if (h2) {
        split = new SplitText(h2, { type: 'words', mask: 'words' })
        gsap.fromTo(
          split.words,
          { yPercent: 105 },
          {
            yPercent: 0,
            stagger: 0.05,
            ease: 'power2.out',
            scrollTrigger: { trigger: section, start: 'top 84%', end: 'top 52%', scrub: true },
          },
        )
      }

      // Cards: alternating sides, settling rotation, icons popping in tow.
      for (const [i, wrap] of section.querySelectorAll<HTMLElement>('[data-card-wrap]').entries()) {
        const fromLeft = i % 2 === 0
        const card = wrap.querySelector('[data-card]')
        const icon = wrap.querySelector('svg')
        const st = { trigger: wrap, start: 'top 96%', end: 'top 58%', scrub: true } as const
        gsap.fromTo(
          card,
          { x: fromLeft ? -64 : 64, y: 48, rotation: fromLeft ? -3.5 : 3.5, autoAlpha: 0 },
          { x: 0, y: 0, rotation: 0, autoAlpha: 1, ease: 'power2.out', scrollTrigger: { ...st } },
        )
        if (icon) {
          gsap.fromTo(
            icon,
            { scale: 0.4, rotation: fromLeft ? -20 : 20, autoAlpha: 0 },
            { scale: 1, rotation: 0, autoAlpha: 1, ease: 'power2.out', scrollTrigger: { ...st } },
          )
        }
      }
    }, section)
    return () => {
      split?.revert()
      ctx.revert()
    }
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      aria-labelledby="features-heading"
      className="relative z-10 mx-auto max-w-6xl px-6 py-28 sm:py-36"
    >
      <div data-divider-clip className="mx-auto mb-16 w-full max-w-3xl">
        <img src={dividerUrl} alt="" className="w-full" aria-hidden="true" />
      </div>

      <div className="mx-auto max-w-2xl text-center">
        {/* Real text for AT; the scramble runs on the aria-hidden twin so the
            accessible name never churns through filler glyphs. */}
        <p className="eyebrow">
          <span className="sr-only">Beyond the map</span>
          <span data-eyebrow aria-hidden="true">
            Beyond the map
          </span>
        </p>
        <h2 id="features-heading" className="h2-section mt-4">
          Built for the mess you actually have.
        </h2>
      </div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, accent, title, body }, i) => (
          <div key={title} data-card-wrap data-speed={i % 2 === 0 ? '0.985' : '1.015'}>
            <GlassCard data-card data-skew className="h-full p-7 sm:p-8">
              <Icon className={`h-6 w-6 ${accent}`} aria-hidden="true" />
              <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-white">
                {title}
              </h3>
              <p className="body-lg mt-3 text-[0.98rem]">{body}</p>
            </GlassCard>
          </div>
        ))}
      </div>
    </section>
  )
}
