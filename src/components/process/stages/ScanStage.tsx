import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { processState, stageWindow } from '../processState'
import { mulberry32 } from '../../../lib/random'
import { clamp01 } from '../../../lib/stages'

/**
 * Dial stage 0 — SCAN. A disk platter being read: concentric wireframe rings,
 * a teal sweep arm making 2.5 revolutions across the stage, and a field of
 * dormant file-particles that ignite as the beam passes their angle and decay
 * behind it — the radar-paint the app's own scan sweep is named for.
 *
 * Unlit throughout (per-face/vertex color only); every material fades with the
 * stage's `active` window so the crossfade to MAP is a dissolve, not a pop.
 */

const RING_RADII = [0.52, 0.92, 1.32, 1.66, 1.9]
const RING_SEGMENTS = 96
const TICK_COUNT = 72
const PARTICLE_COUNT = 1000
const SWEEP_TURNS = 2.5
/** Wedge trailing the arm, radians. */
const WEDGE_ARC = 0.62
const WEDGE_STEPS = 22

const TEAL = new THREE.Color('#2dd4bf')
const WHITE = new THREE.Color('#ffffff')
/** Dormant particles sit just above the gridline tone so they read on void. */
const DIM = new THREE.Color('#1c2740').lerp(new THREE.Color('#2dd4bf'), 0.18)

// Scratch — reused every frame, never allocated inside useFrame.
const COL = new THREE.Color()

function easeOutCubic(v: number): number {
  const inv = 1 - v
  return 1 - inv * inv * inv
}

function easeOutBack(v: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  const inv = v - 1
  return 1 + c3 * inv * inv * inv + c1 * inv * inv
}

export default function ScanStage({ index }: { index: number }) {
  const rootRef = useRef<THREE.Group>(null)
  const platterRef = useRef<THREE.Group>(null)
  const armRef = useRef<THREE.Group>(null)
  const ringRefs = useRef<Array<THREE.LineLoop | null>>([])
  const pointsRef = useRef<THREE.Points>(null)

  const assets = useMemo(() => {
    const rand = mulberry32(20260718)

    // Concentric rings — one LineLoop each so entrance can stagger per ring.
    const ringGeometries = RING_RADII.map((radius) => {
      const positions = new Float32Array(RING_SEGMENTS * 3)
      for (let s = 0; s < RING_SEGMENTS; s++) {
        const a = (s / RING_SEGMENTS) * Math.PI * 2
        positions[s * 3] = Math.cos(a) * radius
        positions[s * 3 + 1] = Math.sin(a) * radius
        positions[s * 3 + 2] = 0
      }
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      return geometry
    })
    const ringMaterial = new THREE.LineBasicMaterial({
      color: '#3b4a6b',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })

    // Outer tick ring — merged segments, one draw call.
    const tickPositions = new Float32Array(TICK_COUNT * 6)
    for (let i = 0; i < TICK_COUNT; i++) {
      const a = (i / TICK_COUNT) * Math.PI * 2
      const major = i % 6 === 0
      const r0 = major ? 1.98 : 2.02
      const r1 = 2.08
      tickPositions[i * 6] = Math.cos(a) * r0
      tickPositions[i * 6 + 1] = Math.sin(a) * r0
      tickPositions[i * 6 + 2] = 0
      tickPositions[i * 6 + 3] = Math.cos(a) * r1
      tickPositions[i * 6 + 4] = Math.sin(a) * r1
      tickPositions[i * 6 + 5] = 0
    }
    const tickGeometry = new THREE.BufferGeometry()
    tickGeometry.setAttribute('position', new THREE.BufferAttribute(tickPositions, 3))
    const tickMaterial = new THREE.LineBasicMaterial({
      color: '#2dd4bf',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })

    // Sweep wedge — a fan behind the arm whose vertex alpha falls off with
    // trailing angle, so the beam reads as a comet tail without blending hacks.
    const wedgePositions = new Float32Array((WEDGE_STEPS + 1) * 2 * 3)
    const wedgeColors = new Float32Array((WEDGE_STEPS + 1) * 2 * 4)
    const wedgeIndex: number[] = []
    for (let s = 0; s <= WEDGE_STEPS; s++) {
      const f = s / WEDGE_STEPS
      const a = -f * WEDGE_ARC
      const alpha = (1 - f) * (1 - f) * 0.5
      const base = s * 2
      wedgePositions[base * 3] = Math.cos(a) * 0.14
      wedgePositions[base * 3 + 1] = Math.sin(a) * 0.14
      wedgePositions[base * 3 + 2] = 0.01
      wedgePositions[(base + 1) * 3] = Math.cos(a) * 1.9
      wedgePositions[(base + 1) * 3 + 1] = Math.sin(a) * 1.9
      wedgePositions[(base + 1) * 3 + 2] = 0.01
      for (const vi of [base, base + 1]) {
        wedgeColors[vi * 4] = TEAL.r
        wedgeColors[vi * 4 + 1] = TEAL.g
        wedgeColors[vi * 4 + 2] = TEAL.b
        wedgeColors[vi * 4 + 3] = alpha * (vi === base ? 0.4 : 1)
      }
      if (s < WEDGE_STEPS) {
        wedgeIndex.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
      }
    }
    const wedgeGeometry = new THREE.BufferGeometry()
    wedgeGeometry.setAttribute('position', new THREE.BufferAttribute(wedgePositions, 3))
    wedgeGeometry.setAttribute('color', new THREE.BufferAttribute(wedgeColors, 4))
    wedgeGeometry.setIndex(wedgeIndex)
    const wedgeMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    // The arm itself — a bright leading edge.
    const armGeometry = new THREE.PlaneGeometry(1.76, 0.016)
    armGeometry.translate(0.14 + 0.88, 0, 0.02)
    const armMaterial = new THREE.MeshBasicMaterial({
      color: '#8ff7ea',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    })

    // File particles seeded across the platter (denser toward the rim, like
    // real data). Angle stored for the radar-paint decay math.
    const particlePositions = new Float32Array(PARTICLE_COUNT * 3)
    const particleColors = new Float32Array(PARTICLE_COUNT * 3)
    const particleAngles = new Float32Array(PARTICLE_COUNT)
    const particleRadii = new Float32Array(PARTICLE_COUNT)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const radius = Math.sqrt(rand()) * 1.78 + 0.12
      const angle = rand() * Math.PI * 2
      particleAngles[i] = angle
      particleRadii[i] = radius
      particlePositions[i * 3] = Math.cos(angle) * radius
      particlePositions[i * 3 + 1] = Math.sin(angle) * radius
      particlePositions[i * 3 + 2] = (rand() - 0.5) * 0.05
      particleColors[i * 3] = DIM.r
      particleColors[i * 3 + 1] = DIM.g
      particleColors[i * 3 + 2] = DIM.b
    }
    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    const colorAttr = new THREE.BufferAttribute(particleColors, 3)
    colorAttr.setUsage(THREE.DynamicDrawUsage)
    particleGeometry.setAttribute('color', colorAttr)
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.042,
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    })

    return {
      ringGeometries,
      ringMaterial,
      tickGeometry,
      tickMaterial,
      wedgeGeometry,
      wedgeMaterial,
      armGeometry,
      armMaterial,
      particleGeometry,
      particleMaterial,
      particleAngles,
      particleRadii,
      colorAttr,
    }
  }, [])

  useEffect(() => {
    const a = assets
    return () => {
      for (const g of a.ringGeometries) g.dispose()
      a.ringMaterial.dispose()
      a.tickGeometry.dispose()
      a.tickMaterial.dispose()
      a.wedgeGeometry.dispose()
      a.wedgeMaterial.dispose()
      a.armGeometry.dispose()
      a.armMaterial.dispose()
      a.particleGeometry.dispose()
      a.particleMaterial.dispose()
    }
  }, [assets])

  useFrame(({ clock }) => {
    const root = rootRef.current
    if (!root) return
    const { p, active } = stageWindow(index, processState.progress)
    const visible = active > 0.001
    root.visible = visible
    if (!visible) return

    const time = clock.elapsedTime
    const aEase = easeOutCubic(active)
    root.scale.setScalar(0.72 + 0.28 * aEase)

    // Idle drift keeps the platter alive between scroll ticks.
    if (platterRef.current) platterRef.current.rotation.z = -time * 0.03

    // Sweep: 2.5 revolutions scrubbed across the stage + a whisper of drift.
    const sweep = p * SWEEP_TURNS * Math.PI * 2 + time * 0.12
    if (armRef.current) armRef.current.rotation.z = sweep

    // Ring entrance staggers outward-in; slight overshoot sells the arrival.
    for (let i = 0; i < RING_RADII.length; i++) {
      const ring = ringRefs.current[i]
      if (!ring) continue
      const s = easeOutBack(clamp01(aEase * 1.7 - i * 0.14))
      ring.scale.setScalar(Math.max(s, 0.0001))
    }

    // Radar paint: brightness spikes at the beam and decays behind it. The
    // platter itself counter-rotates, so work in platter-local beam angle.
    const beamLocal = sweep + time * 0.03
    const colors = assets.colorAttr.array as Float32Array
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      let delta = (beamLocal - assets.particleAngles[i]) % (Math.PI * 2)
      if (delta < 0) delta += Math.PI * 2
      const glow = Math.exp(-delta * 2.1)
      COL.copy(DIM).lerp(TEAL, Math.min(1, glow * 1.35))
      if (glow > 0.72) COL.lerp(WHITE, (glow - 0.72) * 2.4)
      colors[i * 3] = COL.r
      colors[i * 3 + 1] = COL.g
      colors[i * 3 + 2] = COL.b
    }
    assets.colorAttr.needsUpdate = true

    // Master fades — the whole stage dissolves through `active`.
    assets.ringMaterial.opacity = 0.55 * aEase
    assets.tickMaterial.opacity = 0.34 * aEase
    assets.wedgeMaterial.opacity = aEase
    assets.armMaterial.opacity = 0.95 * aEase
    assets.particleMaterial.opacity = aEase
  })

  return (
    <group ref={rootRef} visible={false}>
      {/* Slight tilt toward the camera so the platter reads as an object. */}
      <group rotation={[-0.34, 0, 0]}>
        <group ref={platterRef}>
          {RING_RADII.map((radius, i) => (
            <lineLoop
              key={radius}
              ref={(el) => {
                ringRefs.current[i] = el
              }}
              geometry={assets.ringGeometries[i]}
              material={assets.ringMaterial}
            />
          ))}
          <lineSegments geometry={assets.tickGeometry} material={assets.tickMaterial} />
          <points ref={pointsRef} geometry={assets.particleGeometry} material={assets.particleMaterial} />
        </group>
        <group ref={armRef}>
          <mesh geometry={assets.wedgeGeometry} material={assets.wedgeMaterial} />
          <mesh geometry={assets.armGeometry} material={assets.armMaterial} />
        </group>
      </group>
    </group>
  )
}
