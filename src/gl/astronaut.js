import { CapsuleGeometry, CylinderGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, SphereGeometry, TorusGeometry } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

// A jointed astronaut built from primitives, so every limb can be posed and animated.
// Facing +z. Joints: spine, neck, shoulders, elbows, hips, knees.

const JOINTS = ['spine', 'neck', 'shL', 'shR', 'elL', 'elR', 'hipL', 'hipR', 'knL', 'knR']

// Joint angles per pose: [x, y, z] Euler. Arms hang down at rest; +z lifts the left arm sideways.
export const POSES = {
  idle: {
    spine: [0.04, 0, 0], neck: [0, 0, 0],
    shL: [-0.15, 0, 0.55], shR: [0.1, 0, -0.62], elL: [-0.55, 0, 0], elR: [-0.4, 0, 0],
    hipL: [-0.2, 0, 0.1], hipR: [0.08, 0, -0.12], knL: [0.45, 0, 0], knR: [0.25, 0, 0],
    lift: 0,
  },
  crouch: {
    spine: [0.42, 0, 0], neck: [-0.35, 0, 0],
    shL: [0.7, 0, 0.3], shR: [0.7, 0, -0.3], elL: [-0.35, 0, 0], elR: [-0.35, 0, 0],
    hipL: [-1.35, 0, 0.12], hipR: [-1.35, 0, -0.12], knL: [2.0, 0, 0], knR: [2.0, 0, 0],
    lift: -0.42,
  },
  stretch: {
    spine: [-0.22, 0, 0], neck: [0.15, 0, 0],
    shL: [-2.85, 0, 0.28], shR: [-2.85, 0, -0.28], elL: [-0.08, 0, 0], elR: [-0.08, 0, 0],
    hipL: [0.12, 0, 0.06], hipR: [0.2, 0, -0.06], knL: [0.12, 0, 0], knR: [0.2, 0, 0],
    lift: 0.1,
  },
  tuck: {
    spine: [0.55, 0, 0], neck: [0.2, 0, 0],
    shL: [-0.95, 0, 0.25], shR: [-0.95, 0, -0.25], elL: [-1.7, 0, 0], elR: [-1.7, 0, 0],
    hipL: [-1.9, 0, 0.1], hipR: [-1.9, 0, -0.1], knL: [2.3, 0, 0], knR: [2.3, 0, 0],
    lift: 0,
  },
  freefall: {
    spine: [-0.12, 0, 0], neck: [-0.1, 0, 0],
    shL: [-0.25, 0, 1.4], shR: [-0.25, 0, -1.4], elL: [-0.75, 0, 0], elR: [-0.75, 0, 0],
    hipL: [0.05, 0, 0.38], hipR: [0.05, 0, -0.38], knL: [0.7, 0, 0], knR: [0.7, 0, 0],
    lift: 0,
  },
  wave: {
    spine: [-0.05, 0, 0], neck: [0.05, 0, 0],
    shL: [-0.2, 0, 0.8], shR: [-0.3, 0, -2.55], elL: [-0.6, 0, 0], elR: [-0.55, 0, 0],
    hipL: [-0.1, 0, 0.15], hipR: [0.05, 0, -0.15], knL: [0.4, 0, 0], knR: [0.2, 0, 0],
    lift: 0,
  },
}

export function createAstronaut({ env }) {
  const suit = new MeshStandardMaterial({ color: 0xeef0f2, roughness: 0.62, metalness: 0.02, envMap: env, envMapIntensity: 0.9 })
  const soft = new MeshStandardMaterial({ color: 0xd9dde1, roughness: 0.78, metalness: 0.0, envMap: env, envMapIntensity: 0.7 })
  const dark = new MeshStandardMaterial({ color: 0x2a2f35, roughness: 0.5, metalness: 0.35, envMap: env, envMapIntensity: 1 })
  const metal = new MeshStandardMaterial({ color: 0xb9bfc5, roughness: 0.28, metalness: 0.9, envMap: env, envMapIntensity: 1.2 })
  const bronze = new MeshStandardMaterial({ color: 0xc46a34, roughness: 0.4, metalness: 0.5, envMap: env, envMapIntensity: 1 })
  const straw = new MeshStandardMaterial({ color: 0xe2b04f, roughness: 0.4, metalness: 0.3, emissive: 0xe2b04f, emissiveIntensity: 0.35, envMap: env })
  const screen = new MeshStandardMaterial({ color: 0x0b1a33, emissive: 0x2f63c2, emissiveIntensity: 1.6, roughness: 0.3 })
  const visor = new MeshPhysicalMaterial({
    color: 0x0a0c10, metalness: 1, roughness: 0.06, envMap: env, envMapIntensity: 1.6,
    clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [180, 620],
  })

  const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new Mesh(geo, mat)
    m.position.set(x, y, z)
    return m
  }
  const capsule = (r, len, mat, y) => mesh(new CapsuleGeometry(r, len, 8, 20), mat, 0, y, 0)
  const ring = (r, tube, mat, y, sx = 1, sz = 1) => {
    const m = mesh(new TorusGeometry(r, tube, 10, 32), mat, 0, y, 0)
    m.rotation.x = Math.PI / 2
    m.scale.set(sx, 1, sz)
    return m
  }

  const root = new Group() // world placement
  const body = new Group() // pose lift + flips happen here
  root.add(body)
  const J = {}

  // Pelvis + belt
  const pelvis = mesh(new SphereGeometry(0.33, 24, 16), suit, 0, 0.06, 0)
  pelvis.scale.set(1.12, 0.72, 0.9)
  body.add(pelvis, ring(0.34, 0.045, dark, 0.16, 1.05, 0.86))

  // Spine → torso
  J.spine = new Group(); J.spine.position.y = 0.14; body.add(J.spine)
  const torso = capsule(0.37, 0.42, suit, 0.36)
  torso.scale.set(1.1, 1, 0.84)
  J.spine.add(torso)
  // chest control unit
  const chest = mesh(new RoundedBoxGeometry(0.44, 0.26, 0.1, 3, 0.03), soft, 0, 0.42, 0.3)
  chest.rotation.x = -0.12
  J.spine.add(chest)
  const scr = mesh(new RoundedBoxGeometry(0.16, 0.1, 0.02, 2, 0.01), screen, -0.09, 0.44, 0.355)
  scr.rotation.x = -0.12
  J.spine.add(scr)
  ;[[0.07, straw], [0.14, bronze]].forEach(([x, m]) => {
    const b = mesh(new CylinderGeometry(0.026, 0.026, 0.03, 16), m, x, 0.44, 0.355)
    b.rotation.x = Math.PI / 2 - 0.12
    J.spine.add(b)
  })
  // hoses from chest to backpack
  ;[-1, 1].forEach((s) => {
    const h = mesh(new TorusGeometry(0.2, 0.032, 8, 20, Math.PI), dark, s * 0.28, 0.5, 0.06)
    h.rotation.set(0, Math.PI / 2, 0.35 * s)
    J.spine.add(h)
  })
  // backpack (life support)
  const pack = mesh(new RoundedBoxGeometry(0.66, 0.78, 0.32, 4, 0.08), soft, 0, 0.42, -0.4)
  J.spine.add(pack)
  const packLid = mesh(new RoundedBoxGeometry(0.5, 0.16, 0.06, 2, 0.02), metal, 0, 0.66, -0.57)
  J.spine.add(packLid)
  const antenna = mesh(new CylinderGeometry(0.012, 0.012, 0.36, 8), metal, 0.22, 0.95, -0.46)
  J.spine.add(antenna, mesh(new SphereGeometry(0.03, 12, 8), straw, 0.22, 1.13, -0.46))
  // collar
  J.spine.add(ring(0.25, 0.06, metal, 0.78, 1, 0.95))

  // Neck → helmet
  J.neck = new Group(); J.neck.position.y = 0.8; J.spine.add(J.neck)
  const helmet = mesh(new SphereGeometry(0.4, 40, 28), suit, 0, 0.3, 0)
  J.neck.add(helmet)
  const visorMesh = mesh(new SphereGeometry(0.405, 48, 32, Math.PI / 2 - 1.0, 2.0, 0.72, 1.18), visor, 0, 0.3, 0.005)
  J.neck.add(visorMesh)
  // visor frame
  const frame = mesh(new TorusGeometry(0.33, 0.03, 10, 40), metal, 0, 0.28, 0.2)
  frame.scale.set(1.05, 0.82, 1)
  J.neck.add(frame)
  ;[-1, 1].forEach((s) => {
    const ear = mesh(new CylinderGeometry(0.1, 0.1, 0.06, 24), soft, s * 0.39, 0.3, 0)
    ear.rotation.z = Math.PI / 2
    J.neck.add(ear)
  })
  const lamp = mesh(new RoundedBoxGeometry(0.08, 0.06, 0.06, 2, 0.015), straw, 0.25, 0.58, 0.18)
  J.neck.add(lamp)

  // Arms
  ;[['L', 1], ['R', -1]].forEach(([k, s]) => {
    const sh = new Group(); sh.position.set(s * 0.47, 0.64, 0); J.spine.add(sh); J['sh' + k] = sh
    sh.add(mesh(new SphereGeometry(0.17, 20, 14), suit))
    sh.add(capsule(0.13, 0.26, suit, -0.24))
    sh.add(ring(0.14, 0.035, bronze, -0.12))
    const el = new Group(); el.position.y = -0.46; sh.add(el); J['el' + k] = el
    el.add(mesh(new SphereGeometry(0.125, 16, 12), soft))
    el.add(capsule(0.12, 0.22, suit, -0.2))
    el.add(ring(0.13, 0.04, dark, -0.38))
    const hand = mesh(new SphereGeometry(0.12, 18, 14), dark, 0, -0.5, 0.01)
    hand.scale.set(0.95, 1.15, 0.8)
    const thumb = mesh(new CapsuleGeometry(0.04, 0.06, 4, 8), dark, s * -0.09, -0.46, 0.06)
    thumb.rotation.z = s * 0.6
    el.add(hand, thumb)
  })

  // Legs
  ;[['L', 1], ['R', -1]].forEach(([k, s]) => {
    const hip = new Group(); hip.position.set(s * 0.19, 0.0, 0); body.add(hip); J['hip' + k] = hip
    hip.add(capsule(0.17, 0.3, suit, -0.26))
    const kn = new Group(); kn.position.y = -0.52; hip.add(kn); J['kn' + k] = kn
    kn.add(mesh(new SphereGeometry(0.155, 16, 12), soft))
    const pad = mesh(new SphereGeometry(0.1, 14, 10), soft, 0, 0.02, 0.1)
    pad.scale.set(1, 1, 0.5)
    kn.add(pad)
    kn.add(capsule(0.15, 0.28, suit, -0.22))
    kn.add(ring(0.155, 0.04, bronze, -0.36))
    const boot = mesh(new RoundedBoxGeometry(0.27, 0.2, 0.4, 3, 0.07), dark, 0, -0.5, 0.05)
    const sole = mesh(new RoundedBoxGeometry(0.28, 0.05, 0.42, 2, 0.02), metal, 0, -0.6, 0.05)
    kn.add(boot, sole)
  })

  root.traverse((o) => { if (o.isMesh) o.castShadow = false })

  const pose = {}
  JOINTS.forEach((j) => (pose[j] = [0, 0, 0]))
  pose.lift = 0

  // Blend any number of poses: apply([[POSES.idle, 0.7], [POSES.crouch, 0.3]])
  function apply(mix, extra = null) {
    JOINTS.forEach((j) => { pose[j][0] = pose[j][1] = pose[j][2] = 0 })
    pose.lift = 0
    let total = 0
    for (const [p, w] of mix) total += w
    for (const [p, w] of mix) {
      const k = w / (total || 1)
      JOINTS.forEach((j) => { pose[j][0] += p[j][0] * k; pose[j][1] += p[j][1] * k; pose[j][2] += p[j][2] * k })
      pose.lift += p.lift * k
    }
    if (extra) extra(pose)
    JOINTS.forEach((j) => J[j].rotation.set(pose[j][0], pose[j][1], pose[j][2]))
    body.position.y = pose.lift
  }

  return { root, body, joints: J, apply, visor }
}
