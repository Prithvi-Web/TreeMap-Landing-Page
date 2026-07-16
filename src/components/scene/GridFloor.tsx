import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from '../../lib/scrollState'
import { chaosToScan, scanToTreemap, clamp01 } from '../../lib/stages'

/**
 * Low-opacity reference grid for depth cues. It brightens while the cubes
 * snap onto their scan tracks (it *is* the tracks) and recedes once the
 * treemap settles.
 */
export default function GridFloor({ reduced }: { reduced: boolean }) {
  const matRef = useRef<THREE.Material | null>(null)

  const grid = useMemo(() => {
    const helper = new THREE.GridHelper(46, 46, '#2a3a5e', '#141d33')
    const mat = helper.material as THREE.Material
    mat.transparent = true
    mat.opacity = 0.16
    helper.position.y = -0.02
    matRef.current = mat
    return helper
  }, [])

  useFrame(() => {
    const mat = matRef.current
    if (!mat) return
    const t = reduced ? 1 : scrollState.progress
    const align = chaosToScan(t)
    const settle = scanToTreemap(t)
    mat.opacity = clamp01(0.14 + align * 0.3 - settle * 0.26)
  })

  return <primitive object={grid} />
}
