import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

// Single registration point so every consumer shares one configured gsap.
// (ScrollTrigger and SplitText are both free since GSAP 3.13.)
gsap.registerPlugin(ScrollTrigger, SplitText)

// Dev-only: lets QA tooling reach the ticker (e.g. lagSmoothing(0) so
// screenshots reflect wall-clock state in rAF-throttled embedded previews).
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).gsap = gsap
}

export { gsap, ScrollTrigger, SplitText }
