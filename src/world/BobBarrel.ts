import {
  ColliderLayer,
  EasingFunction,
  Entity,
  GltfContainer,
  Transform,
  Tween,
  TweenLoop,
  TweenSequence,
  engine
} from '@dcl/sdk/ecs'
import { Quaternion, Vector3 } from '@dcl/sdk/math'
import { OBSTACLE, WATER_Y } from '../config'
import { registerHubGlb } from './HubHide'

export function floatBarrel(
  x: number,
  z: number,
  amp: number,
  bobMs: number,
  tilt: number,
  rollMs: number,
  yaw: number,
  hub = false
): Entity {
  const y = WATER_Y + 0.42
  const bob = engine.addEntity()
  Transform.create(bob, { position: Vector3.create(x, y, z) })
  loopBob(bob, x, y, z, amp, bobMs)

  const roll = engine.addEntity()
  Transform.create(roll, { parent: bob })
  loopPitch(roll, tilt, rollMs)

  const barrel = engine.addEntity()
  Transform.create(barrel, {
    parent: roll,
    rotation: Quaternion.fromEulerDegrees(0, yaw, 0)
  })
  GltfContainer.create(barrel, {
    src: OBSTACLE.barrel,
    visibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS,
    invisibleMeshesCollisionMask: ColliderLayer.CL_PHYSICS
  })
  if (hub) registerHubGlb(barrel, true)
  return bob
}

export function loopBob(entity: Entity, x: number, y: number, z: number, amp: number, ms: number): void {
  const down = Vector3.create(x, y - amp, z)
  const up = Vector3.create(x, y + amp, z)
  Tween.setMove(entity, down, up, ms, EasingFunction.EF_EASESINE)
  TweenSequence.create(entity, {
    sequence: [
      {
        duration: ms,
        easingFunction: EasingFunction.EF_EASESINE,
        mode: Tween.Mode.Move({ start: up, end: down })
      }
    ],
    loop: TweenLoop.TL_RESTART
  })
}

export function loopPitch(entity: Entity, deg: number, ms: number): void {
  const a = Quaternion.fromEulerDegrees(0, 0, -deg)
  const b = Quaternion.fromEulerDegrees(0, 0, deg)
  Tween.setRotate(entity, a, b, ms, EasingFunction.EF_EASESINE)
  TweenSequence.create(entity, {
    sequence: [
      {
        duration: ms,
        easingFunction: EasingFunction.EF_EASESINE,
        mode: Tween.Mode.Rotate({ start: b, end: a })
      }
    ],
    loop: TweenLoop.TL_RESTART
  })
}
