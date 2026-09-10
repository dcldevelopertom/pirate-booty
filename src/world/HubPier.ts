import { ColliderLayer, GltfContainer, Transform, engine } from '@dcl/sdk/ecs'
import { HUB } from '../config'
import { registerHubGlb } from './HubHide'
import { hubCenter } from './layout'

export function buildHubPier(): void {
  const c = hubCenter()

  const deck = engine.addEntity()
  Transform.create(deck, { position: c })
  GltfContainer.create(deck, {
    src: HUB.model,
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS | ColliderLayer.CL_POINTER,
    invisibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS
  })
  registerHubGlb(deck)
}
