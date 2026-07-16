import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from '../../lib/scrollState'
import { sweepState } from '../../lib/stages'
import type { SceneProfile } from '../../hooks/useSceneProfile'

/**
 * The scan line (§6.5): a soft additive light-wall that ping-pongs through
 * the cube formation during the 30%→60% scroll window. CubeField reads the
 * same sweepState() so cubes flash exactly where the wall is.
 */
export default function ScanSweep({ profile }: { profile: SceneProfile }) {
  const meshRef = useRef<THREE.Mesh>(null)

  const texture = useMemo(() => {
    const size = 64
    const data = new Uint8Array(size * size * 4)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x / (size - 1)) * 2 - 1
        const dy = (y / (size - 1)) * 2 - 1
        const d = Math.min(1, Math.sqrt(dx * dx + dy * dy))
        const fall = Math.pow(1 - d, 1.8)
        const i = (y * size + x) * 4
        // Teal body with a near-white core.
        data[i] = Math.round(45 + 180 * fall)
        data[i + 1] = Math.round(212 + 40 * fall)
        data[i + 2] = Math.round(191 + 60 * fall)
        data[i + 3] = Math.round(255 * fall)
      }
    }
    const tex = new THREE.DataTexture(data, size, size)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.magFilter = THREE.LinearFilter
    tex.minFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return tex
  }, [])

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
    [texture],
  )

  useFrame((state) => {
    const mesh = meshRef.current
    if (!mesh) return
    const sweep = sweepState(scrollState.progress, profile.layout.w / 2 + 1)
    mesh.position.x = sweep.x
    material.opacity = sweep.gate * (0.85 + Math.sin(state.clock.elapsedTime * 7) * 0.09)
    mesh.visible = sweep.gate > 0.01
  })

  return (
    <mesh
      ref={meshRef}
      material={material}
      position={[0, 1.4, 0]}
      rotation={[0, Math.PI / 2, 0]}
      scale={[profile.layout.h + 7, 6.2, 1]}
      visible={false}
    >
      <planeGeometry />
    </mesh>
  )
}
