import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import CubeField from './CubeField'
import ScanSweep from './ScanSweep'
import CameraRig from './CameraRig'
import GridFloor from './GridFloor'
import type { SceneProfile } from '../../hooks/useSceneProfile'

/**
 * The full-viewport 3D scene (§6.7). Rendered with tone mapping off (`flat`)
 * and entirely unlit — per-face shading is baked into the slab geometry's
 * vertex colors — so the final treemap tiles land on the exact brand hex
 * values. The canvas is transparent; the CSS atmosphere gradient behind it
 * supplies the background, and FogExp2 in the same void color stitches the
 * two together.
 */
export default function Experience({ profile, reduced }: { profile: SceneProfile; reduced: boolean }) {
  return (
    <Canvas
      flat
      dpr={[1, profile.dprCap]}
      frameloop={reduced ? 'demand' : 'always'}
      camera={{ fov: profile.fov, near: 0.1, far: 90, position: [0, 2.4, 14.2] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
    >
      <fogExp2 attach="fog" args={['#0a0f1c', profile.fogDensity]} />
      <ContextGuard />
      <VisibilityInvalidate />
      {import.meta.env.DEV && <DevHiddenTicker />}
      <CameraRig profile={profile} reduced={reduced} />
      <CubeField profile={profile} reduced={reduced} />
      {!reduced && <ScanSweep profile={profile} />}
      <GridFloor reduced={reduced} />
    </Canvas>
  )
}

/**
 * GPU context loss (memory pressure, driver resets, waking from sleep) kills
 * the canvas permanently unless the lost event's default is prevented — only
 * then does the browser fire `webglcontextrestored` and let three.js rebuild.
 * Without this, the story field goes black at random and stays black.
 */
function ContextGuard() {
  const gl = useThree((s) => s.gl)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const canvas = gl.domElement
    const onLost = (event: Event) => event.preventDefault()
    const onRestored = () => invalidate()
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [gl, invalidate])
  return null
}

/**
 * In demand-mode (reduced motion) the canvas renders only when invalidated;
 * returning from a background tab needs one fresh frame or the compositor
 * can show an empty canvas.
 */
function VisibilityInvalidate() {
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const refresh = () => invalidate()
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    window.addEventListener('pageshow', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
      window.removeEventListener('pageshow', refresh)
    }
  }, [invalidate])
  return null
}

/**
 * Dev-only QA aid: rAF never fires in a hidden/embedded tab, freezing the
 * WebGL loop (browsers throttle it; GSAP has a timer fallback, R3F doesn't).
 * Ticking advance() keeps screenshots truthful. Stripped from prod builds.
 */
function DevHiddenTicker() {
  const advance = useThree((s) => s.advance)
  useEffect(() => {
    const id = setInterval(() => {
      if (document.hidden) advance(performance.now())
    }, 250)
    return () => clearInterval(id)
  }, [advance])
  return null
}
