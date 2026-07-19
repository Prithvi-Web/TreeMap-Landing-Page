import { useRef } from 'react'
import CanvasRoot from './components/scene/CanvasRoot'
import Nav from './components/sections/Nav'
import StorySection from './components/sections/StorySection'
import MarqueeBand from './components/sections/MarqueeBand'
import StatsWall from './components/sections/StatsWall'
import FeatureHighlights from './components/sections/FeatureHighlights'
import CTASection from './components/sections/CTASection'
import Footer from './components/sections/Footer'
import ScrollProgressBar from './components/ui/ScrollProgressBar'
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
      {!reduced && <ScrollProgressBar />}
      <CanvasRoot profile={profile} reduced={reduced} webgl={webgl} />
      <Nav reduced={reduced} />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <main className="relative z-10">
            <StorySection pinRef={pinRef} reduced={reduced} />
            <MarqueeBand reduced={reduced} />
            <StatsWall reduced={reduced} />
            <FeatureHighlights reduced={reduced} />
            <CTASection reduced={reduced} />
          </main>
          <Footer reduced={reduced} />
        </div>
      </div>
    </div>
  )
}
