import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollState } from '../../lib/scrollState'
import { chaosToScan, scanToTreemap, smoothstep, lerp, clamp01, sweepState } from '../../lib/stages'
import { buildCubeRecords } from './cubeRecords'
import type { SceneProfile } from '../../hooks/useSceneProfile'

/**
 * The instanced cube system (§6). Two InstancedMeshes — a wireframe and a
 * solid — share the exact same per-instance transforms every frame and are
 * cross-faded by material opacity: sketchy wireframe chaos at the top of the
 * page, clean solid treemap slabs at the bottom.
 *
 * All scratch objects live outside the frame loop; the loop allocates nothing.
 */
const M4 = new THREE.Matrix4()
const POS = new THREE.Vector3()
const SCL = new THREE.Vector3()
const QUAT = new THREE.Quaternion()
const TUMBLE = new THREE.Quaternion()
const COL = new THREE.Color()
const WIRE_COL = new THREE.Color()
const IDENTITY = new THREE.Quaternion()
const FLASH = new THREE.Color('#dcfefa')
const WHITE = new THREE.Color('#ffffff')

type CubeFieldProps = {
  profile: SceneProfile
  reduced: boolean
}

export default function CubeField({ profile, reduced }: CubeFieldProps) {
  const { cubeCount, layout } = profile
  const invalidate = useThree((s) => s.invalidate)

  const records = useMemo(() => buildCubeRecords(cubeCount, layout), [cubeCount, layout])

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  // Unlit solid slabs with per-face shading baked into vertex colors: tops
  // land on the exact brand hex values (§1 requires them verbatim) while the
  // sides read as depth — no lights, no tone shift, one less thing per frame.
  const solidGeometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const faceLum = [0.78, 0.78, 1.0, 0.5, 0.68, 0.68] // +x, -x, top, bottom, +z, -z
    const count = geo.attributes.position.count
    const colors = new Float32Array(count * 3)
    for (let face = 0; face < 6; face++) {
      for (let v = 0; v < 4; v++) {
        const i = (face * 4 + v) * 3
        colors[i] = colors[i + 1] = colors[i + 2] = faceLum[face]
      }
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geo
  }, [])

  const wireMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        wireframe: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      }),
    [],
  )
  const solidMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        vertexColors: true,
      }),
    [],
  )

  const wireRef = useRef<THREE.InstancedMesh>(null)
  const solidRef = useRef<THREE.InstancedMesh>(null)

  // Prime instance buffers (color buffers are created by the first
  // setColorAt) and mark them dynamic — they change every frame.
  useEffect(() => {
    for (const mesh of [wireRef.current, solidRef.current]) {
      if (!mesh) continue
      records.forEach((rec, i) => mesh.setColorAt(i, rec.chaosColor))
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      if (mesh.instanceColor) {
        mesh.instanceColor.setUsage(THREE.DynamicDrawUsage)
        mesh.instanceColor.needsUpdate = true
      }
    }
    invalidate()
  }, [records, invalidate])

  useFrame((state) => {
    const wire = wireRef.current
    const solid = solidRef.current
    if (!wire || !solid) return

    const t = reduced ? 1 : scrollState.progress
    const time = state.clock.elapsedTime
    const align = chaosToScan(t)
    const settle = scanToTreemap(t)
    const chaosAmp = 1 - align
    const breath = smoothstep(0.97, 1, t)
    const sweep = sweepState(t, layout.w / 2 + 1)

    // The whole cloud slowly "unwinds" into alignment as the scan begins.
    const yaw = (time * 0.045 + Math.sin(time * 0.3) * 0.1) * chaosAmp
    const cosY = Math.cos(yaw)
    const sinY = Math.sin(yaw)

    const trackUniform = 0.82

    for (let i = 0; i < records.length; i++) {
      const rec = records[i]

      // --- position: chaos (drifting) → track grid → treemap rect ---------
      const bob = Math.sin(time * rec.tumbleSpeed * 1.7 + rec.bobPhase) * rec.bobAmp * chaosAmp
      POS.set(
        rec.chaosPos.x * cosY - rec.chaosPos.z * sinY,
        rec.chaosPos.y + bob,
        rec.chaosPos.x * sinY + rec.chaosPos.z * cosY,
      )
      POS.lerp(rec.trackPos, align)
      POS.lerp(rec.treemapPos, settle)

      // --- scale: random cube → uniform sector cell → sized slab -----------
      const uni = lerp(rec.chaosScale, trackUniform, align)
      const breathe = 1 + Math.sin(time * 0.9 + rec.bobPhase) * 0.03 * breath
      SCL.set(
        lerp(uni, rec.treemapSize.x, settle),
        lerp(uni, rec.treemapSize.y * breathe, settle),
        lerp(uni, rec.treemapSize.z, settle),
      )

      // --- rotation: tumbling → mostly aligned on tracks → perfectly axis-aligned
      TUMBLE.setFromAxisAngle(rec.tumbleAxis, time * rec.tumbleSpeed * chaosAmp)
      QUAT.multiplyQuaternions(TUMBLE, rec.chaosQuat)
      QUAT.slerp(IDENTITY, clamp01(align * 0.78 + settle))

      M4.compose(POS, QUAT, SCL)
      wire.setMatrixAt(i, M4)
      solid.setMatrixAt(i, M4)

      // --- color: chaos tint → tier color, with the scan-line flash --------
      COL.copy(rec.chaosColor).lerp(rec.tierColor, settle)
      const dx = POS.x - sweep.x + (rec.flashSeed - 0.5) * 0.9
      const flash = sweep.gate * Math.exp(-dx * dx * 0.85) * (1 - settle * 0.9)
      if (flash > 0.004) COL.lerp(FLASH, Math.min(1, flash))
      solid.setColorAt(i, COL)
      WIRE_COL.copy(COL).lerp(WHITE, 0.16 + Math.min(0.5, flash))
      wire.setColorAt(i, WIRE_COL)
    }

    wire.instanceMatrix.needsUpdate = true
    solid.instanceMatrix.needsUpdate = true
    if (wire.instanceColor) wire.instanceColor.needsUpdate = true
    if (solid.instanceColor) solid.instanceColor.needsUpdate = true

    // Cross-fade the two meshes (§6.1) and skip draw calls for invisible ones.
    wireMat.opacity = (0.95 - 0.3 * align) * (1 - settle)
    solidMat.opacity = clamp01(align * 0.25 + settle)
    wire.visible = wireMat.opacity > 0.01
    solid.visible = solidMat.opacity > 0.01
  })

  return (
    <group>
      <instancedMesh
        key={`wire-${records.length}`}
        ref={wireRef}
        args={[geometry, wireMat, records.length]}
        frustumCulled={false}
      />
      <instancedMesh
        key={`solid-${records.length}`}
        ref={solidRef}
        args={[solidGeometry, solidMat, records.length]}
        frustumCulled={false}
      />
    </group>
  )
}
