import { useLayoutEffect, type RefObject } from 'react'
import { ScrollTrigger } from '../lib/gsapSetup'
import { scrollState } from '../lib/scrollState'

/**
 * The single scroll driver (§7.1): one pinned container, one ScrollTrigger,
 * one shared `t` in scrollState. The 3D scene and every text overlay read the
 * same value, so nothing can ever drift out of sync. Progress goes through a
 * ref-style module, never React state — no re-renders at 60fps.
 */
export function useScrollTimeline(
  pinRef: RefObject<HTMLElement | null>,
  lengthPx: number,
  enabled: boolean,
) {
  useLayoutEffect(() => {
    if (!enabled) {
      // Reduced motion: the story is presented pre-assembled (§8.6).
      scrollState.setProgress(1)
      return
    }
    const el = pinRef.current
    if (!el) return

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: `+=${lengthPx}`,
      pin: true,
      // 1.5s catch-up: fast flicks glide through the morph instead of
      // jumping — tuned down after real-scroll feedback that 1 felt twitchy.
      scrub: 1.5,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      onUpdate: (self) => scrollState.setProgress(self.progress),
    })
    scrollState.setProgress(trigger.progress)

    // Dev-only QA hooks: pose the story at an exact t without touching real
    // scroll (embedded previews throttle rAF and desync compositor scrolls).
    // Freezing the global timeline stops the scrub from easing back.
    if (import.meta.env.DEV) {
      const w = window as unknown as Record<string, unknown>
      w.__tmSeek = (t: number) => {
        void import('../lib/gsapSetup').then(({ gsap }) => {
          gsap.globalTimeline.pause()
          scrollState.setProgress(t)
        })
      }
      w.__tmPlay = () => {
        void import('../lib/gsapSetup').then(({ gsap }) => gsap.globalTimeline.play())
      }
    }

    return () => {
      trigger.kill()
    }
  }, [pinRef, lengthPx, enabled])
}
