import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from '../../lib/scrollState'
import { smoothstep } from '../../lib/stages'
import type { SceneProfile } from '../../hooks/useSceneProfile'

/**
 * Scroll-driven camera (§6.6): a CatmullRom path through five keyframes —
 * wide hero shot → dolly into the chaos → pulled-back 3/4 watching the scan →
 * settling into a top-down hero angle on the finished treemap. Position and
 * look-target are both damped so scrub steps never read as jitter.
 */
const POS_TARGET = new THREE.Vector3()
const LOOK_TARGET = new THREE.Vector3()

function keyframes(isMobile: boolean) {
  const s = isMobile ? 1.45 : 1
  const positions = [
    new THREE.Vector3(0 * s, 2.4 * s, 14.2 * s),
    new THREE.Vector3(2.6 * s, 1.8 * s, 10.6 * s),
    new THREE.Vector3(-8.2 * s, 4.8 * s, 10.2 * s),
    new THREE.Vector3(-3.0 * s, 11.6 * s, 8.8 * s),
    new THREE.Vector3(0, 13.6 * s, 7.2 * s),
  ]
  const looks = [
    new THREE.Vector3(0, 0.6, 0),
    new THREE.Vector3(0, 0.4, 0),
    new THREE.Vector3(0, 0.6, 0),
    new THREE.Vector3(0, 0, -0.3),
    new THREE.Vector3(0, 0, -0.8),
  ]
  return { positions, looks }
}

export default function CameraRig({ profile, reduced }: { profile: SceneProfile; reduced: boolean }) {
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const lookCurrent = useRef(new THREE.Vector3(0, 0.6, 0))

  const { posCurve, lookCurve } = useMemo(() => {
    const { positions, looks } = keyframes(profile.isMobile)
    return {
      posCurve: new THREE.CatmullRomCurve3(positions, false, 'centripetal', 0.5),
      lookCurve: new THREE.CatmullRomCurve3(looks, false, 'centripetal', 0.5),
    }
  }, [profile.isMobile])

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return
    camera.fov = profile.fov
    camera.near = 0.1
    camera.far = 90
    camera.updateProjectionMatrix()
  }, [camera, profile.fov])

  // Reduced motion: park the camera on the final treemap hero angle.
  useEffect(() => {
    if (!reduced) return
    posCurve.getPoint(1, POS_TARGET)
    lookCurve.getPoint(1, LOOK_TARGET)
    camera.position.copy(POS_TARGET)
    lookCurrent.current.copy(LOOK_TARGET)
    camera.lookAt(LOOK_TARGET)
    invalidate()
  }, [reduced, posCurve, lookCurve, camera, invalidate])

  useFrame((state, delta) => {
    if (reduced) return
    const t = scrollState.progress
    const time = state.clock.elapsedTime

    posCurve.getPoint(t, POS_TARGET)
    lookCurve.getPoint(t, LOOK_TARGET)

    // Idle ambience: a gentle drift on the untouched hero, a slow orbit once
    // the treemap has settled behind the CTA (§2's two "own clock" moments).
    const heroIdle = 1 - smoothstep(0, 0.07, t)
    const ctaIdle = smoothstep(0.985, 1, t)
    POS_TARGET.x += Math.sin(time * 0.28) * 0.32 * heroIdle + Math.sin(time * 0.11) * 1.15 * ctaIdle
    POS_TARGET.y += Math.sin(time * 0.2) * 0.18 * heroIdle + Math.sin(time * 0.09) * 0.4 * ctaIdle
    POS_TARGET.z += Math.cos(time * 0.13) * 0.85 * ctaIdle

    // Critically-damped chase keeps scrub steps buttery.
    const k = 1 - Math.exp(-delta * 9)
    camera.position.lerp(POS_TARGET, k)
    lookCurrent.current.lerp(LOOK_TARGET, k)
    camera.lookAt(lookCurrent.current)
  })

  return null
}
