import { useLayoutEffect, useRef } from 'react'
import { ScrollTrigger } from '../../lib/gsapSetup'

/**
 * Thin fixed bar at the very top (§10): its fill is the teal→amber→rose
 * treemap scale. Tracks the WHOLE page (story pin + marquee + stats +
 * features + CTA + footer), not just the pinned story — its own trigger,
 * deliberately not a scrollState consumer (§Kinetic 1).
 */
export default function ScrollProgressBar() {
  const fillRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const trigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        const el = fillRef.current
        if (!el) return
        el.style.transform = `scaleX(${self.progress})`
        el.style.opacity = self.progress > 0.002 ? '1' : '0'
      },
    })
    return () => trigger.kill()
  }, [])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[3px]" aria-hidden="true">
      <div
        ref={fillRef}
        className="h-full w-full origin-left transition-opacity duration-300"
        style={{
          transform: 'scaleX(0)',
          opacity: 0,
          background:
            'linear-gradient(90deg, var(--color-teal), var(--color-amber), var(--color-rose))',
        }}
      />
    </div>
  )
}
