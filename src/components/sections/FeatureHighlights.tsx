import { useLayoutEffect, useRef } from 'react'
import { CalendarClock, ShieldCheck, LayoutGrid, Lock } from 'lucide-react'
import { gsap } from '../../lib/gsapSetup'
import GlassCard from '../ui/GlassCard'
import dividerUrl from '../../assets/divider.svg'

/**
 * Post-pin feature call-outs (§7.3) — real TreeMap features only, revealed
 * with ordinary non-pinned ScrollTrigger fades. The settled 3D treemap keeps
 * idling behind them.
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
    const ctx = gsap.context(() => {
      gsap.from('[data-reveal]', {
        y: 36,
        autoAlpha: 0,
        duration: 0.7,
        ease: 'power3.out',
        stagger: 0.1,
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top 74%',
          toggleActions: 'play none none reverse',
        },
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [reduced])

  return (
    <section
      ref={sectionRef}
      aria-labelledby="features-heading"
      className="relative z-10 mx-auto max-w-6xl px-6 py-28 sm:py-36"
    >
      <img src={dividerUrl} alt="" className="mx-auto mb-16 w-full max-w-3xl" aria-hidden="true" />

      <div data-reveal className="mx-auto max-w-2xl text-center">
        <p className="eyebrow">Beyond the map</p>
        <h2 id="features-heading" className="h2-section mt-4">
          Built for the mess you actually have.
        </h2>
      </div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2">
        {FEATURES.map(({ icon: Icon, accent, title, body }) => (
          <GlassCard key={title} data-reveal className="p-7 sm:p-8">
            <Icon className={`h-6 w-6 ${accent}`} aria-hidden="true" />
            <h3 className="mt-4 font-display text-xl font-bold tracking-tight text-white">
              {title}
            </h3>
            <p className="body-lg mt-3 text-[0.98rem]">{body}</p>
          </GlassCard>
        ))}
      </div>
    </section>
  )
}
