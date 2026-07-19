import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { processState, stageWindow } from '../processState'
import { squarify } from '../../../lib/squarify'
import { mulberry32 } from '../../../lib/random'
import { clamp01, lerp, smoothstep } from '../../../lib/stages'

/**
 * Dial stage 4 — RECLAIM. The payoff: a settled treemap where the biggest
 * tile burns rose. It fragments into a plume of particles that stream away
 * and dissolve, the surviving tiles glide inward to close the gap (a real
 * re-layout, not a shuffle), and a teal gauge sweeps the rim to 100%.
 * Ends calm, teal-dominant, with a drift of celebration sparks.
 */

const TILE_COUNT = 22
const RECT = { x: -1.6, y: -1.05, w: 3.2, h: 2.1 }
const DEPTH = 0.1
const PARTICLE_COUNT = 550
const SPARK_COUNT = 70
const GAUGE_SEGMENTS = 128
const GAUGE_RADIUS = 2.02

const ROSE = new THREE.Color('#f43f5e')
const AMBER = new THREE.Color('#fbbf24')
const TEAL = new THREE.Color('#2dd4bf')
const WHITE = new THREE.Color('#ffffff')

const COL = new THREE.Color()
const DUMMY = new THREE.Object3D()

function easeInOutCubic(v: number): number {
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2
}

export default function ReclaimStage({ index }: { index: number }) {
  const rootRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.InstancedMesh>(null)

  const assets = useMemo(() => {
    const rand = mulberry32(20260722)

    const items = Array.from({ length: TILE_COUNT }, (_, i) => ({
      id: String(i),
      value: Math.pow(rand(), 2.1) * 90 + 3,
    }))
    const layoutA = squarify(items, RECT.x, RECT.y, RECT.w, RECT.h)
    // The hog is the biggest tile (squarify sorts desc ⇒ index 0).
    const hog = layoutA[0]
    const survivors = layoutA.slice(1)
    const layoutB = squarify(
      survivors.map((r) => ({ id: r.id, value: r.value })),
      RECT.x,
      RECT.y,
      RECT.w,
      RECT.h,
    )
    const targetById = new Map(layoutB.map((r) => [r.id, r]))

    // Tier colors for survivors, area-weighted after the hog is gone.
    const total = survivors.reduce((s, r) => s + r.value, 0)
    let cumulative = 0
    const tiers = new Map<string, THREE.Color>()
    for (const r of survivors) {
      cumulative += r.value
      tiers.set(r.id, cumulative / total <= 0.35 ? AMBER : TEAL)
    }

    // Per-face shaded unit box (story-scene idiom: exact hexes, no lights).
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const faceBrightness = [0.8, 0.8, 1.0, 0.62, 1.0, 0.55]
    const colors = new Float32Array(geometry.attributes.position.count * 3)
    for (let v = 0; v < geometry.attributes.position.count; v++) {
      const b = faceBrightness[Math.floor(v / 4)]
      colors[v * 3] = b
      colors[v * 3 + 1] = b
      colors[v * 3 + 2] = b
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: true,
    })

    // Fragment plume seeded inside the hog's volume.
    const pStart = new Float32Array(PARTICLE_COUNT * 3)
    const pVel = new Float32Array(PARTICLE_COUNT * 3)
    const pPhase = new Float32Array(PARTICLE_COUNT)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pStart[i * 3] = hog.x + rand() * hog.w
      pStart[i * 3 + 1] = hog.y + rand() * hog.h
      pStart[i * 3 + 2] = (rand() - 0.5) * DEPTH
      pVel[i * 3] = (rand() - 0.5) * 0.5
      pVel[i * 3 + 1] = 0.7 + rand() * 0.9
      pVel[i * 3 + 2] = -(0.4 + rand() * 0.9)
      pPhase[i] = rand() * Math.PI * 2
    }
    const particleGeometry = new THREE.BufferGeometry()
    const particlePos = new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3)
    particlePos.setUsage(THREE.DynamicDrawUsage)
    particleGeometry.setAttribute('position', particlePos)
    const particleCol = new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 4), 4)
    particleCol.setUsage(THREE.DynamicDrawUsage)
    particleGeometry.setAttribute('color', particleCol)
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.045,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      sizeAttenuation: true,
    })

    // Rim gauge: a circle drawn by drawRange, plus a dim full-track ring.
    const gaugeArr = new Float32Array((GAUGE_SEGMENTS + 1) * 3)
    for (let s = 0; s <= GAUGE_SEGMENTS; s++) {
      // Start at 12 o'clock, sweep clockwise like a real progress dial.
      const a = Math.PI / 2 - (s / GAUGE_SEGMENTS) * Math.PI * 2
      gaugeArr[s * 3] = Math.cos(a) * GAUGE_RADIUS
      gaugeArr[s * 3 + 1] = Math.sin(a) * GAUGE_RADIUS
      gaugeArr[s * 3 + 2] = 0
    }
    const gaugeGeometry = new THREE.BufferGeometry()
    gaugeGeometry.setAttribute('position', new THREE.BufferAttribute(gaugeArr, 3))
    gaugeGeometry.setDrawRange(0, 0)
    const gaugeMaterial = new THREE.LineBasicMaterial({
      color: TEAL,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const trackGeometry = gaugeGeometry.clone()
    trackGeometry.setDrawRange(0, GAUGE_SEGMENTS + 1)
    const trackMaterial = new THREE.LineBasicMaterial({
      color: '#1c2740',
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const gaugeLine = new THREE.Line(gaugeGeometry, gaugeMaterial)
    const trackLine = new THREE.Line(trackGeometry, trackMaterial)

    // Celebration sparks: a slow-rising dome above the settled map.
    const sparkStart = new Float32Array(SPARK_COUNT * 3)
    const sparkPhase = new Float32Array(SPARK_COUNT)
    for (let i = 0; i < SPARK_COUNT; i++) {
      sparkStart[i * 3] = (rand() - 0.5) * 3.4
      sparkStart[i * 3 + 1] = (rand() - 0.5) * 2.2
      sparkStart[i * 3 + 2] = 0.2 + rand() * 0.5
      sparkPhase[i] = rand() * Math.PI * 2
    }
    const sparkGeometry = new THREE.BufferGeometry()
    const sparkPos = new THREE.BufferAttribute(new Float32Array(SPARK_COUNT * 3), 3)
    sparkPos.setUsage(THREE.DynamicDrawUsage)
    sparkGeometry.setAttribute('position', sparkPos)
    const sparkMaterial = new THREE.PointsMaterial({
      color: WHITE,
      size: 0.035,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    })

    return {
      layoutA,
      hog,
      targetById,
      tiers,
      geometry,
      material,
      pStart,
      pVel,
      pPhase,
      particleGeometry,
      particlePos,
      particleCol,
      particleMaterial,
      gaugeGeometry,
      gaugeMaterial,
      trackGeometry,
      trackMaterial,
      gaugeLine,
      trackLine,
      sparkStart,
      sparkPhase,
      sparkPos,
      sparkGeometry,
      sparkMaterial,
    }
  }, [])

  useEffect(() => {
    const a = assets
    return () => {
      a.geometry.dispose()
      a.material.dispose()
      a.particleGeometry.dispose()
      a.particleMaterial.dispose()
      a.gaugeGeometry.dispose()
      a.gaugeMaterial.dispose()
      a.trackGeometry.dispose()
      a.trackMaterial.dispose()
      a.sparkGeometry.dispose()
      a.sparkMaterial.dispose()
    }
  }, [assets])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh?.instanceColor) {
      // First color write happens in the frame loop; force allocation now so
      // usage can be set before the loop touches it.
      meshRef.current?.setColorAt(0, COL.copy(TEAL))
    }
    if (meshRef.current?.instanceColor) {
      meshRef.current.instanceColor.setUsage(THREE.DynamicDrawUsage)
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
    const aEase = 1 - (1 - active) * (1 - active)
    root.scale.setScalar(0.78 + 0.22 * aEase)
    assets.material.opacity = aEase

    // Phases: fragment 0.14→0.6 · re-layout 0.35→0.82 · gauge 0.42→0.96.
    const frag = smoothstep(0.14, 0.6, p)
    const glide = smoothstep(0.35, 0.82, p)
    const gauge = smoothstep(0.42, 0.96, p)

    // Tiles.
    for (let i = 0; i < TILE_COUNT; i++) {
      const rect = assets.layoutA[i]
      const isHog = i === 0
      if (isHog) {
        // The hog collapses as its particles take over its mass.
        const collapse = 1 - smoothstep(0.14, 0.3, p)
        DUMMY.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2, 0)
        DUMMY.rotation.set(0, 0, 0)
        DUMMY.scale.set(
          Math.max(rect.w * 0.95 * collapse, 0.0001),
          Math.max(rect.h * 0.95 * collapse, 0.0001),
          Math.max(DEPTH * collapse, 0.0001),
        )
        COL.copy(ROSE).lerp(WHITE, smoothstep(0.14, 0.24, p) * 0.5)
      } else {
        const target = assets.targetById.get(rect.id)!
        // Staggered glide, later tiles trailing slightly.
        const local = easeInOutCubic(clamp01(glide * 1.25 - (i / TILE_COUNT) * 0.25))
        const x = lerp(rect.x + rect.w / 2, target.x + target.w / 2, local)
        const y = lerp(rect.y + rect.h / 2, target.y + target.h / 2, local)
        const w = lerp(rect.w, target.w, local)
        const h = lerp(rect.h, target.h, local)
        DUMMY.position.set(x, y, Math.sin(time * 1.1 + i * 1.7) * 0.01)
        DUMMY.rotation.set(0, 0, 0)
        DUMMY.scale.set(w * 0.95, h * 0.95, DEPTH)
        COL.copy(assets.tiers.get(rect.id)!)
        // A soft white kiss as each survivor settles into its new home.
        const settleFlash = Math.exp(-Math.pow((local - 0.94) / 0.05, 2))
        if (local > 0.6 && local < 1) COL.lerp(WHITE, settleFlash * 0.35)
      }
      DUMMY.updateMatrix()
      mesh.setMatrixAt(i, DUMMY.matrix)
      mesh.setColorAt(i, COL)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    // Fragment plume.
    const pos = assets.particlePos.array as Float32Array
    const col = assets.particleCol.array as Float32Array
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const jitter = 0.85 + 0.3 * ((assets.pPhase[i] / (Math.PI * 2)) % 1)
      const f = clamp01(frag * 1.15 * jitter)
      const drift = f * 2.3
      pos[i * 3] =
        assets.pStart[i * 3] +
        assets.pVel[i * 3] * drift +
        Math.sin(f * Math.PI * 2 + assets.pPhase[i]) * 0.12 * f
      pos[i * 3 + 1] = assets.pStart[i * 3 + 1] + assets.pVel[i * 3 + 1] * drift
      pos[i * 3 + 2] = assets.pStart[i * 3 + 2] + assets.pVel[i * 3 + 2] * drift
      const gate = smoothstep(0.12, 0.2, p)
      const fade = Math.pow(1 - f, 1.4)
      COL.copy(ROSE).lerp(WHITE, Math.min(1, f * 1.6))
      col[i * 4] = COL.r
      col[i * 4 + 1] = COL.g
      col[i * 4 + 2] = COL.b
      col[i * 4 + 3] = gate * fade * aEase
    }
    assets.particlePos.needsUpdate = true
    assets.particleCol.needsUpdate = true

    // Gauge sweep + glimmering idle once full.
    assets.gaugeGeometry.setDrawRange(0, Math.floor((GAUGE_SEGMENTS + 1) * gauge))
    assets.gaugeMaterial.opacity = (0.7 + 0.15 * Math.sin(time * 2) * smoothstep(0.9, 1, gauge)) * aEase
    assets.trackMaterial.opacity = 0.4 * aEase * smoothstep(0.3, 0.5, p)

    // Celebration sparks: fade in near the end, drift upward forever.
    const sparkPos = assets.sparkPos.array as Float32Array
    for (let i = 0; i < SPARK_COUNT; i++) {
      const rise = (time * 0.12 + assets.sparkPhase[i]) % 1
      sparkPos[i * 3] = assets.sparkStart[i * 3] + Math.sin(time * 0.4 + assets.sparkPhase[i]) * 0.08
      sparkPos[i * 3 + 1] = assets.sparkStart[i * 3 + 1] + rise * 0.9
      sparkPos[i * 3 + 2] = assets.sparkStart[i * 3 + 2]
    }
    assets.sparkPos.needsUpdate = true
    assets.sparkMaterial.opacity = smoothstep(0.82, 0.95, p) * 0.5 * aEase

    // The whole composition leans back a breath as the plume releases.
    root.rotation.x = -0.08 * frag
  })

  return (
    <group ref={rootRef} visible={false}>
      <instancedMesh
        ref={meshRef}
        args={[assets.geometry, assets.material, TILE_COUNT]}
        frustumCulled={false}
      />
      <points geometry={assets.particleGeometry} material={assets.particleMaterial} />
      <points geometry={assets.sparkGeometry} material={assets.sparkMaterial} />
      <primitive object={assets.trackLine} />
      <primitive object={assets.gaugeLine} />
    </group>
  )
}
