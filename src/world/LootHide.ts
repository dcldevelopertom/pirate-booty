import { AvatarModifierArea, AvatarModifierType, Entity, Transform, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { LOOT } from '../config'
import { lootCenter } from './LootArena'

let volume: Entity | null = null
let lastExclude: string[] = []

export function buildLootHide(): void {
  const c = lootCenter()
  const height = 14
  volume = engine.addEntity()
  Transform.create(volume, { position: Vector3.create(c.x, LOOT.y + height / 2, c.z) })
  AvatarModifierArea.create(volume, {
    area: Vector3.create(LOOT.size + 6, height, LOOT.size + 6),
    modifiers: [AvatarModifierType.AMT_HIDE_AVATARS],
    excludeIds: []
  })
}

export function setLootHideExcludes(addresses: string[]): void {
  if (!volume || !AvatarModifierArea.has(volume)) return
  const ids = unique(addresses)
  if (sameIds(lastExclude, ids)) return
  lastExclude = ids
  AvatarModifierArea.getMutable(volume).excludeIds = ids
}

function unique(addresses: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of addresses) {
    if (!id) continue
    const key = id.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(id)
  }
  return out
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}
