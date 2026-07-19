import { useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { processState } from './processState'
import ScanStage from './stages/ScanStage'
import MapStage from './stages/MapStage'
import ExploreStage from './stages/ExploreStage'
import DetectStage from './stages/DetectStage'
import ReclaimStage from './stages/ReclaimStage'

/**
 * The dial's WebGL heart — a second, small canvas that lives only inside the
 * pinned process rail. Kept in its own lazy chunk so ProcessRail (main bundle)
 * never drags three.js into the critical path; the fixed story canvas already
 * follows the same rule via the lazy Experience.
 *
 * Same rendering doctrine as the story scene: `flat` (no tone mapping), fully
 * unlit, transparent — the DOM tick-ring and atmosphere behind it supply the
 * frame. All five stages stay mounted; each one culls itself via its `active`
 * window so crossfades never mount/unmount mid-scroll.
 */
export default function DialScene({ frameloop }: { frameloop: 'always' | 'never' }) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      frameloop={frameloop}
      camera={{ fov: 40, near: 0.1, far: 40, position: [0, 0, 8.4] }}
      // preserveDrawingBuffer: the dial is tiny (≤30rem square), so the cost
      // is negligible — and it makes the canvas readable by QA tooling and
      // resilient to compositor snapshots in embedded/driven browsers.
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      onCreated={(state) => {
        state.gl.setClearColor(0x000000, 0)
        // QA affordances (same spirit as ?rm): expose the scene graph plus a
        // manual frame pump. Embedded/driven panes starve rAF between
        // interactions — GSAP has a timer fallback, R3F does not — so QA
        // tooling must be able to force a frame before reading pixels.
        if (new URLSearchParams(window.location.search).has('qa')) {
          const w = window as unknown as Record<string, unknown>
          w.__dialScene = state.scene
          w.__dialAdvance = () => state.advance(performance.now() / 1000)
        }
      }}
    >
      <SizeGuard />
      <ContinuousRig />
      <ScanStage index={0} />
      <MapStage index={1} />
      <ExploreStage index={2} />
      <DetectStage index={3} />
      <ReclaimStage index={4} />
    </Canvas>
  )
}

/**
 * The user's verdict on v1 was "the animation stops after some point" — each
 * scene finished its set piece early and idled. This rig guarantees the dial
 * as a WHOLE never rests: the scene root breathes a slow orbit from wall time
 * and leans with rail progress, and the camera dollies gently in and back out
 * across the full pin. Per-scene choreography rides on top of it.
 */
function ContinuousRig() {
  useFrame(({ scene, camera, clock }) => {
    const t = processState.progress
    const time = clock.elapsedTime
    scene.rotation.y = Math.sin(t * Math.PI * 2) * 0.09 + Math.sin(time * 0.16) * 0.05
    scene.rotation.x = Math.sin(t * Math.PI * 3) * 0.045 + Math.cos(time * 0.13) * 0.03
    camera.position.z = 8.4 - Math.sin(t * Math.PI) * 0.55
  })
  return null
}

/**
 * Occluded/embedded windows can suspend ResizeObserver (the Liquid Glass
 * lesson, replayed): R3F then never learns the canvas size and renders a
 * 0-viewport — a mounted, healthy scene graph with zero pixels. Measure the
 * wrapper directly on a short fuse and on visibility flips, and hand R3F the
 * real size whenever its own measurement is missing or stale.
 */
function SizeGuard() {
  const setSize = useThree((s) => s.setSize)
  const gl = useThree((s) => s.gl)
  const get = useThree((s) => s.get)

  useEffect(() => {
    const el = gl.domElement.parentElement
    if (!el) return
    const fix = () => {
      const rect = el.getBoundingClientRect()
      const current = get().size
      if (rect.width > 4 && Math.abs(current.width - rect.width) > 4) {
        setSize(rect.width, rect.height)
      }
    }
    const t1 = setTimeout(fix, 250)
    const t2 = setTimeout(fix, 1200)
    document.addEventListener('visibilitychange', fix)
    window.addEventListener('focus', fix)
    window.addEventListener('pageshow', fix)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      document.removeEventListener('visibilitychange', fix)
      window.removeEventListener('focus', fix)
      window.removeEventListener('pageshow', fix)
    }
  }, [gl, setSize, get])

  return null
}
