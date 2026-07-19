import { useRef } from 'react'
import CanvasRoot from './components/scene/CanvasRoot'
import Nav from './components/sections/Nav'
import StorySection from './components/sections/StorySection'
import MarqueeBand from './components/sections/MarqueeBand'
import ProcessRail from './components/process/ProcessRail'
import StatsWall from './components/sections/StatsWall'
import ViewsGallery from './components/sections/ViewsGallery'
import FeatureHighlights from './components/sections/FeatureHighlights'
import CTASection from './components/sections/CTASection'
import Footer from './components/sections/Footer'
import ScrollProgressBar from './components/ui/ScrollProgressBar'
import IntroOverlay from './components/ui/IntroOverlay'
import OrbitBadge from './components/ui/OrbitBadge'
import TerminalLog from './components/ui/TerminalLog'
import SectionDivider from './components/ui/SectionDivider'
import { useSceneProfile } from './hooks/useSceneProfile'
import { useCalmMode } from './hooks/useCalmMode'
import { useScrollTimeline } from './hooks/useScrollTimeline'
import { useSmoothScroll } from './hooks/useSmoothScroll'
import { useVelocitySkew } from './hooks/useVelocitySkew'

export default function App() {
  const profile = useSceneProfile()
  const { calm: reduced, webgl } = useCalmMode()
  const pinRef = useRef<HTMLDivElement>(null)

  // Pin trigger FIRST, smoother LAST (hook order = effect order): the
  // smoother measures the page and writes an explicit body height at creation,
  // so the story's 7200px pin-spacer must already be in the DOM — otherwise
  // the first paint gets a collapsed scroll range until the next refresh.
  useScrollTimeline(pinRef, profile.scrollLen, !reduced)
  useSmoothScroll(!reduced)
  useVelocitySkew(!reduced)

  // Fixed-position layers (progress bar, canvas, nav) live OUTSIDE the
  // smoother's content: ScrollSmoother translates #smooth-content, and
  // position:fixed inside a transformed ancestor silently becomes absolute.
  return (
    <div id="top">
      <IntroOverlay enabled={!reduced} />
      {!reduced && <ScrollProgressBar />}
      <CanvasRoot profile={profile} reduced={reduced} webgl={webgl} />
      <Nav reduced={reduced} />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          {/* Rhythm: pinned set piece → breather → pinned set piece. The
              story, the pipeline dial and the views gallery each own a pin;
              the marquee, terminal log, stats and dividers breathe between
              them so the scroll never sits still and never exhausts. */}
          <main className="relative z-10">
            <StorySection pinRef={pinRef} reduced={reduced} />
            <MarqueeBand reduced={reduced} />
            <ProcessRail reduced={reduced} />
            <section aria-label="Example scan session" className="px-6 py-16">
              <div className="mx-auto max-w-3xl overflow-x-auto">
                <TerminalLog reduced={reduced} />
              </div>
            </section>
            <StatsWall reduced={reduced} />
            <SectionDivider reduced={reduced} label="SYS.03 / VIEWS" />
            <ViewsGallery reduced={reduced} />
            <FeatureHighlights reduced={reduced} />
            <div className="flex justify-center pb-4 pt-10">
              <OrbitBadge reduced={reduced} />
            </div>
            <CTASection reduced={reduced} />
          </main>
          <Footer reduced={reduced} />
        </div>
      </div>
    </div>
  )
}
