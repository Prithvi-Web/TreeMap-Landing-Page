import { Suspense, lazy, useEffect, useState } from 'react'
import MosaicBackdrop from './MosaicBackdrop'
import type { SceneProfile } from '../../hooks/useSceneProfile'

// Lazy so the three.js bundle never blocks first paint (§8.7) — the CSS
// atmosphere below is already the correct background while it streams in.
const Experience = lazy(() => import('./Experience'))

type CanvasRootProps = {
  profile: SceneProfile
  reduced: boolean
  /** False on software-only renderers: skip WebGL entirely (§8). */
  webgl: boolean
}

export default function CanvasRoot({ profile, reduced, webgl }: CanvasRootProps) {
  // Mount the scene only after first paint has settled: content and fonts
  // win the critical path; the canvas fades in a beat later.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!webgl) return
    let idleId: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = () => {
      if ('requestIdleCallback' in window) {
        idleId = requestIdleCallback(() => setReady(true), { timeout: 1200 })
      } else {
        timer = setTimeout(() => setReady(true), 350)
      }
    }
    if (document.readyState === 'complete') arm()
    else {
      window.addEventListener('load', arm, { once: true })
    }
    return () => {
      window.removeEventListener('load', arm)
      if (idleId !== undefined) cancelIdleCallback(idleId)
      clearTimeout(timer)
    }
  }, [webgl])

  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
      <div className="atmosphere absolute inset-0" />
      <div className="atmosphere-grid absolute inset-0" />
      {!webgl && <MosaicBackdrop />}
      {webgl && (
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: ready ? 1 : 0 }}
        >
          {ready && (
            <Suspense fallback={null}>
              <Experience profile={profile} reduced={reduced} />
            </Suspense>
          )}
        </div>
      )}
    </div>
  )
}
