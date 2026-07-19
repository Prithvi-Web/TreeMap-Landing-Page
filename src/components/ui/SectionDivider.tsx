import { useLayoutEffect, useRef } from 'react'
import { gsap } from '../../lib/gsapSetup'

/**
 * An ornamental section seam: a brand-gradient hairline that draws outward
 * from center as it scrolls into view, crosshair "+" marks rotating in at the
 * ends, and an optional hud-mono micro-label above — the connective tissue
 * that keeps something moving between the big set pieces.
 */

export default function SectionDivider({ reduced, label }: { reduced: boolean; label?: string }) {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (reduced) return
    const root = rootRef.current
    if (!root) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-seam-line]',
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { trigger: root, start: 'top 92%', end: 'top 58%', scrub: true },
        },
      )
      gsap.fromTo(
        '[data-seam-cross]',
        { rotation: -90, autoAlpha: 0 },
        {
          rotation: 0,
          autoAlpha: 1,
          ease: 'none',
          stagger: 0.1,
          scrollTrigger: { trigger: root, start: 'top 78%', end: 'top 52%', scrub: true },
        },
      )
      if (label) {
        gsap.fromTo(
          '[data-seam-label]',
          { autoAlpha: 0, y: 8 },
          {
            autoAlpha: 1,
            y: 0,
            ease: 'none',
            scrollTrigger: { trigger: root, start: 'top 84%', end: 'top 62%', scrub: true },
          },
        )
      }
    }, root)
    return () => ctx.revert()
  }, [reduced, label])

  return (
    <div ref={rootRef} className="relative mx-auto w-full max-w-5xl px-6 py-10" aria-hidden="true">
      {label && (
        <p data-seam-label className="hud-mono mb-3 text-center text-[0.6rem] text-muted/50">
          {label}
        </p>
      )}
      <div className="flex items-center gap-3">
        <span data-seam-cross className="text-[0.9rem] leading-none text-teal/70" style={reduced ? undefined : { opacity: 0 }}>
          +
        </span>
        <span
          data-seam-line
          className="h-px flex-1 origin-center"
          style={{
            background:
              'linear-gradient(90deg, transparent, #2dd4bf 18%, #fbbf24 50%, #f43f5e 82%, transparent)',
            transform: reduced ? undefined : 'scaleX(0)',
          }}
        />
        <span data-seam-cross className="text-[0.9rem] leading-none text-rose/70" style={reduced ? undefined : { opacity: 0 }}>
          +
        </span>
      </div>
    </div>
  )
}
