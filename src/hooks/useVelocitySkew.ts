import { useLayoutEffect } from 'react'
import { gsap, ScrollTrigger } from '../lib/gsapSetup'

/**
 * Scroll-momentum shear (§Kinetic 4): fast scrolling skews the marquee rows
 * (±2°) and feature cards (±0.8°) with the direction of travel, springing
 * back to rest as the page settles. Purely a velocity read — it never fights
 * the scrub tweens, because gsap composes skew with their transforms.
 */
export function useVelocitySkew(enabled: boolean) {
  useLayoutEffect(() => {
    if (!enabled) return

    const marquee = gsap.utils.toArray<HTMLElement>('.marquee-row')
    const cards = gsap.utils.toArray<HTMLElement>('[data-skew]')
    if (marquee.length === 0 && cards.length === 0) return

    const setters = [
      ...marquee.map((el) => ({ to: gsap.quickTo(el, 'skewY', { duration: 0.4, ease: 'power2.out' }), amp: 2 })),
      ...cards.map((el) => ({ to: gsap.quickTo(el, 'skewY', { duration: 0.5, ease: 'power2.out' }), amp: 0.8 })),
    ]

    const clamp = gsap.utils.clamp(-1, 1)
    const trigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        const v = clamp(self.getVelocity() / 2400)
        for (const s of setters) s.to(v * s.amp)
      },
    })
    // Ensure everything rests at 0 when scrolling stops.
    const onStop = () => {
      for (const s of setters) s.to(0)
    }
    ScrollTrigger.addEventListener('scrollEnd', onStop)

    return () => {
      ScrollTrigger.removeEventListener('scrollEnd', onStop)
      trigger.kill()
      for (const el of [...marquee, ...cards]) gsap.set(el, { skewY: 0 })
    }
  }, [enabled])
}
