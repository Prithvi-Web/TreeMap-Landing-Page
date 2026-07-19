import { useLayoutEffect, useRef } from 'react'
import { gsap } from '../../lib/gsapSetup'

/**
 * A slowly orbiting circular-text badge (cinetica's rotating seal, in
 * TreeMap's voice): "OPEN SOURCE · MIT LICENSED · LOCAL-ONLY · NO TELEMETRY"
 * around a tiny treemap glyph. Two rotations compose — a constant CSS drift
 * and a scroll-scrubbed twist — so it always turns, and turns faster while
 * you scroll. Decorative; the same words exist as real copy elsewhere.
 */

const RING_TEXT = 'OPEN SOURCE · MIT LICENSED · LOCAL-ONLY · NO TELEMETRY · '

export default function OrbitBadge({ reduced }: { reduced: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const twistRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (reduced) return
    const root = rootRef.current
    const twist = twistRef.current
    if (!root || !twist) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        twist,
        { rotation: -70 },
        {
          rotation: 70,
          ease: 'none',
          scrollTrigger: {
            trigger: root,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
          },
        },
      )
    }, root)
    return () => ctx.revert()
  }, [reduced])

  return (
    <div ref={rootRef} className="relative h-[9.5rem] w-[9.5rem]" role="img" aria-label="Open source, MIT licensed, local-only, no telemetry">
      <div ref={twistRef} className="absolute inset-0">
        <div className={`absolute inset-0 ${reduced ? '' : 'orbit-spin'}`}>
          <svg viewBox="0 0 160 160" className="h-full w-full" aria-hidden="true">
            <defs>
              <path id="orbit-badge-circle" d="M80,80 m-62,0 a62,62 0 1,1 124,0 a62,62 0 1,1 -124,0" />
            </defs>
            <text
              fill="#cbd5e1"
              fillOpacity="0.75"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '11.5px',
                letterSpacing: '0.24em',
                fontWeight: 500,
              }}
            >
              <textPath href="#orbit-badge-circle">{RING_TEXT}</textPath>
            </text>
          </svg>
        </div>
      </div>
      {/* Center glyph: the app icon's four-tile motif, exact hexes. */}
      <svg viewBox="0 0 40 40" className="absolute left-1/2 top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
        <rect x="2" y="2" width="21" height="26" rx="2.5" fill="#2dd4bf" />
        <rect x="25" y="2" width="13" height="15" rx="2.5" fill="#fbbf24" />
        <rect x="25" y="19" width="13" height="9" rx="2.5" fill="#f43f5e" />
        <rect x="2" y="30" width="36" height="8" rx="2.5" fill="#1c2740" />
      </svg>
    </div>
  )
}
