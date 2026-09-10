import {
  Billboard,
  ColliderLayer,
  Entity,
  GltfContainer,
  Material,
  MaterialTransparencyMode,
  MeshRenderer,
  TextAlignMode,
  TextShape,
  Transform,
  VisibilityComponent,
  engine
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { CANNON, CANNON_CAM, LOOT, MATCH, WATER_Y } from '../../config'
import { playSplashAt } from '../../world/WaterSplash'

type Gun = { root: Entity; barrel: Entity; slot: number }
type Target = {
  id: number
  entity: Entity
  hull: Entity
  wreck: Entity
  x: number
  y: number
  z: number
  dir: number
  speed: number
  scale: number
  sink: number
  wait: number
}
type Shot = {
  id: number
  entity: Entity
  spark: Entity
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  sparkT: number
}

const guns: Gun[] = []
const targets: Target[] = []
const shots: Shot[] = []
const pops: Array<{ entity: Entity; age: number; life: number }> = []


export function cannonSlotPose(slot: number): { x: number; y: number; z: number; lookX: number; lookY: number; lookZ: number } {
  const i = Math.max(0, Math.min(MATCH.maxPlayers - 1, slot))
  const x = CANNON_CAM.x + (i - (MATCH.maxPlayers - 1) / 2) * CANNON_CAM.slotSpread
  const y = CANNON_CAM.y - 2.35
  const z = CANNON_CAM.z + 1.15
  const yr = (CANNON_CAM.yaw * Math.PI) / 180
  return {
    x,
    y,
    z,
    lookX: x + Math.sin(yr) * 28,
    lookY: y + 1.2,
    lookZ: z + Math.cos(yr) * 28
  }
}

export function cannonStandPose(_slot: number): { x: number; y: number; z: number; lookX: number; lookY: number; lookZ: number } {
  const x = CANNON_CAM.x + (Math.random() - 0.5) * 3
  const z = 168 + (Math.random() - 0.5) * 1.6
  const y = 36
  const yr = (CANNON_CAM.yaw * Math.PI) / 180
  return {
    x,
    y,
    z,
    lookX: x + Math.sin(yr) * 28,
    lookY: y + 1.2,
    lookZ: z + Math.cos(yr) * 28
  }
}

const HARNESS_SCALE = 1.75
const HARNESS_Y = 0.243 * HARNESS_SCALE
const BARREL_SCALE = 1.85
const BARREL_Y = 0.58
const BARREL_Z = 0
const BARREL_HALF = 0.5 * BARREL_SCALE
const MESH_YAW = -90

export function cannonMuzzle(slot: number, pitch: number, yaw: number): { x: number; y: number; z: number; vx: number; vy: number; vz: number } {
  const pose = cannonSlotPose(slot)
  const pr = (pitch * Math.PI) / 180
  const yr = (yaw * Math.PI) / 180
  const fx = Math.sin(yr) * Math.cos(pr)
  const fy = Math.sin(pr)
  const fz = Math.cos(yr) * Math.cos(pr)
  const lx = 0
  const ly = BARREL_Y + BARREL_HALF * Math.sin(pr)
  const lz = BARREL_Z + BARREL_HALF * Math.cos(pr)
  return {
    x: pose.x + lx * Math.cos(yr) + lz * Math.sin(yr),
    y: pose.y + ly,
    z: pose.z + -lx * Math.sin(yr) + lz * Math.cos(yr),
    vx: fx * CANNON.muzzle,
    vy: fy * CANNON.muzzle,
    vz: fz * CANNON.muzzle
  }
}

export function buildCannonDeck(): void {
  guns.length = 0
  for (let i = 0; i < MATCH.maxPlayers; i++) {
    const pose = cannonSlotPose(i)
    const root = engine.addEntity()
    Transform.create(root, {
      position: Vector3.create(pose.x, pose.y, pose.z),
      rotation: Quaternion.fromEulerDegrees(0, CANNON_CAM.yaw, 0)
    })
    const harness = engine.addEntity()
    Transform.create(harness, {
      parent: root,
      position: Vector3.create(0, HARNESS_Y, 0),
      rotation: Quaternion.fromEulerDegrees(0, MESH_YAW, 0),
      scale: Vector3.create(HARNESS_SCALE, HARNESS_SCALE, HARNESS_SCALE)
    })
    GltfContainer.create(harness, {
      src: CANNON.harness,
      visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
      invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
    })
    const pivot = engine.addEntity()
    Transform.create(pivot, {
      parent: root,
      position: Vector3.create(0, BARREL_Y, BARREL_Z),
      rotation: Quaternion.fromEulerDegrees(-CANNON.pitchStart, 0, 0)
    })
    const barrel = engine.addEntity()
    Transform.create(barrel, {
      parent: pivot,
      rotation: Quaternion.fromEulerDegrees(0, MESH_YAW, 0),
      scale: Vector3.create(BARREL_SCALE, BARREL_SCALE, BARREL_SCALE)
    })
    GltfContainer.create(barrel, {
      src: CANNON.barrel,
      visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
      invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
    })
    guns.push({ root, barrel: pivot, slot: i })
  }
}

export function aimCannon(slot: number, pitch: number, yaw: number): void {
  const gun = guns[slot]
  if (!gun || !Transform.has(gun.root) || !Transform.has(gun.barrel)) return
  Transform.getMutable(gun.root).rotation = Quaternion.fromEulerDegrees(0, yaw, 0)
  Transform.getMutable(gun.barrel).rotation = Quaternion.fromEulerDegrees(-pitch, 0, 0)
}

export function spawnCannonShip(spec: {
  id: number
  x: number
  y: number
  z: number
  dir: number
  speed: number
  scale: number
}): void {
  removeCannonShip(spec.id)
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(spec.x, spec.y, spec.z),
    rotation: Quaternion.fromEulerDegrees(0, shipYaw(spec.dir), 0),
    scale: Vector3.create(spec.scale, spec.scale, spec.scale)
  })
  const hull = engine.addEntity()
  Transform.create(hull, { parent: entity })
  GltfContainer.create(hull, {
    src: CANNON.model,
    visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
    invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
  })
  const wreck = engine.addEntity()
  Transform.create(wreck, { parent: entity })
  GltfContainer.create(wreck, {
    src: LOOT.wreck,
    visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
    invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
  })
  VisibilityComponent.create(wreck, { visible: false, propagateToChildren: true })
  targets.push({ ...spec, entity, hull, wreck, sink: 0, wait: 0 })
}

export function sinkCannonShip(id: number, coins = 1): void {
  const t = targets.find((s) => s.id === id)
  if (!t) return
  t.speed = 0
  t.wait = 2
  t.sink = 0
  if (Transform.has(t.hull)) {
    VisibilityComponent.createOrReplace(t.hull, { visible: false, propagateToChildren: true })
  }
  if (Transform.has(t.wreck)) {
    VisibilityComponent.createOrReplace(t.wreck, { visible: true, propagateToChildren: true })
  }
  const label = engine.addEntity()
  Transform.create(label, {
    parent: t.wreck,
    position: Vector3.create(0, 0.22, 0)
  })
  Billboard.create(label)
  TextShape.create(label, {
    text: `+${Math.max(1, coins)}`,
    fontSize: 1.6,
    width: 6,
    height: 3,
    textWrapping: false,
    textColor: Color4.create(1, 0.86, 0.2, 1),
    outlineWidth: 0.22,
    outlineColor: Color3.create(0.15, 0.1, 0),
    textAlign: TextAlignMode.TAM_MIDDLE_CENTER
  })
  pops.push({ entity: label, age: 0, life: 3 })
}

export function applyCannonShake(x: number, y: number, z: number): void {
  for (const g of guns) {
    if (!Transform.has(g.root)) continue
    const pose = cannonSlotPose(g.slot)
    Transform.getMutable(g.root).position = Vector3.create(pose.x + x, pose.y + y, pose.z + z)
  }
}

export function removeCannonShip(id: number): void {
  const i = targets.findIndex((s) => s.id === id)
  if (i < 0) return
  const t = targets[i]
  if (Transform.has(t.entity)) engine.removeEntityWithChildren(t.entity)
  targets.splice(i, 1)
}

export function spawnCannonShot(spec: {
  id: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
}): void {
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(spec.x, spec.y, spec.z),
    scale: Vector3.create(CANNON.ballRadius * 2, CANNON.ballRadius * 2, CANNON.ballRadius * 2)
  })
  MeshRenderer.setSphere(entity)
  Material.setPbrMaterial(entity, {
    albedoColor: Color4.create(0.04, 0.04, 0.05, 1),
    roughness: 0.45,
    metallic: 0.2
  })
  const spark = engine.addEntity()
  Transform.create(spark, {
    parent: entity,
    position: Vector3.create(0.28, 0.32, 0.12),
    scale: Vector3.create(0.22, 0.22, 0.22)
  })
  MeshRenderer.setSphere(spark)
  Material.setPbrMaterial(spark, {
    albedoColor: Color4.create(1, 0.55, 0.12, 1),
    emissiveColor: Color3.create(1, 0.45, 0.08),
    emissiveIntensity: 4,
    roughness: 1,
    metallic: 0,
    transparencyMode: MaterialTransparencyMode.MTM_OPAQUE
  })
  shots.push({ ...spec, entity, spark, sparkT: 0 })
}

export function removeCannonShot(id: number): void {
  const i = shots.findIndex((s) => s.id === id)
  if (i < 0) return
  const s = shots[i]
  if (Transform.has(s.entity)) engine.removeEntityWithChildren(s.entity)
  shots.splice(i, 1)
}

export function tickCannonVisuals(dt: number): void {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]
    s.vy -= CANNON.gravity * dt
    s.x += s.vx * dt
    s.y += s.vy * dt
    s.z += s.vz * dt
    s.sparkT += dt
    if (!Transform.has(s.entity)) {
      shots.splice(i, 1)
      continue
    }
    Transform.getMutable(s.entity).position = Vector3.create(s.x, s.y, s.z)
    if (Transform.has(s.spark)) {
      const pulse = 0.16 + 0.1 * (0.5 + 0.5 * Math.sin(s.sparkT * 28))
      Transform.getMutable(s.spark).scale = Vector3.create(pulse, pulse, pulse)
    }
    if (s.y > WATER_Y) continue
    playSplashAt(s.x, s.z)
    if (Transform.has(s.entity)) engine.removeEntityWithChildren(s.entity)
    shots.splice(i, 1)
  }
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]
    p.age += dt
    const u = Math.min(1, p.age / p.life)
    if (!Transform.has(p.entity)) {
      pops.splice(i, 1)
      continue
    }
    if (TextShape.has(p.entity)) {
      const a = 1 - u
      const ts = TextShape.getMutable(p.entity)
      ts.textColor = Color4.create(1, 0.86, 0.2, a)
      ts.outlineColor = Color3.create(0.15 * a, 0.1 * a, 0)
    }
    if (u < 1) continue
    engine.removeEntity(p.entity)
    pops.splice(i, 1)
  }
  for (let i = targets.length - 1; i >= 0; i--) {
    const t = targets[i]
    if (!Transform.has(t.entity)) {
      targets.splice(i, 1)
      continue
    }
    const tr = Transform.getMutable(t.entity)
    if (t.wait > 0) {
      t.wait -= dt
      tr.position = Vector3.create(t.x, t.y, t.z)
      if (t.wait > 0) continue
      t.sink = 2
    }
    if (t.sink > 0) {
      t.sink -= dt
      t.y -= 3.2 * dt
      tr.position = Vector3.create(t.x, t.y, t.z)
      tr.rotation = Quaternion.fromEulerDegrees(22, shipYaw(t.dir), 14)
      if (t.sink > 0) continue
      engine.removeEntityWithChildren(t.entity)
      targets.splice(i, 1)
      continue
    }
    t.x += t.dir * t.speed * dt
    tr.position = Vector3.create(t.x, t.y, t.z)
  }
}

function shipYaw(dir: number): number {
  return dir > 0 ? 0 : 180
}

export function clearCannonArena(): void {
  for (const s of shots) {
    if (Transform.has(s.entity)) engine.removeEntityWithChildren(s.entity)
  }
  shots.length = 0
  for (const p of pops) {
    if (Transform.has(p.entity)) engine.removeEntity(p.entity)
  }
  pops.length = 0
  for (const t of targets) {
    if (Transform.has(t.entity)) engine.removeEntityWithChildren(t.entity)
  }
  targets.length = 0
  for (const g of guns) {
    if (Transform.has(g.root)) engine.removeEntityWithChildren(g.root)
  }
  guns.length = 0
}
