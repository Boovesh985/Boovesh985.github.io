import {
  CapsuleGeometry, CatmullRomCurve3, CircleGeometry, CylinderGeometry, Group, LatheGeometry, Mesh, MeshPhysicalMaterial,
  MeshStandardMaterial, PlaneGeometry, SphereGeometry, TorusGeometry, TubeGeometry, Vector2, Vector3,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { suitTextures } from './suitTextures.js'

// A jointed astronaut built from primitives, so every limb can be posed and animated.
// Facing +z. Joints: spine, neck, shoulders, elbows, hips, knees.
// Suit materials use procedural fabric, shell and rubber textures (see suitTextures.js).

const JOINTS = ['spine', 'neck', 'shL', 'shR', 'elL', 'elR', 'hipL', 'hipR', 'knL', 'knR']
const TAU = Math.PI * 2

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
  // hello: right upper arm out to the side, forearm straight up, palm to the viewer
  wave: {
    spine: [-0.04, 0, 0.06], neck: [0.06, 0, -0.14],
    shL: [0.05, 0, 0.32], shR: [-0.12, 0, -1.3], elL: [-0.45, 0, 0], elR: [-0.1, 0, -1.78],
    hipL: [-0.1, 0, 0.15], hipR: [0.05, 0, -0.15], knL: [0.4, 0, 0], knR: [0.2, 0, 0],
    lift: 0, palm: 1,
  },
}

// A capsule whose cloth bunches into irregular folds between `from` and `to` (0 = bottom, 1 = top).
function folded(r, len, { folds = 4, amp = 0.014, from = 0, to = 1, seed = 1 } = {}) {
  const g = new CapsuleGeometry(r, len, 10, 40, 28)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    if (Math.abs(y) > len / 2) continue
    const t = (y + len / 2) / len
    const w = Math.min(1, Math.max(0, (t - from) / 0.15)) * Math.min(1, Math.max(0, (to - t) / 0.15))
    if (!w) continue
    const x = p.getX(i), z = p.getZ(i)
    const a = Math.atan2(z, x)
    const wob = Math.sin(a * 2 + t * 9 + seed) * 0.9 + Math.sin(a * 3 - seed * 2) * 0.4
    const d = amp * w * (0.55 + 0.45 * Math.sin(t * folds * TAU + wob)) * (0.75 + 0.25 * Math.sin(a * 5 + seed * 3 + t * 13))
    const k = 1 + d / r
    p.setX(i, x * k); p.setZ(i, z * k)
  }
  g.computeVertexNormals()
  return g
}

// Ribbed bellows for the elbows and knees
function bellows(r, h, ribs = 5) {
  const pts = []
  const n = 48
  for (let i = 0; i <= n; i++) {
    const t = i / n
    pts.push(new Vector2(r * (1 + 0.09 * Math.cos(t * ribs * TAU)), (t - 0.5) * h))
  }
  const g = new LatheGeometry(pts, 40)
  g.computeVertexNormals()
  return g
}

export function createAstronaut({ env }) {
  const T = suitTextures()
  const fabric = new MeshPhysicalMaterial({
    color: 0xffffff, map: T.fabric.map, normalMap: T.fabric.normalMap, normalScale: new Vector2(0.7, 0.7),
    roughness: 1, roughnessMap: T.fabric.roughnessMap, metalness: 0,
    sheen: 0.6, sheenRoughness: 0.75, sheenColor: 0xfff6ea, envMap: env, envMapIntensity: 0.75,
  })
  const fabricShade = fabric.clone()
  fabricShade.color.set(0xd9d7d1)
  const hard = new MeshPhysicalMaterial({
    color: 0xf1f0ec, roughness: 0.42, roughnessMap: T.shell.roughnessMap, normalMap: T.shell.normalMap, normalScale: new Vector2(0.5, 0.5),
    clearcoat: 0.9, clearcoatRoughness: 0.18, envMap: env, envMapIntensity: 1,
  })
  const hardPlain = new MeshPhysicalMaterial({ color: 0xf3f2ee, roughness: 0.3, roughnessMap: T.shell.roughnessMap, clearcoat: 1, clearcoatRoughness: 0.12, envMap: env, envMapIntensity: 1 })
  const metal = new MeshStandardMaterial({ color: 0xb8bec6, roughness: 0.24, metalness: 1, envMap: env, envMapIntensity: 1.3 })
  const anodized = new MeshStandardMaterial({ color: 0x2f63c2, roughness: 0.3, metalness: 0.9, envMap: env, envMapIntensity: 1.2 })
  const bronze = new MeshStandardMaterial({ color: 0xc46a34, roughness: 0.35, metalness: 0.8, envMap: env, envMapIntensity: 1.1 })
  const rubber = new MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.82, metalness: 0, normalMap: T.tread.normalMap, envMap: env, envMapIntensity: 0.5 })
  const glove = new MeshPhysicalMaterial({ color: 0xc9ccd0, roughness: 0.7, metalness: 0, sheen: 0.4, sheenColor: 0xffffff, normalMap: T.fabric.normalMap, normalScale: new Vector2(0.4, 0.4), envMap: env, envMapIntensity: 0.6 })
  const dark = new MeshStandardMaterial({ color: 0x23272c, roughness: 0.45, metalness: 0.5, envMap: env })
  const lens = new MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xfff0cc, emissiveIntensity: 2.2, roughness: 0.2 })
  const screen = new MeshStandardMaterial({ color: 0x0b1a33, emissive: 0x2f63c2, emissiveIntensity: 1.5, roughness: 0.25 })
  const led = (c) => new MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.6, roughness: 0.3 })
  // gold-coated sun visor
  const visor = new MeshPhysicalMaterial({
    color: 0xe0ad52, metalness: 1, roughness: 0.07, envMap: env, envMapIntensity: 2.3, emissive: 0x3a2508, emissiveIntensity: 0.6,
    clearcoat: 1, clearcoatRoughness: 0.03, iridescence: 0.35, iridescenceIOR: 1.5, iridescenceThicknessRange: [200, 500],
  })
  const patchMat = new MeshStandardMaterial({ map: T.patch, transparent: true, roughness: 0.75 })
  const tagMat = new MeshStandardMaterial({ map: T.tag, roughness: 0.6 })

  const mesh = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new Mesh(geo, mat)
    m.position.set(x, y, z)
    return m
  }
  const ring = (r, tube, mat, y, sx = 1, sz = 1) => {
    const m = mesh(new TorusGeometry(r, tube, 12, 40), mat, 0, y, 0)
    m.rotation.x = Math.PI / 2
    m.scale.set(sx, 1, sz)
    return m
  }
  const tube = (pts, r, mat) => new Mesh(new TubeGeometry(new CatmullRomCurve3(pts.map((p) => new Vector3(...p))), 24, r, 10), mat)

  const root = new Group() // world placement
  const body = new Group() // pose lift + flips happen here
  root.add(body)
  const J = {}

  // Pelvis: soft brief with a waist bearing
  const pelvis = mesh(folded(0.3, 0.1, { folds: 2, amp: 0.01, seed: 4 }), fabric, 0, 0.06, 0)
  pelvis.scale.set(1.15, 1, 0.95)
  body.add(pelvis, ring(0.335, 0.035, metal, 0.19, 1.05, 0.88), ring(0.34, 0.018, anodized, 0.15, 1.05, 0.88))

  // Spine → torso
  J.spine = new Group(); J.spine.position.y = 0.14; body.add(J.spine)
  const torso = mesh(folded(0.37, 0.42, { folds: 3, amp: 0.012, from: 0, to: 0.4, seed: 2 }), fabric, 0, 0.36, 0)
  torso.scale.set(1.1, 1, 0.84)
  J.spine.add(torso)
  // display & control module
  const dcm = new Group()
  dcm.position.set(0, 0.44, 0.3)
  dcm.rotation.x = -0.12
  J.spine.add(dcm)
  dcm.add(mesh(new RoundedBoxGeometry(0.46, 0.27, 0.11, 4, 0.03), hardPlain))
  dcm.add(mesh(new RoundedBoxGeometry(0.17, 0.1, 0.02, 2, 0.01), screen, -0.1, 0.03, 0.058))
  ;[[0.06, 0.05, 0xe2b04f], [0.13, 0.05, 0xc46a34], [0.06, -0.06, 0x2f63c2], [0.13, -0.06, 0xdfe6ee]].forEach(([x, y, c]) => {
    const k = mesh(new CylinderGeometry(0.026, 0.028, 0.035, 20), metal, x, y, 0.06)
    k.rotation.x = Math.PI / 2
    const cap = mesh(new CircleGeometry(0.018, 16), led(c), x, y, 0.079)
    dcm.add(k, cap)
  })
  dcm.add(mesh(new RoundedBoxGeometry(0.2, 0.035, 0.02, 2, 0.008), dark, -0.1, -0.07, 0.058))
  // name tag + hoses to the backpack
  const tag = mesh(new PlaneGeometry(0.34, 0.064), tagMat, 0, 0.215, 0.318)
  tag.rotation.x = 0.1
  J.spine.add(tag)
  ;[-1, 1].forEach((s) => {
    J.spine.add(tube([[s * 0.2, 0.36, 0.32], [s * 0.36, 0.3, 0.24], [s * 0.43, 0.42, 0.02], [s * 0.36, 0.58, -0.24]], 0.03, s > 0 ? anodized : dark))
    J.spine.add(mesh(new CylinderGeometry(0.045, 0.045, 0.05, 16), metal, s * 0.2, 0.36, 0.33).rotateX(Math.PI / 2))
  })
  // backpack (life support): hard shell with panels, vents and an antenna
  const pack = mesh(new RoundedBoxGeometry(0.68, 0.8, 0.33, 5, 0.09), hard, 0, 0.42, -0.41)
  J.spine.add(pack)
  J.spine.add(mesh(new RoundedBoxGeometry(0.52, 0.17, 0.07, 3, 0.025), metal, 0, 0.7, -0.58))
  for (let i = 0; i < 6; i++) J.spine.add(mesh(new RoundedBoxGeometry(0.34, 0.016, 0.02, 1, 0.006), dark, 0, 0.22 + i * 0.04, -0.578))
  J.spine.add(mesh(new CylinderGeometry(0.012, 0.008, 0.4, 8), metal, 0.24, 0.98, -0.47))
  J.spine.add(mesh(new SphereGeometry(0.026, 12, 8), led(0xe2b04f), 0.24, 1.18, -0.47))
  ;[-1, 1].forEach((s) => J.spine.add(mesh(new RoundedBoxGeometry(0.07, 0.62, 0.05, 2, 0.02), fabricShade, s * 0.26, 0.45, -0.23)))
  // neck bearing
  J.spine.add(ring(0.25, 0.055, metal, 0.78, 1, 0.95), ring(0.262, 0.02, anodized, 0.82, 1, 0.95))

  // Neck → helmet
  J.neck = new Group(); J.neck.position.y = 0.8; J.spine.add(J.neck)
  const helmet = mesh(new SphereGeometry(0.4, 56, 40), hardPlain, 0, 0.3, 0)
  J.neck.add(helmet)
  const visorMesh = mesh(new SphereGeometry(0.405, 64, 40, Math.PI / 2 - 1.0, 2.0, 0.72, 1.18), visor, 0, 0.3, 0.005)
  J.neck.add(visorMesh)
  const frame = mesh(new TorusGeometry(0.33, 0.028, 12, 56), hardPlain, 0, 0.28, 0.2)
  frame.scale.set(1.05, 0.82, 1)
  J.neck.add(frame)
  // headlamps and a helmet camera
  ;[-1, 1].forEach((s) => {
    const lamp = new Group()
    lamp.position.set(s * 0.31, 0.5, 0.12)
    lamp.rotation.y = s * 0.45
    lamp.add(mesh(new RoundedBoxGeometry(0.1, 0.07, 0.1, 2, 0.02), metal))
    lamp.add(mesh(new CircleGeometry(0.026, 20), lens, 0, 0, 0.051))
    J.neck.add(lamp)
    const ear = mesh(new CylinderGeometry(0.09, 0.09, 0.05, 28), metal, s * 0.395, 0.3, -0.02)
    ear.rotation.z = Math.PI / 2
    J.neck.add(ear)
  })
  const cam = mesh(new RoundedBoxGeometry(0.07, 0.06, 0.1, 2, 0.015), dark, -0.12, 0.66, 0.12)
  J.neck.add(cam, mesh(new CircleGeometry(0.018, 16), lens, -0.12, 0.66, 0.171))

  // Arms
  ;[['L', 1], ['R', -1]].forEach(([k, s]) => {
    const sh = new Group(); sh.position.set(s * 0.47, 0.64, 0); J.spine.add(sh); J['sh' + k] = sh
    sh.add(mesh(new SphereGeometry(0.175, 28, 20), fabric))
    sh.add(ring(0.16, 0.03, metal, -0.02)) // shoulder bearing
    sh.add(mesh(folded(0.13, 0.26, { folds: 3, amp: 0.012, from: 0.1, to: 0.9, seed: s * 3 }), fabric, 0, -0.24, 0))
    sh.add(ring(0.14, 0.03, bronze, -0.12))
    if (s > 0) { // mission patch on the left shoulder
      const p = mesh(new PlaneGeometry(0.16, 0.16), patchMat, 0.137, -0.2, 0)
      p.rotation.y = Math.PI / 2
      sh.add(p)
    }
    const el = new Group(); el.position.y = -0.46; sh.add(el); J['el' + k] = el
    el.add(mesh(bellows(0.125, 0.16, 4), fabricShade))
    el.add(mesh(folded(0.12, 0.2, { folds: 3, amp: 0.012, from: 0, to: 0.7, seed: s * 5 }), fabric, 0, -0.2, 0))
    el.add(ring(0.128, 0.035, metal, -0.38), ring(0.132, 0.014, anodized, -0.35)) // wrist disconnect
    // glove: gauntlet, palm, fingers and thumb
    const hand = new Group(); hand.position.y = -0.42; el.add(hand); J['hand' + k] = hand
    hand.add(mesh(new CylinderGeometry(0.1, 0.12, 0.1, 24), glove, 0, -0.03, 0))
    const palm = mesh(new RoundedBoxGeometry(0.12, 0.2, 0.21, 3, 0.05), glove, 0, -0.15, 0.01)
    hand.add(palm)
    for (let f = 0; f < 4; f++) {
      const fg = mesh(new CapsuleGeometry(0.033, 0.07, 4, 10), glove, s * 0.005, -0.27, -0.068 + f * 0.046)
      fg.rotation.x = -0.25 + f * 0.05
      fg.rotation.z = s * -0.28
      hand.add(fg)
    }
    const thumb = mesh(new CapsuleGeometry(0.035, 0.06, 4, 10), glove, s * -0.05, -0.16, 0.11)
    thumb.rotation.set(0.7, 0, s * -0.4)
    hand.add(thumb)
  })

  // Legs
  ;[['L', 1], ['R', -1]].forEach(([k, s]) => {
    const hip = new Group(); hip.position.set(s * 0.19, 0.0, 0); body.add(hip); J['hip' + k] = hip
    hip.add(mesh(folded(0.17, 0.3, { folds: 3, amp: 0.016, from: 0, to: 0.8, seed: s * 7 }), fabric, 0, -0.26, 0))
    hip.add(ring(0.172, 0.022, fabricShade, -0.1))
    const kn = new Group(); kn.position.y = -0.52; hip.add(kn); J['kn' + k] = kn
    kn.add(mesh(bellows(0.16, 0.18, 4), fabricShade))
    const pad = mesh(new SphereGeometry(0.1, 20, 14), hardPlain, 0, 0.02, 0.11)
    pad.scale.set(1, 1, 0.45)
    kn.add(pad)
    kn.add(mesh(folded(0.15, 0.28, { folds: 3, amp: 0.016, from: 0.2, to: 1, seed: s * 9 }), fabric, 0, -0.22, 0))
    kn.add(ring(0.155, 0.04, bronze, -0.36))
    // boot: upper, toe cap, tread sole
    kn.add(mesh(new RoundedBoxGeometry(0.28, 0.22, 0.42, 4, 0.08), hard, 0, -0.49, 0.05))
    kn.add(mesh(new RoundedBoxGeometry(0.26, 0.1, 0.12, 3, 0.04), fabricShade, 0, -0.44, 0.22))
    kn.add(ring(0.15, 0.03, metal, -0.39))
    const sole = mesh(new RoundedBoxGeometry(0.3, 0.06, 0.45, 2, 0.02), rubber, 0, -0.605, 0.05)
    kn.add(sole)
  })

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  patchMat.depthWrite = true

  const pose = {}
  JOINTS.forEach((j) => (pose[j] = [0, 0, 0]))
  pose.lift = 0

  // Blend any number of poses: apply([[POSES.idle, 0.7], [POSES.crouch, 0.3]])
  function apply(mix, extra = null) {
    JOINTS.forEach((j) => { pose[j][0] = pose[j][1] = pose[j][2] = 0 })
    pose.lift = 0
    pose.palm = 0
    let total = 0
    for (const [, w] of mix) total += w
    for (const [p, w] of mix) {
      const k = w / (total || 1)
      JOINTS.forEach((j) => { pose[j][0] += p[j][0] * k; pose[j][1] += p[j][1] * k; pose[j][2] += p[j][2] * k })
      pose.lift += p.lift * k
      pose.palm += (p.palm || 0) * k
    }
    if (extra) extra(pose)
    JOINTS.forEach((j) => J[j].rotation.set(pose[j][0], pose[j][1], pose[j][2]))
    body.position.y = pose.lift
    J.handR.rotation.y = -Math.PI / 2 * pose.palm // turn the right palm to face forward
  }

  return { root, body, joints: J, apply, visor }
}
