import { ColliderLayer, Entity, GltfContainer, MeshCollider, Transform, engine } from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { HUB, OBSTACLE } from '../config'
import { registerHubGlb } from './HubHide'

const DECK = HUB.y + 0.5
/** obstacle-crate.glb half-height / lid above origin at scale 1. */
const CRATE_HALF = 0.4959
const CRATE_LID = 0.4935
const BARREL_HALF = 0.5
/** sittingChair1 hips sit this far above movePlayerTo Y. */
const SIT_HIP = 0.3

export type SitSeat = {
  crate: Entity
  sitX: number
  sitY: number
  sitZ: number
  lookX: number
  lookZ: number
}

const sitSeats: SitSeat[] = []

export function getSitSeats(): SitSeat[] {
  return sitSeats
}

export function buildProps(): void {
  sitSeats.length = 0
  dressHubCargo()
}

function dressHubCargo(): void {
  const x0 = HUB.x0
  const z0 = HUB.z0
  const x1 = x0 + HUB.sx
  const z1 = z0 + HUB.sz

  cargo('crate', x0 + 5.8, z0 + 1.55, 12, 1)
  cargo('crate', x0 + 5.85, z0 + 1.5, -10, 0.85, 0.92)
  cargo('barrel', x0 + 6.9, z0 + 1.3, 52)
  cargo('barrel', x0 + 5.0, z0 + 2.45, 108, 0.92)
  cargo('crate', x0 + 6.7, z0 + 2.55, 40, 0.8)

  cargo('barrel', x0 + 6.2, z1 - 2.4, 18)
  cargo('barrel', x0 + 7.3, z1 - 2.0, 72, 1.05)
  cargo('barrel', x0 + 6.6, z1 - 3.2, -38, 0.9)
  cargo('crate', x0 + 7.8, z1 - 2.8, 14, 0.95)

  cargo('crate', x1 - 5.7, z0 + 1.75, -24, 1)
  cargo('crate', x1 - 5.0, z0 + 2.05, 68, 0.88)
  cargo('barrel', x1 - 6.4, z0 + 2.35, 46)
  cargo('barrel', x1 - 5.1, z0 + 2.65, 112, 0.92)

  cargo('crate', x1 - 6.6, z1 - 2.6, 6, 1)
  cargo('crate', x1 - 6.65, z1 - 2.5, 20, 0.82, 0.92)
  cargo('barrel', x1 - 5.5, z1 - 2.4, -52)
  cargo('crate', x1 - 7.4, z1 - 3.2, 58, 0.85)
  cargo('barrel', x1 - 5.7, z1 - 3.3, 78, 0.9)

  cargo('crate', x0 + 2.55, z0 + 5.2, 22, 1)
  cargo('crate', x0 + 2.6, z0 + 5.15, -8, 0.85, 0.92)
  cargo('barrel', x0 + 3.1, z0 + 4.6, 58)
  cargo('barrel', x0 + 2.35, z0 + 5.9, 100, 0.92)
  cargo('crate', x0 + 2.9, z0 + 5.5, 36, 0.8)

  cargo('barrel', x0 + 1.7, z0 + 6.6, 78)
  sitCrate(x0 + 1.85, z0 + 7.4, 12, 0.9, x0 + 1.85, z0 + 7.4, 10, 0)
  cargo('barrel', x0 + 2.4, z0 + 5.0, -22, 0.9)
  cargo('crate', x0 + 1.9, z0 + 6.8, 44, 0.9)

  cargo('barrel', x0 + 1.55, z0 + 8.2, 82)
  cargo('crate', x0 + 1.7, z0 + 9.3, 8, 0.9)
  cargo('barrel', x0 + 1.5, z0 + 11.2, -18, 0.95)
  cargo('barrel', x0 + 1.9, z0 + 12.0, 48, 0.85)
  sitCrate(x0 + 1.6, z0 + 12.8, 26, 0.9, x0 + 1.6, z0 + 12.8, 4, 10)

  sitCrate(x0 + 9.4, z0 + 1.1, 4, 0.9, x0 + 9.4, z0 + 1.25, 0, 10)
  cargo('barrel', x0 + 10.6, z0 + 1.05, 98)
  cargo('barrel', x0 + 8.5, z0 + 1.25, 38, 0.9)

  cargo('barrel', x0 + 9.2, z1 - 1.5, 10)
  cargo('barrel', x0 + 10.4, z1 - 1.45, 64, 1.05)
  cargo('crate', x0 + 11.2, z1 - 1.9, -28, 0.88)
}

function sitCrate(
  x: number,
  z: number,
  yaw: number,
  scale: number,
  sitX: number,
  sitZ: number,
  lookX: number,
  lookZ: number
): void {
  const crate = cargo('crate', x, z, yaw, scale, 0, true)
  const lidY = DECK + (CRATE_HALF + CRATE_LID) * scale
  sitSeats.push({ crate, sitX, sitY: lidY - SIT_HIP, sitZ, lookX, lookZ })
}

function cargo(
  kind: 'barrel' | 'crate',
  x: number,
  z: number,
  yaw: number,
  scale = 1,
  lift = 0,
  sittable = false
): Entity {
  const e = engine.addEntity()
  const half = kind === 'crate' ? CRATE_HALF : BARREL_HALF
  Transform.create(e, {
    position: Vector3.create(x, DECK + half * scale + lift, z),
    rotation: Quaternion.fromEulerDegrees(0, yaw, 0),
    scale: Vector3.create(scale, scale, scale)
  })
  const mask = sittable ? ColliderLayer.CL_POINTER : ColliderLayer.CL_PHYSICS
  GltfContainer.create(e, {
    src: kind === 'crate' ? OBSTACLE.crate : OBSTACLE.barrel,
    visibleMeshesCollisionMask: mask,
    invisibleMeshesCollisionMask: mask
  })
  if (sittable) MeshCollider.setBox(e, ColliderLayer.CL_POINTER)
  registerHubGlb(e)
  return e
}
