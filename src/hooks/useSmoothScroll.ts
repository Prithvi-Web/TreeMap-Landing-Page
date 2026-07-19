import { useLayoutEffect } from 'react'
import { ScrollSmoother } from '../lib/gsapSetup'

/**
 * Inertial page glide (§Kinetic 1): one ScrollSmoother over
 * #smooth-wrapper/#smooth-content. Native scroll still owns the scrollbar and
 * window.scrollY — the smoother only eases the content's transform toward it,
 * so every existing ScrollTrigger (including the story pin) and the Nav's
 * scrollY listener keep working unchanged.
 *
 * Touch devices keep native scrolling (smoothTouch stays off): finger-tracking
 * feels wrong when smoothed, and the transform loop costs battery.
 *
 * Calm tier: never created — the hook is a no-op when `enabled` is false.
 */
export function useSmoothScroll(enabled: boolean) {
  useLayoutEffect(() => {
    if (!enabled) return
    // Touch-only devices: skip the smoother entirely. With smoothTouch off it
    // adds nothing there, but it still writes an explicit body height and
    // clamps scrolling against its own viewport math — which runs afoul of
    // mobile URL-bar resizing (the page stops ~70px short of the footer).
    // Native scrolling + CSS scroll-behavior already feel right on touch.
    if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return

    // The smoother supplies the glide; CSS smooth-behavior on top of it would
    // double-ease anchor jumps (#get, #top). Native-instant jump + smoother
    // catch-up is exactly the glide we want.
    const html = document.documentElement
    const prevBehavior = html.style.scrollBehavior
    html.style.scrollBehavior = 'auto'

    const smoother = ScrollSmoother.create({
      wrapper: '#smooth-wrapper',
      content: '#smooth-content',
      smooth: 1.2,
      effects: true,
      smoothTouch: false,
    })

    // ScrollSmoother doesn't support native #anchor jumps — it re-asserts its
    // own position and the jump is lost (documented GSAP limitation). Intercept
    // same-page hash links and glide there instead. The 96px offset honors the
    // CTA's scroll-mt-24 so the card never hides under the fixed nav.
    const onHashClick = (event: MouseEvent) => {
      const link = (event.target as HTMLElement).closest?.('a[href^="#"]')
      if (!(link instanceof HTMLAnchorElement)) return
      const id = link.getAttribute('href')!.slice(1)
      const target = id === '' ? null : document.getElementById(id)
      event.preventDefault()
      if (!target || id === 'top') {
        smoother.scrollTo(0, true)
      } else {
        smoother.scrollTo(Math.max(0, smoother.offset(target, 'top top') - 96), true)
      }
      history.replaceState(null, '', id ? `#${id}` : ' ')
    }
    document.addEventListener('click', onHashClick)

    return () => {
      document.removeEventListener('click', onHashClick)
      smoother.kill()
      html.style.scrollBehavior = prevBehavior
    }
  }, [enabled])
}
