# Kinetic Scroll Design — TreeMap Landing Page

**Date:** 2026-07-18 · **Status:** approved by user (build all slices, incl. intro)
**Reference:** https://www.cinetica.studio/ — GSAP 3.15 + ScrollTrigger + inertial smoothing + split-text reveals + marquee bands + giant-type moments.

## Goal

Layer cinetica-grade scroll animation over the existing 3-act 3D story without
re-timing it, using only the GSAP plugins already installed (all free since
3.13: ScrollSmoother, SplitText, ScrambleText, DrawSVG).

## Invariants (do not violate)

- Pinned story pacing untouched: scrollLen 7200/5800/4600, scrub 1.5,
  stage edges in `src/lib/stages.ts`, `WINDOWS[]` in StorySection.
- `scrollState` keeps exactly ONE writer (`useScrollTimeline`). New sections
  use their own non-pinned ScrollTriggers; HUD/counter may *subscribe* only.
- Exact brand hexes; unlit tiles; no new colors.
- Calm tier (`useCalmMode`) gets today's static experience: no smoother, no
  intro, no velocity skew, static marquee/stats/footer, nav always visible.
- Lighthouse mobile ≥ 78. Transform/opacity/textContent writes only.

## Slices

1. **Foundation** — ScrollSmoother (`smooth: 1.2`, `effects: true`,
   `smoothTouch: false`), App restructure (fixed layers outside
   `#smooth-wrapper`), CSS `scroll-behavior: auto` while smoother active
   (native jump + smoother easing handles the `#get` anchor), progress bar
   remapped to full-page (`end: 'max'`).
2. **Story layer** — SplitText word-mask scrub reveals on act H2s (driven off
   each window's existing opacity value); live file counter synced to the scan
   band (30–60%, eased, e.g. →412,806 files); hero corner HUD (date, version,
   ScrambleText "READY TO SCAN" ticker) as an independent scrollState
   subscriber — `WINDOWS[]` indices untouched; per-chip slide+settle.
3. **Showpieces** — two opposite-direction scrubbed marquee strips (giant
   brand-gradient text, −2° tilt) after the story; stats wall with
   screen-height type (500K files / SHA-256 / 0 telemetry / MIT), char
   roll-ins, scrubbed clip reveal on an elevated full-bleed band.
4. **Page-wide** — feature cards: alternating-side scrubbed entrances with
   settle rotation + per-column depth (`data-speed`); divider draw-on;
   CTA "Get TreeMap." char flip-in + button cascade + star count-up; footer
   curtain reveal + `.hr-brand` draw; nav hide-on-down/show-on-up
   (velocity-based); subtle global velocity skew (≤1.5°) on marquee + cards.
5. **Intro** — session-once (<1s) translucent overlay: 4 app-icon tiles fly
   into place + "READING DISK…" ticker, then lifts into the existing hero
   SplitText. Hero paints beneath (LCP-safe). Skipped in calm tier.

Check-in with the user after every slice (screenshot / local URL), per their
standing per-feature check-in rule. Commit a slice only after its check-in
passes. Final: multi-agent diff review + Lighthouse + full scroll-through.

## Known hazards (from architecture audit)

- Adding overlay groups to StorySection means renumbering `setGroup(n)` —
  avoided by making HUD/counter independent subscribers.
- `__tmSeek` pauses the global timeline — new time-based tweens freeze under
  it too; acceptable (dev-only), `__tmPlay()` resumes.
- Preview-pane rAF throttling shows stale canvas frames — use the DEV hidden
  ticker pattern when verifying (see 2026-07-18 memory).
- ScrollSmoother moves pinning to transforms — verify pin start/end and
  `anticipatePin` behavior after slice 1 before building on top.
