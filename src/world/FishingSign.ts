import { ColliderLayer, Entity, GltfContainer, MeshCollider, Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { HUB } from '../config'
import { hookSignClick } from './DeckDodgeKiosk'
import { registerHubGlb } from './HubHide'

const SCALE = 1.75
let fishSign: Entity | null = null

export function setupFishingSign(): void {
  if (fishSign) hookSignClick(fishSign, 'Fishing', 'fish')
}

export function buildFishingSign(): void {
  fishSign = engine.addEntity()
  Transform.create(fishSign, {
    position: Vector3.create(HUB.x0 + 3.7, HUB.y + 0.5 + 0.5 * SCALE, HUB.z0 + 3.7),
    rotation: Quaternion.fromEulerDegrees(0, 225, 0),
    scale: Vector3.create(SCALE, SCALE, SCALE)
  })
  GltfContainer.create(fishSign, {
    src: 'assets/models/fishing.glb',
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER,
    invisibleMeshesCollisionMask: ColliderLayer.CL_POINTER
  })
  MeshCollider.setBox(fishSign, ColliderLayer.CL_POINTER)
  registerHubGlb(fishSign)
}
