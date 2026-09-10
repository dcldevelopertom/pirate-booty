import { ColliderLayer, Entity, GltfContainer, MeshCollider, Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { HUB } from '../config'
import { hookSignClick } from './DeckDodgeKiosk'
import { registerHubGlb } from './HubHide'

const SCALE = 1.75
let lootSign: Entity | null = null

export function setupBootyLootSign(): void {
  if (lootSign) hookSignClick(lootSign, 'Booty Loot', 'loot')
}

export function buildBootyLootSign(): void {
  const scale = SCALE
  const pos = Vector3.create(HUB.x0 + 3.5, HUB.y + 0.5 + 0.5 * scale, HUB.z0 + 15)
  const rot = Quaternion.fromEulerDegrees(0, 165, 0)
  lootSign = engine.addEntity()
  Transform.create(lootSign, {
    position: pos,
    rotation: rot,
    scale: Vector3.create(scale, scale, scale)
  })
  GltfContainer.create(lootSign, {
    src: 'assets/models/booty-loot.glb',
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER,
    invisibleMeshesCollisionMask: ColliderLayer.CL_POINTER
  })
  MeshCollider.setBox(lootSign, ColliderLayer.CL_POINTER)
  registerHubGlb(lootSign)
}
