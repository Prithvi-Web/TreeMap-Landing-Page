import { useRef } from 'react'
import CanvasRoot from './components/scene/CanvasRoot'
import Nav from './components/sections/Nav'
import StorySection from './components/sections/StorySection'
import FeatureHighlights from './components/sections/FeatureHighlights'
import CTASection from './components/sections/CTASection'
import Footer from './components/sections/Footer'
import ScrollProgressBar from './components/ui/ScrollProgressBar'
import { useSceneProfile } from './hooks/useSceneProfile'
import { useCalmMode } from './hooks/useCalmMode'
import { useScrollTimeline } from './hooks/useScrollTimeline'

export default function App() {
  const profile = useSceneProfile()
  const { calm: reduced, webgl } = useCalmMode()
  const pinRef = useRef<HTMLDivElement>(null)

  useScrollTimeline(pinRef, profile.scrollLen, !reduced)

  return (
    <div id="top">
      {!reduced && <ScrollProgressBar />}
      <CanvasRoot profile={profile} reduced={reduced} webgl={webgl} />
      <Nav />
      <main className="relative z-10">
        <StorySection pinRef={pinRef} reduced={reduced} />
        <FeatureHighlights reduced={reduced} />
        <CTASection reduced={reduced} />
      </main>
      <Footer />
    </div>
  )
}
