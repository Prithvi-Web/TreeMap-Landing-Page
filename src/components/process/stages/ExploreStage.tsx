import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { processState, stageWindow } from '../processState'
import { squarify, type TreemapRect } from '../../../lib/squarify'
import { mulberry32 } from '../../../lib/random'
import { clamp01, smoothstep } from '../../../lib/stages'

/**
 * Dial stage 2 — EXPLORE. The app's drill-down as an endless zoom: a treemap
 * fills the frame, one tile telegraphs amber, and the camera appears to dive
 * through it — the tile's children swelling to become the next full map while
 * the parent generation flies past the viewer. Two full dives across the
 * stage, camera never actually moves.
 *
 * The handoff trick: child layouts are pre-mapped into the parent's target
 * tile (constant local transform M), and the shared zoom group scales toward
 * exactly M⁻¹ — so at the end of a dive, zoom ∘ M = identity, and the child
 * can take over as the new full-frame parent with zero visual discontinuity.
 */

const GEN_COUNT = 3
const TILES_PER_GEN = 11
const W = 3.4
const H = 2.2
const RECT_ASPECT = W / H

const TIER_ROSE = new THREE.Color('#f43f5e')
const TIER_AMBER = new THREE.Color('#fbbf24')
const TIER_TEAL = new THREE.Color('#2dd4bf')
const PULSE_AMBER = new THREE.Color('#fbbf24')
const PULSE_ROSE = new THREE.Color('#f43f5e')

const COL = new THREE.Color()
const DUMMY = new THREE.Object3D()

function easeInOutCubic(v: number): number {
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2
}

type Generation = {
  rects: TreemapRect[]
  target: TreemapRect
  /** Child-into-tile mapping (constant): scale + offset. */
  mapScale: THREE.Vector2
  mapOffset: THREE.Vector2
  /** End-of-dive zoom = 1 / mapScale. */
  zoomEnd: THREE.Vector2
  fillGeometry: THREE.PlaneGeometry
  fillMaterial: THREE.MeshBasicMaterial
  lineGeometry: THREE.BufferGeometry
  lineMaterial: THREE.LineBasicMaterial
  pulseGeometry: THREE.PlaneGeometry
  pulseMaterial: THREE.MeshBasicMaterial
}

function buildGeneration(seed: number): Generation {
  const rand = mulberry32(seed)
  const items = Array.from({ length: TILES_PER_GEN }, (_, i) => ({
    id: String(i),
    value: Math.pow(rand(), 1.9) * 88 + 4,
  }))
  const rects = squarify(items, -W / 2, -H / 2, W, H)

  // Dive target: a large tile whose aspect is closest to the frame's, so the
  // zoom lands without visible distortion. Sorted-desc ⇒ first 6 are biggest.
  let target = rects[0]
  let best = Infinity
  for (const r of rects.slice(0, 6)) {
    const score = Math.abs(Math.log(r.w / r.h / RECT_ASPECT))
    if (score < best) {
      best = score
      target = r
    }
  }

  const mapScale = new THREE.Vector2(target.w / W, target.h / H)
  const mapOffset = new THREE.Vector2(target.x + target.w / 2, target.y + target.h / 2)
  const zoomEnd = new THREE.Vector2(1 / mapScale.x, 1 / mapScale.y)

  const fillGeometry = new THREE.PlaneGeometry(1, 1)
  const fillMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })
  // vertexColors path: instance colors need a white base color attr? For
  // InstancedMesh, per-instance color via setColorAt works with plain
  // material color multiplication — no vertex colors needed on a fill.

  const linePositions = new Float32Array(rects.length * 8 * 3)
  let cursor = 0
  const push = (x: number, y: number) => {
    linePositions[cursor++] = x
    linePositions[cursor++] = y
    linePositions[cursor++] = 0
  }
  for (const r of rects) {
    const x0 = r.x
    const y0 = r.y
    const x1 = r.x + r.w
    const y1 = r.y + r.h
    push(x0, y0)
    push(x1, y0)
    push(x1, y0)
    push(x1, y1)
    push(x1, y1)
    push(x0, y1)
    push(x0, y1)
    push(x0, y0)
  }
  const lineGeometry = new THREE.BufferGeometry()
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
  const lineMaterial = new THREE.LineBasicMaterial({
    color: '#8fa3c8',
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })

  const pulseGeometry = new THREE.PlaneGeometry(target.w * 0.96, target.h * 0.96)
  pulseGeometry.translate(mapOffset.x, mapOffset.y, 0.005)
  const pulseMaterial = new THREE.MeshBasicMaterial({
    color: PULSE_AMBER,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  })

  return {
    rects,
    target,
    mapScale,
    mapOffset,
    zoomEnd,
    fillGeometry,
    fillMaterial,
    lineGeometry,
    lineMaterial,
    pulseGeometry,
    pulseMaterial,
  }
}

export default function ExploreStage({ index }: { index: number }) {
  const rootRef = useRef<THREE.Group>(null)
  const zoomRef = useRef<THREE.Group>(null)
  const genRefs = useRef<Array<THREE.Group | null>>([])
  const fillRefs = useRef<Array<THREE.InstancedMesh | null>>([])

  const generations = useMemo(
    () => Array.from({ length: GEN_COUNT }, (_, g) => buildGeneration(2026_100 + g * 17)),
    [],
  )

  useEffect(() => {
    return () => {
      for (const gen of generations) {
        gen.fillGeometry.dispose()
        gen.fillMaterial.dispose()
        gen.lineGeometry.dispose()
        gen.lineMaterial.dispose()
        gen.pulseGeometry.dispose()
        gen.pulseMaterial.dispose()
      }
    }
  }, [generations])

  // Static per-generation instance matrices + tier colors, set once.
  useEffect(() => {
    generations.forEach((gen, g) => {
      const mesh = fillRefs.current[g]
      if (!mesh) return
      const total = gen.rects.reduce((s, r) => s + r.value, 0)
      let cumulative = 0
      gen.rects.forEach((r, i) => {
        DUMMY.position.set(r.x + r.w / 2, r.y + r.h / 2, -0.002)
        DUMMY.rotation.set(0, 0, 0)
        DUMMY.scale.set(r.w * 0.985, r.h * 0.985, 1)
        DUMMY.updateMatrix()
        mesh.setMatrixAt(i, DUMMY.matrix)
        cumulative += r.value
        const share = cumulative / total
        COL.copy(share <= 0.32 ? TIER_ROSE : share <= 0.62 ? TIER_AMBER : TIER_TEAL)
        mesh.setColorAt(i, COL)
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    })
  }, [generations])

  useFrame(({ clock }) => {
    const root = rootRef.current
    const zoom = zoomRef.current
    if (!root || !zoom) return
    const { p, active } = stageWindow(index, processState.progress)
    const visible = active > 0.001
    root.visible = visible
    if (!visible) return

    const time = clock.elapsedTime
    const aEase = 1 - (1 - active) * (1 - active)
    root.scale.setScalar((0.78 + 0.22 * aEase) * (1 + 0.015 * Math.sin(time * 0.8)))
    root.position.z = -(1 - aEase) * 1.7

    // Two dives across the stage.
    const dv = p * 2
    const dive = Math.min(GEN_COUNT - 2, Math.floor(dv))
    const d = easeInOutCubic(clamp01(dv - dive))
    const parent = generations[dive]

    // Zoom: exponential scale toward the parent target's inverse mapping,
    // offset easing so the target tile glides to frame center.
    const sx = Math.exp(d * Math.log(parent.zoomEnd.x))
    const sy = Math.exp(d * Math.log(parent.zoomEnd.y))
    zoom.scale.set(sx, sy, 1)
    zoom.position.set(-parent.mapOffset.x * d * sx, -parent.mapOffset.y * d * sy, 0)

    for (let g = 0; g < GEN_COUNT; g++) {
      const gen = generations[g]
      const group = genRefs.current[g]
      if (!group) continue
      const isParent = g === dive
      const isChild = g === dive + 1
      group.visible = isParent || isChild

      if (isChild) {
        // Constant mapping into the parent's target tile.
        group.scale.set(parent.mapScale.x, parent.mapScale.y, 1)
        group.position.set(parent.mapOffset.x, parent.mapOffset.y, 0.004)
      } else {
        group.scale.set(1, 1, 1)
        group.position.set(0, 0, 0)
      }

      if (isParent) {
        // The generation flying past the viewer thins out as it grows.
        gen.fillMaterial.opacity = 0.21 * (1 - d * 0.92) * aEase
        gen.lineMaterial.opacity = 0.88 * (1 - smoothstep(0.62, 1, d)) * aEase
        // Target telegraph: amber pulse before the dive commits, a rose
        // flash as the viewer punches through.
        const anticipation = 1 - smoothstep(0.45, 0.72, d)
        const pulse = (0.16 + 0.09 * Math.sin(time * 2.8)) * anticipation
        const punch = smoothstep(0.55, 0.85, d) * (1 - smoothstep(0.85, 1, d))
        COL.copy(PULSE_AMBER).lerp(PULSE_ROSE, smoothstep(0.5, 0.8, d))
        gen.pulseMaterial.color.copy(COL)
        gen.pulseMaterial.opacity = (pulse + punch * 0.3) * aEase
      } else if (isChild) {
        gen.fillMaterial.opacity = 0.21 * smoothstep(0.12, 0.5, d) * aEase
        gen.lineMaterial.opacity = 0.88 * smoothstep(0.05, 0.4, d) * aEase
        gen.pulseMaterial.opacity = 0
      } else {
        gen.fillMaterial.opacity = 0
        gen.lineMaterial.opacity = 0
        gen.pulseMaterial.opacity = 0
      }
    }
  })

  return (
    <group ref={rootRef} visible={false}>
      {/* Static tilt gives the flat maps a hint of dimensionality. */}
      <group rotation={[-0.1, 0.05, 0]}>
        <group ref={zoomRef}>
          {generations.map((gen, g) => (
            <group
              key={g}
              ref={(el) => {
                genRefs.current[g] = el
              }}
            >
              <instancedMesh
                ref={(el) => {
                  fillRefs.current[g] = el
                }}
                args={[gen.fillGeometry, gen.fillMaterial, TILES_PER_GEN]}
                frustumCulled={false}
              />
              <lineSegments geometry={gen.lineGeometry} material={gen.lineMaterial} />
              <mesh geometry={gen.pulseGeometry} material={gen.pulseMaterial} />
            </group>
          ))}
        </group>
      </group>
    </group>
  )
}
