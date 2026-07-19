import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ScrollSmoother } from 'gsap/ScrollSmoother'
import { SplitText } from 'gsap/SplitText'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'

// Single registration point so every consumer shares one configured gsap.
// (All of these are free since GSAP 3.13.)
gsap.registerPlugin(ScrollTrigger, ScrollSmoother, SplitText, ScrambleTextPlugin)

// QA access to the ticker — dev builds always, prod only behind ?qa (the same
// opt-in as the dial's scene hooks). Driven/embedded browsers starve rAF
// between interactions, freezing the smoother and pinned sections mid-flight;
// QA tooling calls gsap.ticker.tick() to advance the whole system manually.
if (import.meta.env.DEV || new URLSearchParams(window.location.search).has('qa')) {
  ;(window as unknown as Record<string, unknown>).gsap = gsap
}

export { gsap, ScrollTrigger, ScrollSmoother, SplitText }
