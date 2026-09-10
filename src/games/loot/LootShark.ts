import {
  Animator,
  ColliderLayer,
  Entity,
  GltfContainer,
  PlayerIdentityData,
  Transform,
  engine
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { LOOT } from '../../config'
import { room } from '../../net/messages'
import { holdPlayer, unlockToGameplay } from '../../ui/inputLocks'

/** Model nose sits 180° off +Z. */
const NOSE_YAW = 180
const TURN_DEG_PS = 260
const BITE_LINGER = 1.8

type Shark = {
  id: number
  entity: Entity
  path: Array<{ x: number; z: number }>
  y: number
  seg: number
  along: number
  yaw: number
  biting: boolean
  reported: boolean
  removeLeft: number
}

const sharks: Shark[] = []
let holdLeft = 0

export function setupLootShark(): void {
  room.onMessage('lootShark', (data) => {
    startPass(data)
  })
  room.onMessage('lootSharkHit', (data) => {
    onHit(data)
  })
  engine.addSystem((dt) => {
    const step = Math.min(dt > 1 ? dt / 1000 : dt, 0.05)
    if (holdLeft > 0) {
      holdLeft -= step
      if (holdLeft <= 0) unlockToGameplay()
    }
    const player = Transform.getOrNull(engine.PlayerEntity)
    for (let i = sharks.length - 1; i >= 0; i--) {
      const s = sharks[i]
      if (!Transform.has(s.entity)) {
        sharks.splice(i, 1)
        continue
      }
      if (!s.biting) swim(s, step)
      s.removeLeft -= step
      if (s.removeLeft <= 0) {
        dropShark(s.id)
        continue
      }
      if (s.biting || s.reported || !player) continue
      const t = Transform.get(s.entity)
      const dx = player.position.x - t.position.x
      const dz = player.position.z - t.position.z
      if (dx * dx + dz * dz > LOOT.sharkBiteRange * LOOT.sharkBiteRange) continue
      s.reported = true
      room.send('lootSharkBite', { id: s.id, x: player.position.x, z: player.position.z })
    }
  }, 6, 'loot-shark')
}

export function clearLootShark(): void {
  for (const s of sharks) {
    if (Transform.has(s.entity)) engine.removeEntity(s.entity)
  }
  sharks.length = 0
  if (holdLeft > 0) {
    holdLeft = 0
    unlockToGameplay()
  }
}

function dropShark(id: number): void {
  const i = sharks.findIndex((s) => s.id === id)
  if (i < 0) return
  const s = sharks[i]
  if (Transform.has(s.entity)) engine.removeEntity(s.entity)
  sharks.splice(i, 1)
}

function startPass(data: { id: number; y: number; ms: number; points: Array<{ x: number; z: number }> }): void {
  if (!data.points || data.points.length < 2) return
  dropShark(data.id)
  const a = data.points[0]
  const b = data.points[1]
  const yaw = faceYaw(b.x - a.x, b.z - a.z, 0)
  const entity = engine.addEntity()
  Transform.create(entity, {
    position: Vector3.create(a.x, data.y, a.z),
    rotation: Quaternion.fromEulerDegrees(0, yaw, 0),
    scale: Vector3.create(2.2, 2.2, 2.2)
  })
  GltfContainer.create(entity, {
    src: LOOT.shark,
    visibleMeshesCollisionMask: ColliderLayer.CL_NONE,
    invisibleMeshesCollisionMask: ColliderLayer.CL_NONE
  })
  Animator.create(entity, {
    states: [
      { clip: 'Fly', playing: true, loop: true, weight: 1, speed: 1 },
      { clip: 'FlyFast', playing: false, loop: true, weight: 1, speed: 1.15 },
      { clip: 'Hover', playing: false, loop: true, weight: 1, speed: 1 },
      { clip: 'Bite', playing: false, loop: false, weight: 1, speed: 1 }
    ]
  })
  sharks.push({
    id: data.id,
    entity,
    path: data.points.slice(),
    y: data.y,
    seg: 0,
    along: 0,
    yaw,
    biting: false,
    reported: false,
    removeLeft: Math.max(1, (data.ms + 400) / 1000)
  })
}

function swim(s: Shark, dt: number): void {
  let rest = LOOT.sharkMps * dt
  while (rest > 0 && s.seg < s.path.length - 1) {
    const a = s.path[s.seg]
    const b = s.path[s.seg + 1]
    const sx = b.x - a.x
    const sz = b.z - a.z
    const len = Math.hypot(sx, sz)
    if (len < 0.001) {
      s.seg += 1
      s.along = 0
      continue
    }
    const left = len - s.along
    if (rest < left) {
      s.along += rest
      rest = 0
    } else {
      rest -= left
      s.seg += 1
      s.along = 0
    }
  }
  if (s.seg >= s.path.length - 1) {
    s.removeLeft = Math.min(s.removeLeft, 0.05)
    return
  }
  const a = s.path[s.seg]
  const b = s.path[s.seg + 1]
  const sx = b.x - a.x
  const sz = b.z - a.z
  const len = Math.hypot(sx, sz)
  const u = len > 0.001 ? s.along / len : 0
  const t = Transform.getMutable(s.entity)
  t.position = Vector3.create(a.x + sx * u, s.y, a.z + sz * u)
  const want = faceYaw(sx, sz, s.yaw)
  const d = deltaYaw(s.yaw, want)
  const max = TURN_DEG_PS * dt
  s.yaw += Math.max(-max, Math.min(max, d))
  t.rotation = Quaternion.fromEulerDegrees(0, s.yaw, 0)
}

function faceYaw(dx: number, dz: number, fallback: number): number {
  if (dx * dx + dz * dz < 0.0001) return fallback
  return (Math.atan2(dx, dz) * 180) / Math.PI + NOSE_YAW
}

function deltaYaw(from: number, to: number): number {
  let d = (to - from) % 360
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

function onHit(data: { id: number; address: string; x: number; z: number; held?: number }): void {
  const me = PlayerIdentityData.getOrNull(engine.PlayerEntity)?.address ?? ''
  if (me && me.toLowerCase() === data.address.toLowerCase()) {
    holdPlayer()
    holdLeft = LOOT.sharkHold
  }
  const s = sharks.find((sh) => sh.id === data.id)
  if (!s || !Transform.has(s.entity)) return
  s.reported = true
  s.biting = true
  s.removeLeft = BITE_LINGER
  const t = Transform.getMutable(s.entity)
  s.yaw = faceYaw(data.x - t.position.x, data.z - t.position.z, s.yaw)
  t.rotation = Quaternion.fromEulerDegrees(0, s.yaw, 0)
  Animator.playSingleAnimation(s.entity, 'Bite', true)
}
