import { useLayoutEffect, useRef, useState } from 'react'
import { gsap } from '../../lib/gsapSetup'
import { introPlanned, markIntroDone } from '../../lib/introGate'

/**
 * First-visit intro (§Kinetic 5): the app icon's three tiles fly into place
 * over a translucent veil with a "READING DISK…" ticker, then the veil lifts
 * into the hero. Under a second of blocking time, once per session, skipped
 * entirely in the calm tier, and any input fast-forwards it.
 *
 * LCP-safe by construction: the hero renders and paints beneath this overlay
 * (it's a sibling, not an ancestor), so first paint metrics are untouched.
 */
export default function IntroOverlay({ enabled }: { enabled: boolean }) {
  const [mounted, setMounted] = useState(() => enabled && introPlanned)
  const overlayRef = useRef<HTMLDivElement>(null)
  const tickerRef = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    if (!mounted) return
    const overlay = overlayRef.current
    if (!overlay) return

    const finish = () => {
      markIntroDone()
      setMounted(false)
    }

    const tl = gsap.timeline({ onComplete: finish })
    const tiles = overlay.querySelectorAll<SVGRectElement>('[data-tile]')
    tl.from(overlay.querySelector('[data-frame]'), {
      scale: 0.82,
      autoAlpha: 0,
      duration: 0.4,
      ease: 'power3.out',
    })
      .from(
        tiles,
        {
          x: (i) => [-110, 90, 60][i],
          y: (i) => [0, -90, 110][i],
          scale: 0.5,
          transformOrigin: '50% 50%',
          autoAlpha: 0,
          duration: 0.45,
          stagger: 0.09,
          ease: 'power3.out',
        },
        0.12,
      )
      .to(
        tickerRef.current,
        {
          scrambleText: { text: 'READING DISK…', chars: '01▮▯#/', speed: 0.5 },
          duration: 0.55,
          ease: 'none',
        },
        0.25,
      )
      .to(overlay, { yPercent: -100, duration: 0.5, ease: 'power4.inOut' }, 0.95)

    // Any input fast-forwards straight to the end.
    const skip = () => tl.progress(1)
    window.addEventListener('wheel', skip, { passive: true, once: true })
    window.addEventListener('pointerdown', skip, { once: true })
    window.addEventListener('keydown', skip, { once: true })

    return () => {
      window.removeEventListener('wheel', skip)
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', skip)
      tl.kill()
    }
  }, [mounted])

  if (!mounted) return null

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-void/85"
    >
      <svg width="104" height="104" viewBox="0 0 1024 1024" className="overflow-visible">
        <g data-frame>
          <rect width="1024" height="1024" rx="228" fill="#0e1729" />
          <rect
            width="1024"
            height="1024"
            rx="228"
            fill="none"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="12"
          />
          {/* The real app icon's tiles, flying home. */}
          <g transform="translate(196 188)">
            <rect data-tile x="0" y="0" width="360" height="648" rx="64" fill="#30D158" />
            <rect data-tile x="408" y="0" width="224" height="368" rx="56" fill="#FFD60A" />
            <rect data-tile x="408" y="424" width="224" height="224" rx="56" fill="#FF453A" />
          </g>
        </g>
      </svg>
      <p ref={tickerRef} className="hud-mono text-[0.72rem] text-teal/90">
        ▮▯ ▯▯▮▮▯▮ ▯▮▯▮…
      </p>
    </div>
  )
}
