import { ColliderLayer, Entity, GltfContainer, Transform, engine } from '@dcl/sdk/ecs'
import { Vector3 } from '@dcl/sdk/math'
import { HUB, WATER_Y } from '../config'
import { floatBarrel, loopBob, loopPitch } from './BobBarrel'
import { registerHubGlb } from './HubHide'

const MODEL = 'assets/models/corsair-pride.glb'
const SCALE = 18
const HULL_MIN_Y = -0.39063

let shipRoll: Entity | null = null

export function parkedShipPose(): { x: number; y: number; z: number } {
  return {
    x: HUB.x0 + HUB.sx - 5,
    y: WATER_Y - HULL_MIN_Y * SCALE - 1.2,
    z: HUB.z0 + HUB.sz + 3
  }
}

export function buildParkedShip(): void {
  const p = parkedShipPose()
  const bob = engine.addEntity()
  Transform.create(bob, { position: Vector3.create(p.x, p.y, p.z) })
  loopBob(bob, p.x, p.y, p.z, 0.22, 3800)

  shipRoll = engine.addEntity()
  Transform.create(shipRoll, { parent: bob })
  loopPitch(shipRoll, 3.85, 4600)

  const hull = engine.addEntity()
  Transform.create(hull, {
    parent: shipRoll,
    scale: Vector3.create(SCALE, SCALE, SCALE)
  })
  GltfContainer.create(hull, {
    src: MODEL,
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
    invisibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS
  })
  registerHubGlb(hull, true)

  floatBarrel(HUB.x0 + 4, HUB.z0 - 1.2, 0.22, 2900, 10, 3400, 40, true)
  floatBarrel(HUB.x0 + 8.5, HUB.z0 - 3.5, 0.3, 3600, 14, 4100, 110, true)
  floatBarrel(HUB.x0 + 12.2, HUB.z0 - 0.8, 0.26, 3200, 9, 3800, -20, true)
  floatBarrel(HUB.x0 + 16, HUB.z0 - 2.6, 0.18, 4100, 12, 4500, 75, true)
  floatBarrel(HUB.x0 + 10.4, HUB.z0 - 5.0, 0.28, 2700, 11, 3300, 160, true)
  floatBarrel(146.2, 169.5, 0.22, 3100, 10, 3600, 40, true)
  floatBarrel(150.4, 166.8, 0.3, 3700, 14, 4200, 110, true)
  floatBarrel(144.8, 173.2, 0.26, 3300, 9, 3900, -20, true)
  floatBarrel(148.6, 175.0, 0.28, 2800, 11, 3400, 160, true)
  floatBarrel(HUB.x0 - 3.2, HUB.z0 + HUB.sz + 4.5, 0.24, 3000, 11, 3500, 25, true)
  floatBarrel(HUB.x0 - 6.0, HUB.z0 + HUB.sz + 8.2, 0.3, 3500, 13, 4000, 95, true)
  floatBarrel(HUB.x0 + 2.4, HUB.z0 + HUB.sz + 10.5, 0.2, 2700, 8, 3200, -35, true)
  floatBarrel(HUB.x0 + 6.8, HUB.z0 + HUB.sz + 7.0, 0.27, 3900, 12, 4400, 130, true)
  floatBarrel(HUB.x0 + 1.0, HUB.z0 + HUB.sz + 13.2, 0.22, 3300, 10, 3700, 60, true)
}
