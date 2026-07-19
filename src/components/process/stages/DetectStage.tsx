import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { processState, stageWindow } from '../processState'
import { mulberry32 } from '../../../lib/random'
import { clamp01, smoothstep } from '../../../lib/stages'

/**
 * Dial stage 3 — DETECT. A loose constellation of files; as the stage scrubs,
 * duplicate pairs ignite amber, an arc draws between the copies, and the pair
 * locks rose — six pairs and one triple, echoing the app's staged SHA-256
 * duplicate finder. Bright pulses ride completed links; everything not a
 * duplicate dims so the hits carry the frame.
 */

const CUBE_COUNT = 90
const CUBE_SIZE = 0.12
const CURVE_POINTS = 48
/** Pair events 0..5, triple event 6. */
const EVENT_COUNT = 7
const EVENT_SPAN = 0.115
const FIRST_EVENT = 0.06

const DIM = new THREE.Color('#232f4c')
const DIMMER = new THREE.Color('#161f36')
const AMBER = new THREE.Color('#fbbf24')
const ROSE = new THREE.Color('#f43f5e')

const COL = new THREE.Color()
const DUMMY = new THREE.Object3D()
const PT = new THREE.Vector3()

type Edge = {
  event: number
  a: number
  b: number
  curve: THREE.QuadraticBezierCurve3
  geometry: THREE.BufferGeometry
  material: THREE.LineBasicMaterial
  line: THREE.Line
  pulsePhase: number
}

export default function DetectStage({ index }: { index: number }) {
  const rootRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const pulsesRef = useRef<THREE.Points>(null)

  const assets = useMemo(() => {
    const rand = mulberry32(20260721)

    // Scattered ellipse of files, slightly deeper than wide.
    const positions: THREE.Vector3[] = []
    for (let i = 0; i < CUBE_COUNT; i++) {
      const a = rand() * Math.PI * 2
      const r = Math.sqrt(rand())
      positions.push(
        new THREE.Vector3(
          Math.cos(a) * r * 1.9,
          Math.sin(a) * r * 1.25,
          (rand() - 0.5) * 0.7,
        ),
      )
    }

    // Choose 15 distinct members: 6 pairs + 1 triple.
    const shuffled = Array.from({ length: CUBE_COUNT }, (_, i) => i)
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const members = shuffled.slice(0, 15)
    const memberEvent = new Map<number, number>()
    const edges: Edge[] = []

    const makeEdge = (event: number, a: number, b: number, phase: number): Edge => {
      const pa = positions[a]
      const pb = positions[b]
      const mid = pa
        .clone()
        .add(pb)
        .multiplyScalar(0.5)
      // Arcs lift toward the camera so links read over the field.
      mid.z += 0.55 + rand() * 0.5
      const curve = new THREE.QuadraticBezierCurve3(pa.clone(), mid, pb.clone())
      const pts = curve.getPoints(CURVE_POINTS - 1)
      const arr = new Float32Array(CURVE_POINTS * 3)
      pts.forEach((v, k) => {
        arr[k * 3] = v.x
        arr[k * 3 + 1] = v.y
        arr[k * 3 + 2] = v.z
      })
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3))
      geometry.setDrawRange(0, 0)
      const material = new THREE.LineBasicMaterial({
        color: AMBER,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
      // Built once here, referenced via <primitive> — constructing in JSX
      // would allocate a new Line every render (StrictMode renders twice).
      const line = new THREE.Line(geometry, material)
      return { event, a, b, curve, geometry, material, line, pulsePhase: phase }
    }

    for (let e = 0; e < 6; e++) {
      const a = members[e * 2]
      const b = members[e * 2 + 1]
      memberEvent.set(a, e)
      memberEvent.set(b, e)
      edges.push(makeEdge(e, a, b, rand()))
    }
    const [t0, t1, t2] = [members[12], members[13], members[14]]
    for (const m of [t0, t1, t2]) memberEvent.set(m, 6)
    edges.push(makeEdge(6, t0, t1, rand()))
    edges.push(makeEdge(6, t1, t2, rand()))
    edges.push(makeEdge(6, t2, t0, rand()))

    const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE)
    const material = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: true,
    })

    // One Points draw call carries every link pulse.
    const pulseArr = new Float32Array(edges.length * 3).fill(999)
    const pulseGeometry = new THREE.BufferGeometry()
    const pulseAttr = new THREE.BufferAttribute(pulseArr, 3)
    pulseAttr.setUsage(THREE.DynamicDrawUsage)
    pulseGeometry.setAttribute('position', pulseAttr)
    const pulseMaterial = new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.07,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      sizeAttenuation: true,
    })

    return {
      positions,
      memberEvent,
      edges,
      geometry,
      material,
      pulseGeometry,
      pulseAttr,
      pulseMaterial,
      spinPhases: Array.from({ length: CUBE_COUNT }, () => rand() * Math.PI * 2),
    }
  }, [])

  useEffect(() => {
    const a = assets
    return () => {
      a.geometry.dispose()
      a.material.dispose()
      a.pulseGeometry.dispose()
      a.pulseMaterial.dispose()
      for (const e of a.edges) {
        e.geometry.dispose()
        e.material.dispose()
      }
    }
  }, [assets])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    assets.positions.forEach((v, i) => {
      DUMMY.position.copy(v)
      DUMMY.rotation.set(0, 0, 0)
      DUMMY.scale.set(1, 1, 1)
      DUMMY.updateMatrix()
      mesh.setMatrixAt(i, DUMMY.matrix)
      mesh.setColorAt(i, DIM)
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) {
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
      mesh.instanceColor.needsUpdate = true
    }
  }, [assets])

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
    root.rotation.y = Math.sin(time * 0.22) * 0.07
    assets.material.opacity = aEase

    // How far detection has progressed overall — drives the global dim.
    const detectT = clamp01((p - FIRST_EVENT) / (EVENT_COUNT * EVENT_SPAN))
    // Finale: everything found pulses once in sync.
    const finale = smoothstep(0.9, 0.97, p) * (0.5 + 0.5 * Math.sin(time * 3))

    for (let i = 0; i < CUBE_COUNT; i++) {
      const event = assets.memberEvent.get(i)
      if (event === undefined) {
        // Bystanders sink back as the hunt narrows.
        COL.copy(DIM).lerp(DIMMER, detectT * 0.75)
      } else {
        const start = FIRST_EVENT + event * EVENT_SPAN
        const ignite = smoothstep(start, start + 0.035, p)
        const lock = smoothstep(start + 0.07, start + 0.105, p)
        COL.copy(DIM).lerp(AMBER, ignite)
        COL.lerp(ROSE, lock)
        // Locked duplicates shimmer; the finale synchronizes them.
        const shimmer = lock * (0.1 * Math.sin(time * 2.2 + i) + finale * 0.35)
        if (shimmer > 0) COL.lerp(WHITE_SCRATCH.setRGB(1, 1, 1), clamp01(shimmer))
      }
      mesh.setColorAt(i, COL)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    // Links draw across their event window; pulses ride completed links.
    const pulses = assets.pulseAttr.array as Float32Array
    for (let k = 0; k < assets.edges.length; k++) {
      const edge = assets.edges[k]
      const start = FIRST_EVENT + edge.event * EVENT_SPAN + 0.03
      const draw = smoothstep(start, start + 0.07, p)
      edge.geometry.setDrawRange(0, Math.floor(CURVE_POINTS * draw))
      COL.copy(AMBER).lerp(ROSE, smoothstep(start + 0.05, start + 0.1, p))
      edge.material.color.copy(COL)
      edge.material.opacity = (0.5 + 0.3 * finale) * draw * aEase

      if (draw >= 1) {
        edge.curve.getPointAt((time * 0.35 + edge.pulsePhase) % 1, PT)
        pulses[k * 3] = PT.x
        pulses[k * 3 + 1] = PT.y
        pulses[k * 3 + 2] = PT.z
      } else {
        pulses[k * 3 + 2] = 999
      }
    }
    assets.pulseAttr.needsUpdate = true
    assets.pulseMaterial.opacity = 0.9 * aEase
  })

  return (
    <group ref={rootRef} visible={false}>
      <instancedMesh
        ref={meshRef}
        args={[assets.geometry, assets.material, CUBE_COUNT]}
        frustumCulled={false}
      />
      {assets.edges.map((edge, k) => (
        <primitive key={k} object={edge.line} />
      ))}
      <points ref={pulsesRef} geometry={assets.pulseGeometry} material={assets.pulseMaterial} />
    </group>
  )
}

const WHITE_SCRATCH = new THREE.Color()
