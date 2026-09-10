import { ColliderLayer, Entity, GltfContainer, MeshCollider, Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { HUB } from '../config'
import { hookSignClick } from './DeckDodgeKiosk'
import { registerHubGlb } from './HubHide'

const SCALE = 1.75
let cannonSign: Entity | null = null

export function setupCannonFodderSign(): void {
  if (cannonSign) hookSignClick(cannonSign, 'Cannon Fodder', 'cannon')
}

export function buildCannonFodderSign(): void {
  cannonSign = engine.addEntity()
  Transform.create(cannonSign, {
    position: Vector3.create(HUB.x0 + 15.5, HUB.y + 0.5 + 0.5 * SCALE, HUB.z0 + 14),
    rotation: Quaternion.fromEulerDegrees(0, 225, 0),
    scale: Vector3.create(SCALE, SCALE, SCALE)
  })
  GltfContainer.create(cannonSign, {
    src: 'assets/models/cannon-fodder.glb',
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER,
    invisibleMeshesCollisionMask: ColliderLayer.CL_POINTER
  })
  MeshCollider.setBox(cannonSign, ColliderLayer.CL_POINTER)
  registerHubGlb(cannonSign)
}
