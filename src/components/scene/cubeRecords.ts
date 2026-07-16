import * as THREE from 'three'
import { buildDemoData, assignTiers } from '../../lib/demoData'
import { squarify } from '../../lib/squarify'
import { mulberry32 } from '../../lib/random'

export const BRAND = {
  teal: new THREE.Color('#2dd4bf'),
  amber: new THREE.Color('#fbbf24'),
  rose: new THREE.Color('#f43f5e'),
} as const

/**
 * Per-cube state for the chaos → scan-tracks → treemap morph (§6.2). All of
 * it is precomputed once per cube count; the frame loop only interpolates.
 */
export type CubeRecord = {
  id: string
  chaosPos: THREE.Vector3
  chaosQuat: THREE.Quaternion
  chaosScale: number
  chaosColor: THREE.Color
  trackPos: THREE.Vector3
  treemapPos: THREE.Vector3
  treemapSize: THREE.Vector3
  tierColor: THREE.Color
  tumbleAxis: THREE.Vector3
  tumbleSpeed: number
  bobPhase: number
  bobAmp: number
  flashSeed: number
}

const TRACK_PITCH = 1.7
const PLATTER_YS = [-1.3, 0, 1.3]
const SEAM = 0.05 // hairline gap so tiles read like the app's stroked rects

export function buildCubeRecords(count: number, layout: { w: number; h: number }): CubeRecord[] {
  const items = buildDemoData(count)
  const tiers = assignTiers(items)
  const rects = squarify(items, 0, 0, layout.w, layout.h)
  const maxValue = Math.max(...items.map((i) => i.value))

  const rng = mulberry32(0x51ab17)
  const trackOccupancy = new Map<string, number>()
  const euler = new THREE.Euler()

  return rects.map((rect) => {
    // Chaos: uniform random point inside an ellipsoid cloud.
    const theta = rng() * Math.PI * 2
    const phi = Math.acos(2 * rng() - 1)
    const r = Math.cbrt(rng())
    const chaosPos = new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta) * 7.4,
      r * Math.cos(phi) * 4.2 + 0.9,
      r * Math.sin(phi) * Math.sin(theta) * 7.4,
    )

    // Scan: snap onto a coarse sector/track grid; same-cell cubes stack up
    // like files filling a platter column.
    const gx = Math.round(chaosPos.x / TRACK_PITCH)
    const gz = Math.round(chaosPos.z / TRACK_PITCH)
    const layer = PLATTER_YS.reduce((a, b) =>
      Math.abs(b - chaosPos.y) < Math.abs(a - chaosPos.y) ? b : a,
    )
    const cellKey = `${gx}|${layer}|${gz}`
    const stacked = trackOccupancy.get(cellKey) ?? 0
    trackOccupancy.set(cellKey, stacked + 1)
    const trackPos = new THREE.Vector3(gx * TRACK_PITCH, layer + stacked * 1.05, gz * TRACK_PITCH)

    // Treemap: the rect mapped into world space, flat on the XZ plane, with a
    // subtle height-by-size so the grid reads as a shallow 3D bar chart.
    const value = rect.value
    const slabH = 0.16 + Math.sqrt(value / maxValue) * 0.42
    const treemapPos = new THREE.Vector3(
      rect.x + rect.w / 2 - layout.w / 2,
      slabH / 2,
      rect.y + rect.h / 2 - layout.h / 2,
    )
    const treemapSize = new THREE.Vector3(
      Math.max(rect.w - SEAM, rect.w * 0.6),
      slabH,
      Math.max(rect.h - SEAM, rect.h * 0.6),
    )

    euler.set(rng() * Math.PI * 2, rng() * Math.PI * 2, rng() * Math.PI * 2)
    const tier = tiers.get(rect.id) ?? 'teal'
    const chaosBase = [BRAND.teal, BRAND.amber, BRAND.rose][Math.floor(rng() * 3)]

    return {
      id: rect.id,
      chaosPos,
      chaosQuat: new THREE.Quaternion().setFromEuler(euler),
      chaosScale: 0.4 + rng() * 1.0,
      chaosColor: chaosBase.clone().offsetHSL((rng() - 0.5) * 0.04, 0, (rng() - 0.5) * 0.14),
      trackPos,
      treemapPos,
      treemapSize,
      tierColor: BRAND[tier].clone(),
      tumbleAxis: new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(),
      tumbleSpeed: 0.25 + rng() * 0.6,
      bobPhase: rng() * Math.PI * 2,
      bobAmp: 0.14 + rng() * 0.3,
      flashSeed: rng(),
    }
  })
}
