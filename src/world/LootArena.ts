import {
  ColliderLayer,
  Entity,
  GltfContainer,
  MeshCollider,
  MeshRenderer,
  Transform,
  VisibilityComponent,
  engine
} from '@dcl/sdk/ecs'
import { isServer } from '@dcl/sdk/network'
import { Color4, Quaternion, Vector3 } from '@dcl/sdk/math'
import { LOOT, MATCH, WATER_Y } from '../config'
import { PALETTE } from './palette'
import { floatBarrel } from './BobBarrel'
import { box, paint } from './primitives'

let glbRoot: Entity | null = null
let gmForce = false
let matchShow = false
const chests: Entity[] = []
const lootBarrels: Entity[] = []
let wreck: Entity | null = null
const CHEST_SCALE = Vector3.create(1.15, 1.15, 1.15)

const PAD = [
  Color4.create(0.83, 0.63, 0.09, 1),
  Color4.create(0.75, 0.22, 0.18, 1),
  Color4.create(0.15, 0.55, 0.62, 1),
  Color4.create(0.42, 0.22, 0.58, 1)
]

export function lootCenter(): Vector3 {
  return Vector3.create(LOOT.x0 + LOOT.size / 2, LOOT.y, LOOT.z0 + LOOT.size / 2)
}

export function lootSlotZ(slot: number): number {
  const i = Math.max(0, Math.min(MATCH.maxPlayers - 1, slot))
  const pad = 4
  const span = LOOT.size - pad * 2
  return LOOT.z0 + pad + (span * (i + 0.5)) / MATCH.maxPlayers
}

export function lootStart(slot: number): { x: number; y: number; z: number; lookX: number; lookY: number; lookZ: number } {
  const z = lootSlotZ(slot)
  const x = LOOT.x0 + LOOT.startZ
  const y = LOOT.y + 1.2
  return { x, y, z, lookX: x + 12, lookY: y, lookZ: z }
}

export function lootChestPos(slot: number): Vector3 {
  return Vector3.create(LOOT.x0 + LOOT.chestZ, LOOT.y + 0.35, lootSlotZ(slot))
}

export function isLootGlbsForced(): boolean {
  return gmForce
}

export function toggleLootGlbsForced(): void {
  gmForce = !gmForce
  applyLootGlbVis()
}

export function showLootGlbsForMatch(_slot: number): void {
  matchShow = true
  applyLootGlbVis()
}

export function hideLootGlbsAfterMatch(): void {
  matchShow = false
  applyLootGlbVis()
}

function applyLootGlbVis(): void {
  const on = gmForce || matchShow
  setVisible(wreck, on)
  for (const chest of chests) setVisible(chest, on)
  for (const barrel of lootBarrels) setVisible(barrel, on)
}

function setVisible(entity: Entity | null, on: boolean): void {
  if (!entity) return
  VisibilityComponent.createOrReplace(entity, { visible: on, propagateToChildren: true })
}

export function buildLootArena(): void {
  glbRoot = engine.addEntity()
  Transform.create(glbRoot)

  const c = lootCenter()
  const ground = engine.addEntity()
  Transform.create(ground, {
    position: Vector3.create(c.x, LOOT.y, c.z),
    rotation: Quaternion.fromEulerDegrees(90, 0, 0),
    scale: Vector3.create(LOOT.size, LOOT.size, 1)
  })
  MeshRenderer.setPlane(ground)
  MeshCollider.setPlane(ground, ColliderLayer.CL_PHYSICS)
  paint(ground, PALETTE.WOOD)

  for (let i = 0; i < MATCH.maxPlayers; i++) {
    const z = lootSlotZ(i)
    box(
      undefined,
      Vector3.create(LOOT.x0 + LOOT.startZ, LOOT.y + 0.06, z),
      Vector3.create(1.6, 0.08, 1.6),
      PAD[i] ?? PALETTE.GOLD
    )
    const chest = engine.addEntity()
    Transform.create(chest, {
      parent: glbRoot,
      position: lootChestPos(i),
      rotation: Quaternion.fromEulerDegrees(0, 90, 0),
      scale: CHEST_SCALE
    })
    GltfContainer.create(chest, {
      src: LOOT.model,
      visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
      invisibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS
    })
    chests.push(chest)
  }

  const wreckScale = 14
  wreck = engine.addEntity()
  Transform.create(wreck, {
    parent: glbRoot,
    position: Vector3.create(LOOT.x0 + LOOT.size - 5, WATER_Y + 3, c.z),
    rotation: Quaternion.fromEulerDegrees(0, 90, 12),
    scale: Vector3.create(wreckScale, wreckScale, wreckScale)
  })
  GltfContainer.create(wreck, {
    src: LOOT.wreck,
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
    invisibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS
  })

  ringLootBarrels()
  if (!isServer()) applyLootGlbVis()
}

function ringLootBarrels(): void {
  const x0 = LOOT.x0
  const z0 = LOOT.z0
  const s = LOOT.size
  const out = 1.7
  const step = 3.3
  let n = 0
  const place = (x: number, z: number) => {
    const i = n++
    lootBarrels.push(
      floatBarrel(
        x + ((i % 5) - 2) * 0.12,
        z + ((i % 3) - 1) * 0.15,
        0.18 + (i % 4) * 0.04,
        2700 + (i % 6) * 220,
        8 + (i % 5) * 1.5,
        3200 + (i % 5) * 180,
        (i * 37) % 180
      )
    )
  }
  for (let x = x0 + 1.2; x <= x0 + s - 1.2; x += step) place(x, z0 - out)
  for (let x = x0 + 1.2; x <= x0 + s - 1.2; x += step) place(x, z0 + s + out)
  for (let z = z0 + 1.2; z <= z0 + s - 1.2; z += step) place(x0 + s + out, z)
}
