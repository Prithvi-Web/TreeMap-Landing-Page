import { useLayoutEffect, useRef } from 'react'
import { scrollState } from '../../lib/scrollState'

/**
 * Thin fixed bar at the very top (§10): its fill is the teal→amber→rose
 * treemap scale, doubling as progress through the pinned story.
 */
export default function ScrollProgressBar() {
  const fillRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(
    () =>
      scrollState.subscribe((t) => {
        const el = fillRef.current
        if (!el) return
        el.style.transform = `scaleX(${t})`
        el.style.opacity = t > 0.002 ? '1' : '0'
      }),
    [],
  )

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
