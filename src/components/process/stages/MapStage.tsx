import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { processState, stageWindow } from '../processState'
import { squarify } from '../../../lib/squarify'
import { mulberry32 } from '../../../lib/random'
import { clamp01, lerp } from '../../../lib/stages'

/**
 * Dial stage 1 — MAP. Sixty-odd tiles fly out of a seeded scatter cloud and
 * land as a squarified treemap, biggest first, each one flashing white on
 * touchdown before settling into its tier color. Tiers follow the app's own
 * rule: the tiles covering the top ~30% of bytes go rose, the next band amber,
 * the long tail teal.
 *
 * Per-face shading is baked into the box's vertex colors (the story scene's
 * trick) so instance colors land on exact brand hexes with no lights.
 */

const TILE_COUNT = 60
const RECT = { x: -1.8, y: -1.15, w: 3.6, h: 2.3 }
const DEPTH = 0.1

const FLASH = new THREE.Color('#dcfefa')
const CHAOS = new THREE.Color('#26314d')
const TIER_ROSE = new THREE.Color('#f43f5e')
const TIER_AMBER = new THREE.Color('#fbbf24')
const TIER_TEAL = new THREE.Color('#2dd4bf')

const COL = new THREE.Color()
const DUMMY = new THREE.Object3D()

function easeOutCubic(v: number): number {
  const inv = 1 - v
  return 1 - inv * inv * inv
}

function easeOutBack(v: number): number {
  const c1 = 1.35
  const c3 = c1 + 1
  const inv = v - 1
  return 1 + c3 * inv * inv * inv + c1 * inv * inv
}

type TileRecord = {
  chaos: THREE.Vector3
  chaosRot: THREE.Euler
  target: THREE.Vector3
  size: THREE.Vector2
  tier: THREE.Color
  /** 0..1 start of this tile's flight inside the assembly span. */
  delay: number
  bobPhase: number
}

export default function MapStage({ index }: { index: number }) {
  const rootRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const { records, geometry, material } = useMemo(() => {
    const rand = mulberry32(20260719)

    // Heavily skewed sizes, like real disks: a few hogs, a long tail.
    const items = Array.from({ length: TILE_COUNT }, (_, i) => ({
      id: String(i),
      value: Math.pow(rand(), 2.4) * 99 + 1,
    }))
    const rects = squarify(items, RECT.x, RECT.y, RECT.w, RECT.h)

    // Area-weighted tiers over the sorted-desc rect list.
    const total = rects.reduce((s, r) => s + r.value, 0)
    let cumulative = 0
    const recs: TileRecord[] = rects.map((r, k) => {
      cumulative += r.value
      const share = cumulative / total
      const tier = share <= 0.32 ? TIER_ROSE : share <= 0.62 ? TIER_AMBER : TIER_TEAL
      return {
        chaos: new THREE.Vector3(
          (rand() - 0.5) * 4.4,
          (rand() - 0.5) * 3.4,
          (rand() - 0.5) * 2.4 + 0.6,
        ),
        chaosRot: new THREE.Euler(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI),
        target: new THREE.Vector3(r.x + r.w / 2, r.y + r.h / 2, 0),
        size: new THREE.Vector2(r.w, r.h),
        tier,
        // Sorted-desc order ⇒ big tiles launch first.
        delay: (k / TILE_COUNT) * 0.55,
        bobPhase: rand() * Math.PI * 2,
      }
    })

    // Box with per-face brightness baked into vertex colors: camera face and
    // top full, flanks dimmed — instance color multiplies straight through.
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const faceBrightness = [0.8, 0.8, 1.0, 0.62, 1.0, 0.55] // px nx py ny pz nz
    const colors = new Float32Array(geo.attributes.position.count * 3)
    for (let v = 0; v < geo.attributes.position.count; v++) {
      const b = faceBrightness[Math.floor(v / 4)]
      colors[v * 3] = b
      colors[v * 3 + 1] = b
      colors[v * 3 + 2] = b
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: true,
    })

    return { records: recs, geometry: geo, material: mat }
  }, [])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  // Instance colors start at chaos tone and are rewritten every frame.
  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    for (let i = 0; i < TILE_COUNT; i++) mesh.setColorAt(i, CHAOS)
    if (mesh.instanceColor) {
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
      mesh.instanceColor.needsUpdate = true
    }
  }, [])

  useFrame(({ clock }) => {
    const root = rootRef.current
    const mesh = meshRef.current
    if (!root || !mesh) return
    const { p, active } = stageWindow(index, processState.progress)
    const visible = active > 0.001
    root.visible = visible
    if (!visible) return

    const time = clock.elapsedTime
    const aEase = easeOutCubic(active)
    root.scale.setScalar(0.8 + 0.2 * aEase)
    root.position.z = -(1 - aEase) * 1.7
    material.opacity = aEase

    // Assembly spans essentially the whole window — the last stragglers are
    // still landing as the crossfade begins, so the scene never sits done.
    const assembly = clamp01(p * 1.08)

    for (let i = 0; i < TILE_COUNT; i++) {
      const rec = records[i]
      const local = clamp01((assembly - rec.delay) / 0.45)
      const move = easeOutBack(local)
      const grow = easeOutCubic(local)

      DUMMY.position.set(
        lerp(rec.chaos.x, rec.target.x, move),
        lerp(rec.chaos.y, rec.target.y, move),
        lerp(rec.chaos.z, rec.target.z, move) +
          // Settled wave: a ripple sweeps the map by column so the finished
          // layout visibly breathes instead of freezing.
          (local >= 1 ? Math.sin(time * 1.3 + rec.target.x * 1.6 + rec.bobPhase * 0.3) * 0.03 : 0),
      )
      DUMMY.rotation.set(
        rec.chaosRot.x * (1 - move),
        rec.chaosRot.y * (1 - move),
        rec.chaosRot.z * (1 - move),
      )
      // 0.95 leaves grout lines of void between tiles, like the app's map.
      DUMMY.scale.set(
        lerp(0.1, rec.size.x * 0.95, grow),
        lerp(0.1, rec.size.y * 0.95, grow),
        lerp(0.1, DEPTH, grow),
      )
      DUMMY.updateMatrix()
      mesh.setMatrixAt(i, DUMMY.matrix)

      // Chaos-dim → tier, with a white flash right at touchdown.
      COL.copy(CHAOS).lerp(rec.tier, grow)
      const flashDist = (local - 0.92) / 0.055
      const flash = Math.exp(-flashDist * flashDist)
      if (local > 0.6 && local < 1) COL.lerp(FLASH, flash * 0.5)
      mesh.setColorAt(i, COL)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return (
    <group ref={rootRef} visible={false}>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, TILE_COUNT]}
        frustumCulled={false}
      />
    </group>
  )
}
