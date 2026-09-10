import {
  Billboard,
  BillboardMode,
  ColliderLayer,
  Entity,
  InputAction,
  Material,
  MaterialTransparencyMode,
  MeshCollider,
  MeshRenderer,
  TextureWrapMode,
  Transform,
  GltfNodeModifiers,
  VisibilityComponent,
  engine,
  pointerEventsSystem
} from '@dcl/sdk/ecs'
import { Color3, Color4, Quaternion, Vector2, Vector3 } from '@dcl/sdk/math'
import { FISH, GROUND_Y, LANE, WATER_Y, WORLD_SIZE } from '../../config'
import { PALETTE } from '../../world/palette'
import { attachDeckSliver } from '../barrel/RowVisuals'
import { rollFishDepth, type FishPath } from './FishSim'
import {
  fishHookWorld,
  fishLookAxis,
  fishNearOffset,
  fishRowAxis,
  fishSlotPos,
  fishStandPose,
  fishSwimWorld,
  fishYawRad
} from './FishSpace'
import { fishKindById, pickFishKind, type FishKind } from './FishTypes'

export {
  fishLookAxis,
  fishNearOffset,
  fishRowAxis,
  fishSlotPos,
  fishStandPose,
  fishYawRad
}

type Swimmer = {
  id: number
  entity: Entity
  along: number
  along0: number
  along1: number
  dur: number
  t: number
  depth: number
  out: number
  dir: number
  speed: number
  half: number
  hooked: boolean
  coins: number
  kind: FishKind
  sx: number
  sy: number
  pause: number
  nextTurn: number
  immune: number
  painted: string
}

const slots: Entity[] = []
const visuals: Array<Entity | null> = []
const school: Swimmer[] = []
let pierDeck: Entity | null = null
let liveCount = FISH.fishCount
let picked = -1
let line: Entity | null = null
let hook: Entity | null = null
let lineSlot = 0
let lineDepth = FISH.lineMin
let hooked: Swimmer | null = null
let hideBobber = false
const taken = new Set<number>()
let occupants: string[] = []
const holeTint: boolean[] = []
type RemoteRig = {
  slot: number
  line: Entity
  hook: Entity
  fish: Entity
  depth: number
  along: number
  fishDepth: number
  out: number
  toDepth: number
  toAlong: number
  toFishDepth: number
  toOut: number
  hooked: boolean
  kind: string
}
const remotes = new Map<number, RemoteRig>()

export function fishPierCenter(): { x: number; y: number; z: number } {
  return { x: FISH.x0, y: FISH.y, z: FISH.z0 }
}

export function buildFishPier(): void {
  slots.length = 0
  picked = -1
  const topY = FISH.y + LANE.rowHeight / 2
  const rot = Quaternion.fromEulerDegrees(0, FISH.yaw, 0)
  for (let i = 0; i < FISH.slots; i++) {
    const p = fishSlotPos(i)
    const sliver = engine.addEntity()
    Transform.create(sliver, {
      position: Vector3.create(p.x, FISH.y, p.z),
      rotation: rot,
      scale: Vector3.create(LANE.rowDepth, LANE.rowHeight, LANE.width)
    })
    MeshCollider.setBox(sliver, ColliderLayer.CL_POINTER)
    slots.push(sliver)
    visuals.push(attachDeckSliver(sliver))
  }
  pierDeck = engine.addEntity()
  const spanX = FISH.slots * FISH.slotGap
  Transform.create(pierDeck, {
    position: Vector3.create(FISH.x0, topY - 0.5, FISH.z0),
    rotation: rot,
    scale: Vector3.create(spanX, 1, LANE.width)
  })
  MeshCollider.setBox(pierDeck, ColliderLayer.CL_PHYSICS)
  buildUnderwaterBack(spanX)
  buildFishLine()
  buildFishSchool()
  setFishPegsVisible(false)
  setFishSlotPointers(false)
}

function buildUnderwaterBack(_spanX: number): void {
  const h = WATER_Y - GROUND_Y + 0.3
  const wall = engine.addEntity()
  Transform.create(wall, {
    position: Vector3.create(WORLD_SIZE / 2, WATER_Y - h / 2 - 0.2 + 0.5, FISH.z0),
    rotation: Quaternion.fromEulerDegrees(0, FISH.yaw + 180, 0),
    scale: Vector3.create(WORLD_SIZE, h, 1)
  })
  MeshRenderer.setPlane(wall)
  Material.setPbrMaterial(wall, {
    albedoColor: Color4.create(0.12, 0.48, 0.78, 1),
    emissiveColor: Color3.create(0.04, 0.22, 0.38),
    emissiveIntensity: 0.28,
    roughness: 0.22,
    metallic: 0.08
  })
}

function buildFishLine(): void {
  line = engine.addEntity()
  Transform.create(line, {
    position: Vector3.create(FISH.x0, WATER_Y, FISH.z0),
    scale: Vector3.create(0.12, 1, 0.12)
  })
  MeshRenderer.setCylinder(line)
  Material.setPbrMaterial(line, {
    albedoColor: PALETTE.ROPE,
    roughness: 0.7,
    metallic: 0.05
  })

  hook = engine.addEntity()
  Transform.create(hook, {
    position: Vector3.create(FISH.x0, WATER_Y - 1, FISH.z0),
    scale: Vector3.create(0.48, 0.85, 1)
  })
  MeshRenderer.setPlane(hook)
  Billboard.create(hook, { billboardMode: BillboardMode.BM_Y })
  Material.setPbrMaterial(hook, {
    texture: Material.Texture.Common({ src: 'images/hook.png' }),
    albedoColor: Color4.create(1, 1, 1, 1),
    emissiveTexture: Material.Texture.Common({ src: 'images/hook.png' }),
    emissiveColor: Color3.create(1, 1, 1),
    emissiveIntensity: 0.35,
    roughness: 0.5,
    metallic: 0,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_TEST,
    alphaTest: 0.35
  })
  hideFishLine()
}

export function showFishLine(slot: number, depth: number): void {
  lineSlot = slot
  setFishLineDepth(depth)
}

function stowBobber(): void {
  if (line && Transform.has(line)) {
    Transform.getMutable(line).scale = Vector3.create(0.001, 0.001, 0.001)
  }
  if (hook && Transform.has(hook)) {
    Transform.getMutable(hook).scale = Vector3.create(0.001, 0.001, 0.001)
  }
}

export function hideFishLine(): void {
  hideBobber = false
  if (hooked) {
    hooked.hooked = false
    hooked = null
  }
  stowBobber()
}

export function setFishLineDepth(depth: number): void {
  const n = Number.isFinite(depth) ? depth : FISH.lineMin
  lineDepth = Math.max(FISH.lineMin, Math.min(FISH.lineMax, n))
  placeLine()
}

export function getFishLineDepth(): number {
  return lineDepth
}

export function snapshotFishLine(): {
  depth: number
  hooked: boolean
  kind: string
  along: number
  fishDepth: number
  out: number
} {
  if (!hooked) {
    return { depth: lineDepth, hooked: false, kind: '', along: 0, fishDepth: 0, out: 0 }
  }
  return {
    depth: lineDepth,
    hooked: true,
    kind: hooked.kind.id,
    along: hooked.along,
    fishDepth: hooked.depth,
    out: hooked.out
  }
}

export type RemoteFishLine = {
  slot: number
  depth: number
  hooked: boolean
  kind: string
  along: number
  fishDepth: number
  out: number
}

export function syncRemoteFishLines(rows: RemoteFishLine[], skipSlot: number): void {
  const keep = new Set<number>()
  for (const row of rows) {
    if (row.slot === skipSlot) continue
    keep.add(row.slot)
    applyRemoteFishLine(row, skipSlot)
  }
  for (const [slot] of remotes) {
    if (keep.has(slot) || slot === skipSlot) continue
    dropRemote(slot)
  }
}

export function applyRemoteFishLine(row: RemoteFishLine, skipSlot: number): void {
  if (row.slot === skipSlot) {
    dropRemote(row.slot)
    return
  }
  const fresh = !remotes.has(row.slot)
  const rig = remotes.get(row.slot) ?? makeRemote(row.slot)
  remotes.set(row.slot, rig)
  rig.toDepth = row.depth
  rig.toAlong = row.along
  rig.toFishDepth = row.fishDepth
  rig.toOut = row.out
  if (fresh) {
    rig.depth = row.depth
    rig.along = row.along
    rig.fishDepth = row.fishDepth
    rig.out = row.out
  }
  rig.hooked = row.hooked
  if (row.kind && row.kind !== rig.kind) {
    rig.kind = row.kind
    const kind = fishKindById(row.kind)
    if (kind) paintFish(rig.fish, kind, 1)
  }
  if (!row.hooked) rig.kind = ''
}

export function tickRemoteFishLines(dt: number): void {
  const k = Math.min(1, dt * 12)
  for (const rig of remotes.values()) {
    rig.depth += (rig.toDepth - rig.depth) * k
    rig.along += (rig.toAlong - rig.along) * k
    rig.fishDepth += (rig.toFishDepth - rig.fishDepth) * k
    rig.out += (rig.toOut - rig.out) * k
    const fishPos = rig.hooked ? swimWorld(rig.along, rig.fishDepth, rig.out) : null
    layLine(rig.line, rig.hook, rig.slot, rig.depth, fishPos)
    const kind = rig.hooked ? fishKindById(rig.kind) : undefined
    if (kind && Transform.has(rig.fish)) {
      const t = Transform.getMutable(rig.fish)
      t.position = fishPos ?? swimWorld(0, rig.depth, 0.5)
      t.scale = Vector3.create(kind.scale * 1.7, kind.scale * 0.75, 0.08)
    } else if (Transform.has(rig.fish)) {
      Transform.getMutable(rig.fish).scale = Vector3.create(0.001, 0.001, 0.001)
    }
  }
}

export function clearRemoteFishLines(): void {
  for (const slot of [...remotes.keys()]) dropRemote(slot)
}

export function clearFishSchoolVisuals(): void {
  for (const s of school) {
    if (Transform.has(s.entity)) engine.removeEntity(s.entity)
  }
  school.length = 0
  hooked = null
  liveCount = 0
}

export function hookWorld(): Vector3 {
  const h = fishHookWorld(lineSlot, lineDepth)
  return Vector3.create(h.x, h.y, h.z)
}

export function hookFishById(id: number): { coins: number; id: number } | null {
  if (hooked && hooked.id === id) return { coins: hooked.coins, id: hooked.id }
  const s = school.find((x) => x.id === id)
  if (!s) return null
  if (hooked && hooked !== s) {
    hooked.hooked = false
    hooked = null
  }
  s.hooked = true
  hooked = s
  placeLine()
  return { coins: s.coins, id: s.id }
}

export function applyFightPose(along: number, depth: number, out: number): void {
  if (!hooked) return
  hooked.along = along
  hooked.depth = depth
  hooked.out = out
  if (Transform.has(hooked.entity)) {
    Transform.getMutable(hooked.entity).position = swimWorld(along, depth, out)
  }
  placeLine()
}

export function hookedId(): number {
  return hooked?.id ?? 0
}

export function isFishHooked(): boolean {
  return hooked !== null
}

export function hookedCoins(): number {
  return hooked?.coins ?? 1
}

export function hookedKind(): FishKind | null {
  return hooked?.kind ?? null
}

export function releaseHooked(): void {
  if (!hooked) return
  hooked.hooked = false
  hooked.immune = 5
  hooked.pause = 0
  hooked.out = Math.min(9, hooked.out + 3.2)
  hooked.depth = Math.min(FISH.depthMax, hooked.depth + 1.4)
  hooked.speed = Math.max(hooked.speed, hooked.kind.speed * 2.6)
  hooked.nextTurn = 4 + Math.random() * 4
  hooked.dir *= -1
  hooked.painted = ''
  paintSwimmer(hooked)
  hooked = null
  hideBobber = false
  placeLine()
}

export function reelHooked(dt: number, pull: number): void {
  if (!hooked) return
  hooked.depth -= pull * 2.2 * dt
  hooked.out -= pull * 1.6 * dt
  hooked.depth = Math.max(0.55, Math.min(FISH.lineMax, hooked.depth))
  hooked.out = Math.max(0.12, Math.min(9, hooked.out))
  const targetAlong = (lineSlot - (FISH.slots - 1) / 2) * FISH.slotGap
  hooked.along += (targetAlong - hooked.along) * (0.35 + Math.max(0, pull) * 1.4) * dt
  hooked.along += (Math.random() - 0.5) * 1.4 * dt
  hooked.depth += (Math.random() - 0.5) * 0.9 * dt
  if (Transform.has(hooked.entity)) {
    Transform.getMutable(hooked.entity).position = swimWorld(hooked.along, hooked.depth, hooked.out)
  }
  placeLine()
  const pose = fishStandPose(lineSlot)
  const topY = FISH.y + LANE.rowHeight / 2
  if (hooked && Transform.has(hooked.entity)) {
    const p = Transform.get(hooked.entity).position
    const dx = p.x - pose.x
    const dy = p.y - topY
    const dz = p.z - pose.z
    lineDepth = Math.max(FISH.lineMin, Math.min(FISH.lineMax, Math.sqrt(dx * dx + dy * dy + dz * dz)))
  }
}

export function isReeledIn(): boolean {
  if (!hooked) return false
  return hooked.depth <= 0.72 && hooked.out <= 0.8
}

export function celebrateCatchAt(x: number, y: number, z: number): void {
  if (!hooked || !Transform.has(hooked.entity)) return
  hideBobber = true
  const look = fishLookAxis()
  Transform.getMutable(hooked.entity).position = Vector3.create(
    x - look.x * 0.85,
    y + 0.5,
    z - look.z * 0.85
  )
  stowBobber()
}

export function landHooked(): { coins: number } | null {
  if (!hooked) return null
  const coins = hooked.coins
  respawnSwimmer(hooked)
  hooked.hooked = false
  hooked = null
  hideBobber = false
  placeLine()
  return { coins }
}

function respawnSwimmer(s: Swimmer): void {
  const span = ((FISH.slots - 1) * FISH.slotGap) / 2
  const kind = pickFishKind()
  s.kind = kind
  s.along = (Math.random() * 2 - 1) * span
  s.along0 = s.along
  s.along1 = s.along
  s.t = 0
  s.dur = 1
  s.depth = rollFishDepth(kind)
  s.out = 1.5 + Math.random() * 7
  s.dir = Math.random() < 0.5 ? 1 : -1
  s.speed = kind.speed * (0.9 + Math.random() * 0.25)
  s.coins = kind.coins
  s.hooked = false
  s.sx = kind.scale * 1.7
  s.sy = kind.scale * 0.75
  s.pause = 0
  s.nextTurn = 2 + Math.random() * 7
  s.immune = 0
  s.painted = ''
  paintSwimmer(s)
}

function placeLine(): void {
  if (hideBobber) {
    stowBobber()
    return
  }
  if (!line || !hook) return
  let fishPos: Vector3 | null = null
  if (hooked && Transform.has(hooked.entity)) fishPos = Transform.get(hooked.entity).position
  layLine(line, hook, lineSlot, lineDepth, fishPos)
}

function layLine(rope: Entity, bobber: Entity, slot: number, depth: number, fishPos: Vector3 | null): void {
  if (!Transform.has(rope) || !Transform.has(bobber)) return
  const pose = fishStandPose(slot)
  const top = Vector3.create(pose.x, FISH.y + LANE.rowHeight / 2, pose.z)
  const bottom = fishPos
    ? Vector3.create(fishPos.x, fishPos.y, fishPos.z)
    : Vector3.create(pose.x, top.y - depth, pose.z)
  const dx = bottom.x - top.x
  const dy = bottom.y - top.y
  const dz = bottom.z - top.z
  const len = Math.max(0.15, Math.sqrt(dx * dx + dy * dy + dz * dz))
  const yaw = (Math.atan2(dx, dz) * 180) / Math.PI
  const pitch = (Math.atan2(Math.sqrt(dx * dx + dz * dz), dy) * 180) / Math.PI
  Transform.getMutable(rope).position = Vector3.create(
    (top.x + bottom.x) / 2,
    (top.y + bottom.y) / 2,
    (top.z + bottom.z) / 2
  )
  Transform.getMutable(rope).rotation = Quaternion.fromEulerDegrees(pitch, yaw, 0)
  Transform.getMutable(rope).scale = Vector3.create(0.105, len, 0.105)
  Transform.getMutable(bobber).position = Vector3.create(bottom.x + 0.1, bottom.y, bottom.z)
  Transform.getMutable(bobber).scale = Vector3.create(0.48, 0.85, 1)
}

function makeRemote(slot: number): RemoteRig {
  const rope = engine.addEntity()
  Transform.create(rope, { scale: Vector3.create(0.105, 1, 0.105) })
  MeshRenderer.setCylinder(rope)
  Material.setPbrMaterial(rope, {
    albedoColor: PALETTE.ROPE,
    roughness: 0.7,
    metallic: 0.05
  })
  const bobber = engine.addEntity()
  Transform.create(bobber)
  MeshRenderer.setPlane(bobber)
  Billboard.create(bobber, { billboardMode: BillboardMode.BM_Y })
  Material.setPbrMaterial(bobber, {
    texture: Material.Texture.Common({ src: 'images/hook.png' }),
    albedoColor: Color4.create(1, 1, 1, 1),
    emissiveTexture: Material.Texture.Common({ src: 'images/hook.png' }),
    emissiveColor: Color3.create(1, 1, 1),
    emissiveIntensity: 0.35,
    roughness: 0.5,
    metallic: 0,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_TEST,
    alphaTest: 0.35
  })
  const fish = engine.addEntity()
  Transform.create(fish, {
    rotation: Quaternion.fromEulerDegrees(0, FISH.yaw + 180, 0),
    scale: Vector3.create(0.001, 0.001, 0.001)
  })
  MeshRenderer.setPlane(fish)
  return {
    slot,
    line: rope,
    hook: bobber,
    fish,
    depth: 10,
    along: 0,
    fishDepth: 0,
    out: 0,
    toDepth: 10,
    toAlong: 0,
    toFishDepth: 0,
    toOut: 0,
    hooked: false,
    kind: ''
  }
}

function dropRemote(slot: number): void {
  const rig = remotes.get(slot)
  if (!rig) return
  if (Transform.has(rig.line)) engine.removeEntity(rig.line)
  if (Transform.has(rig.hook)) engine.removeEntity(rig.hook)
  if (Transform.has(rig.fish)) engine.removeEntity(rig.fish)
  remotes.delete(slot)
}

function paintSwimmer(s: Swimmer): void {
  const key = `${s.kind.id}:${s.dir}`
  if (s.painted === key) return
  const prevKind = s.painted.split(':')[0]
  if (!s.painted || prevKind !== s.kind.id) paintFish(s.entity, s.kind)
  s.painted = key
  setFishUv(s.entity, s.dir)
}

function paintFish(entity: Entity, kind: FishKind, dir = 1): void {
  const tex = Material.Texture.Common({
    src: kind.image,
    wrapMode: TextureWrapMode.TWM_CLAMP,
    tiling: Vector2.create(1, 1),
    offset: Vector2.create(0, 0)
  })
  Material.setPbrMaterial(entity, {
    texture: tex,
    albedoColor: Color4.create(1, 1, 1, 1),
    emissiveTexture: tex,
    emissiveColor: Color3.create(1, 1, 1),
    emissiveIntensity: 0.4,
    roughness: 0.55,
    metallic: 0,
    transparencyMode: MaterialTransparencyMode.MTM_ALPHA_TEST,
    alphaTest: 0.35
  })
  setFishUv(entity, dir)
}

function setFishUv(entity: Entity, dir: number): void {
  if (!Material.has(entity)) return
  const m = Material.getMutable(entity)
  if (m.material?.$case !== 'pbr') return
  const flip = dir < 0
  const tiling = { x: flip ? -1 : 1, y: 1 }
  const offset = { x: flip ? 1 : 0, y: 0 }
  flipTex(m.material.pbr.texture, tiling, offset)
  flipTex(m.material.pbr.emissiveTexture, tiling, offset)
}

function flipTex(
  union: { tex?: { $case: string; texture?: { tiling?: { x: number; y: number }; offset?: { x: number; y: number } } } } | undefined,
  tiling: { x: number; y: number },
  offset: { x: number; y: number }
): void {
  const tex = union?.tex
  if (!tex || tex.$case !== 'texture' || !tex.texture) return
  tex.texture.tiling = tiling
  tex.texture.offset = offset
}

function spawnOneFish(): void {
  const span = ((FISH.slots - 1) * FISH.slotGap) / 2
  const kind = pickFishKind()
  const along = (Math.random() * 2 - 1) * span
  const depth = rollFishDepth(kind)
  const out = 1.5 + Math.random() * 7
  const dir = Math.random() < 0.5 ? 1 : -1
  pushSwimmer(-school.length - 1, kind, along, along, depth, out, dir, 8)
}

function buildFishSchool(): void {
  school.length = 0
  liveCount = 0
}

export function applyFishSchool(paths: FishPath[]): void {
  const keep = new Set(paths.map((p) => p.id))
  for (let i = school.length - 1; i >= 0; i--) {
    const s = school[i]
    if (s.hooked || s.id < 0) continue
    if (keep.has(s.id)) continue
    if (Transform.has(s.entity)) engine.removeEntity(s.entity)
    school.splice(i, 1)
  }
  for (const p of paths) applyFishPath(p)
  liveCount = school.length
}

export function applyFishPath(p: FishPath): void {
  const kind = fishKindById(p.kind)
  if (!kind) return
  let s = school.find((x) => x.id === p.id)
  if (!s) {
    s = pushSwimmer(p.id, kind, p.along0, p.along1, p.depth, p.out, p.dir, p.dur)
    return
  }
  if (s.hooked) return
  s.kind = kind
  s.along0 = p.along0
  s.along1 = p.along1
  s.along = p.along0
  s.depth = p.depth
  s.out = p.out
  s.dir = p.dir
  s.dur = Math.max(0.05, p.dur)
  s.t = 0
  s.coins = kind.coins
  s.sx = kind.scale * 1.7
  s.sy = kind.scale * 0.75
  paintSwimmer(s)
}

export function takeSchoolFish(id: number): void {
  const s = school.find((x) => x.id === id)
  if (!s || s === hooked) return
  s.hooked = true
  if (Transform.has(s.entity)) Transform.getMutable(s.entity).scale = Vector3.create(0.001, 0.001, 0.001)
}

function pushSwimmer(
  id: number,
  kind: FishKind,
  along0: number,
  along1: number,
  depth: number,
  out: number,
  dir: number,
  dur: number
): Swimmer {
  const e = engine.addEntity()
  const sx = kind.scale * 1.7
  const sy = kind.scale * 0.75
  Transform.create(e, {
    position: swimWorld(along0, depth, out),
    rotation: Quaternion.fromEulerDegrees(0, FISH.yaw + 180, 0),
    scale: Vector3.create(sx, sy, 0.08)
  })
  MeshRenderer.setPlane(e)
  const s: Swimmer = {
    id,
    entity: e,
    along: along0,
    along0,
    along1,
    dur: Math.max(0.05, dur),
    t: 0,
    depth,
    out,
    dir,
    speed: kind.speed,
    half: fishSpanHalf(),
    hooked: false,
    coins: kind.coins,
    kind,
    sx,
    sy,
    pause: 0,
    nextTurn: 0,
    immune: 0,
    painted: ''
  }
  paintSwimmer(s)
  school.push(s)
  return s
}

function fishSpanHalf(): number {
  return ((FISH.slots - 1) * FISH.slotGap) / 2 - 2
}

export function getFishCount(): number {
  return school.length
}

export function bumpFishCount(pct: number): number {
  let next = Math.round(school.length * (1 + pct))
  if (next === school.length) next = school.length + (pct > 0 ? 1 : -1)
  next = Math.max(0, Math.min(160, next))
  while (school.length < next) spawnOneFish()
  while (school.length > next) {
    const i = school.findIndex((s) => !s.hooked)
    const cut = i >= 0 ? i : school.length - 1
    const s = school[cut]
    if (!s) break
    if (s.hooked) break
    if (Transform.has(s.entity)) engine.removeEntity(s.entity)
    school.splice(cut, 1)
  }
  liveCount = school.length
  return liveCount
}

export function tickFishSchool(dt: number): void {
  for (const s of school) {
    if (s.immune > 0) s.immune -= dt
    if (s.hooked) continue
    s.t += dt
    const u = s.dur <= 0 ? 1 : Math.min(1, s.t / s.dur)
    s.along = s.along0 + (s.along1 - s.along0) * u
    if (!Transform.has(s.entity)) continue
    const t = Transform.getMutable(s.entity)
    t.position = swimWorld(s.along, s.depth, s.out)
    t.rotation = Quaternion.fromEulerDegrees(0, FISH.yaw + 180, 0)
    t.scale = Vector3.create(s.sx, s.sy, 0.08)
  }
  if (hooked) placeLine()
}

function swimWorld(along: number, depth: number, out: number): Vector3 {
  const p = fishSwimWorld(along, depth, out)
  return Vector3.create(p.x, p.y, p.z)
}

let pickCb: ((slot: number) => void) | null = null

export function hookFishSlots(onPick: (slot: number) => void): void {
  pickCb = onPick
}

export function isFishHoleTaken(slot: number): boolean {
  return taken.has(slot)
}

export function getFishOccupantAddresses(): string[] {
  return occupants
}

export function setTakenFishHoles(rows: Array<{ slot: number; address: string }>): void {
  taken.clear()
  occupants = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (row.slot < 0 || row.slot >= FISH.slots) continue
    taken.add(row.slot)
    const key = row.address.toLowerCase()
    if (key && !seen.has(key)) {
      seen.add(key)
      occupants.push(row.address)
    }
  }
  for (let i = 0; i < visuals.length; i++) {
    const on = taken.has(i)
    if (holeTint[i] === on) continue
    holeTint[i] = on
    paintHole(i, on)
  }
  for (const [slot] of remotes) {
    if (taken.has(slot)) continue
    dropRemote(slot)
  }
}

function paintHole(slot: number, on: boolean): void {
  const vis = visuals[slot]
  if (!vis) return
  if (on) {
    GltfNodeModifiers.createOrReplace(vis, {
      modifiers: [
        {
          path: '',
          material: {
            material: {
              $case: 'pbr',
              pbr: {
                albedoColor: Color4.create(0.82, 0.12, 0.1, 1),
                emissiveColor: Color3.create(0.55, 0.08, 0.04),
                emissiveIntensity: 0.45
              }
            }
          }
        }
      ]
    })
    return
  }
  if (GltfNodeModifiers.has(vis)) GltfNodeModifiers.deleteFrom(vis)
}

export function setFishSlotPointers(on: boolean): void {
  for (let i = 0; i < slots.length; i++) {
    const e = slots[i]
    if (!e) continue
    pointerEventsSystem.removeOnPointerDown(e)
    if (on && !taken.has(i)) {
      MeshCollider.setBox(e, ColliderLayer.CL_POINTER)
    } else if (MeshCollider.has(e)) {
      MeshCollider.deleteFrom(e)
    }
  }
  if (!on || !pickCb) return
  for (let i = 0; i < slots.length; i++) {
    const slot = i
    if (taken.has(slot)) continue
    const e = slots[i]
    if (!e) continue
    pointerEventsSystem.onPointerDown(
      {
        entity: e,
        opts: {
          button: InputAction.IA_POINTER,
          hoverText: `Hole ${slot + 1}`,
          maxDistance: 1000,
          maxPlayerDistance: 1000,
          showFeedback: true,
          showHighlight: true
        }
      },
      () => pickCb?.(slot)
    )
  }
}

export function markFishSlot(slot: number): void {
  picked = slot
}

export function clearFishSlotMark(): void {
  picked = -1
}

export function setFishPegsVisible(on: boolean): void {
  for (let i = 0; i < slots.length; i++) {
    const sliver = slots[i]
    if (sliver) VisibilityComponent.createOrReplace(sliver, { visible: on, propagateToChildren: true })
    const vis = visuals[i]
    if (vis) VisibilityComponent.createOrReplace(vis, { visible: on })
  }
  if (!pierDeck) return
  if (on) MeshCollider.setBox(pierDeck, ColliderLayer.CL_PHYSICS)
  else if (MeshCollider.has(pierDeck)) MeshCollider.deleteFrom(pierDeck)
  if (!on) clearRemoteFishLines()
}
